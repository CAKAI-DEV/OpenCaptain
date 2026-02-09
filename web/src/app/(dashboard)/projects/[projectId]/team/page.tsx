'use client';

import {
  ChevronRight,
  MoreHorizontal,
  Plus,
  Settings2,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { invitationsApi } from '@/lib/api/invitations';
import { membersApi } from '@/lib/api/members';
import { squadsApi } from '@/lib/api/squads';
import type { ProjectMember, ProjectRole } from '@/types/member';
import type { Squad, SquadMember } from '@/types/squad';

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  pm: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  squad_lead: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  member: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  pm: 'PM',
  squad_lead: 'Squad Lead',
  member: 'Member',
};

const allRoles: ProjectRole[] = ['admin', 'pm', 'squad_lead', 'member'];

export default function TeamPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSquadOpen, setCreateSquadOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newSquadName, setNewSquadName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('member');
  const [creating, setCreating] = useState(false);

  // Squad members state: squadId -> SquadMember[]
  const [squadMembers, setSquadMembers] = useState<Record<string, SquadMember[]>>({});
  const [manageSquadId, setManageSquadId] = useState<string | null>(null);
  const [addMemberToSquadId, setAddMemberToSquadId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [squadsRes, membersRes] = await Promise.all([
        squadsApi.list(projectId),
        membersApi.list(projectId),
      ]);
      const loadedSquads = Array.isArray(squadsRes) ? squadsRes : [];
      setSquads(loadedSquads);
      setMembers(Array.isArray(membersRes) ? membersRes : []);

      // Load members for each squad
      const memberResults = await Promise.all(
        loadedSquads.map((s) =>
          squadsApi
            .listMembers(s.id)
            .then((r) => ({ squadId: s.id, members: Array.isArray(r) ? r : [] }))
            .catch(() => ({ squadId: s.id, members: [] }))
        )
      );
      const membersMap: Record<string, SquadMember[]> = {};
      for (const r of memberResults) {
        membersMap[r.squadId] = r.members;
      }
      setSquadMembers(membersMap);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSquad = async () => {
    if (!newSquadName.trim()) return;
    setCreating(true);
    try {
      await squadsApi.create({ projectId, name: newSquadName.trim() });
      setCreateSquadOpen(false);
      setNewSquadName('');
      loadData();
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setCreating(true);
    try {
      await invitationsApi.sendEmail(inviteEmail.trim(), inviteRole);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSquad = async (squadId: string) => {
    try {
      await squadsApi.delete(squadId);
      loadData();
    } catch {
      // Handle error
    }
  };

  const handleChangeRole = async (userId: string, newRole: ProjectRole) => {
    try {
      await membersApi.assign(projectId, { userId, role: newRole });
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)));
    } catch {
      // Handle error
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await membersApi.remove(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      // Handle error
    }
  };

  const handleAddSquadMember = async (squadId: string, userId: string) => {
    try {
      await squadsApi.addMember(squadId, userId);
      const res = await squadsApi.listMembers(squadId);
      setSquadMembers((prev) => ({ ...prev, [squadId]: Array.isArray(res) ? res : [] }));
      setAddMemberToSquadId('');
    } catch {
      // Handle error
    }
  };

  const handleRemoveSquadMember = async (squadId: string, userId: string) => {
    try {
      await squadsApi.removeMember(squadId, userId);
      setSquadMembers((prev) => ({
        ...prev,
        [squadId]: (prev[squadId] || []).filter((m) => m.userId !== userId),
      }));
    } catch {
      // Handle error
    }
  };

  const getAvailableMembersForSquad = (squadId: string) => {
    const currentSquadMembers = squadMembers[squadId] || [];
    const currentUserIds = new Set(currentSquadMembers.map((m) => m.userId));
    return members.filter((m) => !currentUserIds.has(m.userId));
  };

  const managedSquad = squads.find((s) => s.id === manageSquadId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage squads and team members</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-1" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>Send an invitation to join this organization.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as ProjectRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="squad_lead">Squad Lead</SelectItem>
                      <SelectItem value="pm">PM</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={creating || !inviteEmail.trim()}>
                  {creating ? 'Sending...' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="squads">Squads ({squads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1">
                      <div className="h-3 bg-muted rounded w-32 animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No members yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Invite team members to collaborate on this project.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <Card key={member.userId}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{member.user.email[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{member.user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className={roleColors[member.role]}>
                      <Shield className="h-3 w-3 mr-1" />
                      {roleLabels[member.role]}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Shield className="h-4 w-4 mr-2" />
                            Change Role
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {allRoles.map((role) => (
                              <DropdownMenuItem
                                key={role}
                                disabled={member.role === role}
                                onClick={() => handleChangeRole(member.userId, role)}
                              >
                                <Badge variant="secondary" className={`${roleColors[role]} mr-2`}>
                                  {roleLabels[role]}
                                </Badge>
                                {member.role === role && (
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    Current
                                  </span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleRemoveMember(member.userId)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Remove from Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="squads" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={createSquadOpen} onOpenChange={setCreateSquadOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Squad
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Squad</DialogTitle>
                  <DialogDescription>
                    Create a new squad to organize team members.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Squad Name</Label>
                    <Input
                      placeholder="e.g., Frontend Team"
                      value={newSquadName}
                      onChange={(e) => setNewSquadName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateSquadOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSquad} disabled={creating || !newSquadName.trim()}>
                    {creating ? 'Creating...' : 'Create Squad'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {squads.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No squads yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create squads to organize your team into groups.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {squads.map((squad) => {
                const sm = squadMembers[squad.id] || [];
                return (
                  <Card key={squad.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{squad.name}</CardTitle>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setManageSquadId(squad.id)}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteSquad(squad.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {sm.length} member{sm.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span>Created {new Date(squad.createdAt).toLocaleDateString()}</span>
                      </div>
                      {sm.length > 0 && (
                        <div className="flex items-center gap-1 mt-3">
                          {sm.slice(0, 5).map((m) => (
                            <Avatar key={m.userId} className="h-7 w-7 border-2 border-background">
                              <AvatarFallback className="text-xs">
                                {m.user.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {sm.length > 5 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              +{sm.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                      {(squad.subSquads ?? squad.children ?? []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(squad.subSquads ?? squad.children ?? []).map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-1 text-xs text-muted-foreground"
                            >
                              <ChevronRight className="h-3 w-3" />
                              {child.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Manage Squad Members Dialog */}
      <Dialog
        open={!!manageSquadId}
        onOpenChange={(open) => {
          if (!open) setManageSquadId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Members — {managedSquad?.name}</DialogTitle>
            <DialogDescription>Add or remove members from this squad.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Add member */}
            {manageSquadId && (
              <div className="flex gap-2">
                <Select value={addMemberToSquadId} onValueChange={setAddMemberToSquadId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a member to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableMembersForSquad(manageSquadId).map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.user.email} ({roleLabels[m.role]})
                      </SelectItem>
                    ))}
                    {getAvailableMembersForSquad(manageSquadId).length === 0 && (
                      <SelectItem value="_none" disabled>
                        All members already in squad
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!addMemberToSquadId}
                  onClick={() => {
                    if (manageSquadId && addMemberToSquadId) {
                      handleAddSquadMember(manageSquadId, addMemberToSquadId);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator />

            {/* Current squad members */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Current Members
              </Label>
              {manageSquadId && (squadMembers[manageSquadId] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No members in this squad yet.
                </p>
              ) : (
                manageSquadId &&
                (squadMembers[manageSquadId] || []).map((sm) => (
                  <div key={sm.userId} className="flex items-center gap-3 py-1.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
                        {sm.user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{sm.user.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveSquadMember(manageSquadId, sm.userId)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageSquadId(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
