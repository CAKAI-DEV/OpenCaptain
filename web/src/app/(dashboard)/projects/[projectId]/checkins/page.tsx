'use client';

import { AlertCircle, CheckCircle2, Clock, Plus, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { checkinsApi } from '@/lib/api/checkins';
import { escalationsApi } from '@/lib/api/escalations';
import type { CheckInBlock, CheckInTemplate } from '@/types/checkin';
import type { Blocker, EscalationBlock } from '@/types/escalation';

export default function CheckinsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [checkInBlocks, setCheckInBlocks] = useState<CheckInBlock[]>([]);
  const [escalationBlocks, setEscalationBlocks] = useState<EscalationBlock[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [templates, setTemplates] = useState<CheckInTemplate[]>([]);
  const [_loading, setLoading] = useState(true);

  // Create check-in form
  const [createCheckInOpen, setCreateCheckInOpen] = useState(false);
  const [checkInName, setCheckInName] = useState('');
  const [checkInTemplate, setCheckInTemplate] = useState('');
  const [checkInCron, setCheckInCron] = useState('0 9 * * 1-5');
  const [checkInTimezone, _setCheckInTimezone] = useState('UTC');
  const [creating, setCreating] = useState(false);

  // Create escalation form
  const [createEscOpen, setCreateEscOpen] = useState(false);
  const [escName, setEscName] = useState('');
  const [escTrigger, setEscTrigger] = useState<EscalationBlock['triggerType']>('blocker_reported');

  // Report blocker form
  const [reportBlockerOpen, setReportBlockerOpen] = useState(false);
  const [blockerDesc, setBlockerDesc] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [checkIns, escalations, blockersRes, templatesRes] = await Promise.allSettled([
        checkinsApi.listBlocks(projectId),
        escalationsApi.listBlocks(projectId),
        escalationsApi.listBlockers(projectId, 'open'),
        checkinsApi.listTemplates(),
      ]);
      if (checkIns.status === 'fulfilled') setCheckInBlocks(checkIns.value.data || []);
      if (escalations.status === 'fulfilled') setEscalationBlocks(escalations.value.data || []);
      if (blockersRes.status === 'fulfilled') setBlockers(blockersRes.value.data || []);
      if (templatesRes.status === 'fulfilled') setTemplates(templatesRes.value.data || []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCheckIn = async () => {
    if (!checkInName.trim() || !checkInTemplate) return;
    setCreating(true);
    try {
      await checkinsApi.createBlock(projectId, {
        name: checkInName.trim(),
        templateId: checkInTemplate,
        cronExpression: checkInCron,
        timezone: checkInTimezone,
        enabled: true,
      });
      setCreateCheckInOpen(false);
      setCheckInName('');
      loadData();
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleCreateEscalation = async () => {
    if (!escName.trim()) return;
    setCreating(true);
    try {
      await escalationsApi.createBlock(projectId, {
        name: escName.trim(),
        triggerType: escTrigger,
        escalationSteps: [
          {
            routeType: 'role',
            routeRole: 'squad_lead',
            delayMinutes: 0,
            message: 'Needs attention.',
          },
          { routeType: 'role', routeRole: 'pm', delayMinutes: 240, message: 'Escalated to PM.' },
        ],
        enabled: true,
      });
      setCreateEscOpen(false);
      setEscName('');
      loadData();
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleReportBlocker = async () => {
    if (!blockerDesc.trim()) return;
    setCreating(true);
    try {
      await escalationsApi.reportBlocker(projectId, {
        description: blockerDesc.trim(),
      });
      setReportBlockerOpen(false);
      setBlockerDesc('');
      loadData();
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleResolveBlocker = async (blockerId: string) => {
    try {
      await escalationsApi.resolveBlocker(projectId, blockerId, 'Resolved');
      loadData();
    } catch {
      // Handle error
    }
  };

  const handleDeleteCheckIn = async (blockId: string) => {
    try {
      await checkinsApi.deleteBlock(projectId, blockId);
      loadData();
    } catch {
      // Handle error
    }
  };

  const handleDeleteEscalation = async (blockId: string) => {
    try {
      await escalationsApi.deleteBlock(projectId, blockId);
      loadData();
    } catch {
      // Handle error
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Check-ins & Escalations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure automated check-ins and escalation chains
        </p>
      </div>

      <Tabs defaultValue="checkins">
        <TabsList>
          <TabsTrigger value="checkins">Check-ins ({checkInBlocks.length})</TabsTrigger>
          <TabsTrigger value="escalations">Escalations ({escalationBlocks.length})</TabsTrigger>
          <TabsTrigger value="blockers">Blockers ({blockers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="checkins" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={createCheckInOpen} onOpenChange={setCreateCheckInOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Check-in
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Check-in</DialogTitle>
                  <DialogDescription>Set up an automated check-in for your team.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g., Daily Standup"
                      value={checkInName}
                      onChange={(e) => setCheckInName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select value={checkInTemplate} onValueChange={setCheckInTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                        {templates.length === 0 && (
                          <SelectItem value="daily_standup">Daily Standup</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule (cron)</Label>
                    <Input
                      placeholder="0 9 * * 1-5"
                      value={checkInCron}
                      onChange={(e) => setCheckInCron(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Default: 9 AM, Monday-Friday</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateCheckInOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCheckIn} disabled={creating || !checkInName.trim()}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {checkInBlocks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No check-ins configured</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up scheduled check-ins for your team.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {checkInBlocks.map((block) => (
                <Card key={block.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{block.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Schedule: {block.cronExpression} ({block.timezone})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={block.enabled ? 'default' : 'secondary'}>
                        {block.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteCheckIn(block.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="escalations" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={createEscOpen} onOpenChange={setCreateEscOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Escalation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Escalation Rule</DialogTitle>
                  <DialogDescription>Set up an automatic escalation chain.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g., Blocker Escalation"
                      value={escName}
                      onChange={(e) => setEscName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger</Label>
                    <Select
                      value={escTrigger}
                      onValueChange={(v) => setEscTrigger(v as EscalationBlock['triggerType'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blocker_reported">Blocker Reported</SelectItem>
                        <SelectItem value="deadline_approaching">Deadline Approaching</SelectItem>
                        <SelectItem value="no_response">No Response</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateEscOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateEscalation} disabled={creating || !escName.trim()}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {escalationBlocks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">No escalation rules</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure escalation chains for blockers and deadlines.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {escalationBlocks.map((block) => (
                <Card key={block.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{block.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Trigger: {block.triggerType.replace(/_/g, ' ')} | Steps:{' '}
                        {(block.escalationSteps || [])
                          .map((s) => s.routeRole || s.routeType)
                          .join(' -> ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={block.enabled ? 'default' : 'secondary'}>
                        {block.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteEscalation(block.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="blockers" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={reportBlockerOpen} onOpenChange={setReportBlockerOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Report Blocker
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report Blocker</DialogTitle>
                  <DialogDescription>Report a blocker that needs escalation.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="What's blocking you?"
                      value={blockerDesc}
                      onChange={(e) => setBlockerDesc(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReportBlockerOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleReportBlocker} disabled={creating || !blockerDesc.trim()}>
                    {creating ? 'Reporting...' : 'Report'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {blockers.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium">No active blockers</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  No blockers reported. Your team is clear!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {blockers.map((blocker) => (
                <Card key={blocker.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{blocker.description}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">{blocker.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Reported {new Date(blocker.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolveBlocker(blocker.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Resolve
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
