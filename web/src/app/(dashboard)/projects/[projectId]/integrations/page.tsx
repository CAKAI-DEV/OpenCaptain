'use client';

import { Check, Github, Link2, Plus, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { api } from '@/lib/api/index';

interface LinearIntegration {
  enabled: boolean;
  teamId?: string;
  teamName?: string;
}

interface LinkedRepo {
  id: string;
  owner: string;
  repo: string;
  installationId: number;
  createdAt: string;
}

export default function IntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [linearIntegration, setLinearIntegration] = useState<LinearIntegration | null>(null);
  const [repos, setRepos] = useState<LinkedRepo[]>([]);
  const [_loading, setLoading] = useState(true);

  // Linear form
  const [linearOpen, setLinearOpen] = useState(false);
  const [linearApiKey, setLinearApiKey] = useState('');
  const [linearTeamId, setLinearTeamId] = useState('');
  const [saving, setSaving] = useState(false);

  // GitHub form
  const [repoOpen, setRepoOpen] = useState(false);
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repoInstallId, setRepoInstallId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [linearRes, reposRes] = await Promise.allSettled([
        api.get<{ success: boolean; data: LinearIntegration }>(
          `/projects/${projectId}/integrations/linear`
        ),
        api.get<{ success: boolean; data: { repos: LinkedRepo[] } }>(
          `/projects/${projectId}/repos`
        ),
      ]);
      if (linearRes.status === 'fulfilled') {
        setLinearIntegration((linearRes.value as { data: LinearIntegration }).data || null);
      }
      if (reposRes.status === 'fulfilled') {
        const val = reposRes.value as { data: { repos: LinkedRepo[] } };
        setRepos(val.data?.repos || []);
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLinearConnect = async () => {
    if (!linearApiKey.trim() || !linearTeamId.trim()) return;
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/integrations/linear`, {
        apiKey: linearApiKey.trim(),
        teamId: linearTeamId.trim(),
      });
      setLinearOpen(false);
      setLinearApiKey('');
      setLinearTeamId('');
      loadData();
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleLinearDisconnect = async () => {
    try {
      await api.del(`/projects/${projectId}/integrations/linear`);
      setLinearIntegration(null);
    } catch {
      // Handle error
    }
  };

  const handleLinkRepo = async () => {
    if (!repoOwner.trim() || !repoName.trim()) return;
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/repos`, {
        owner: repoOwner.trim(),
        repo: repoName.trim(),
        installationId: Number(repoInstallId) || 0,
      });
      setRepoOpen(false);
      setRepoOwner('');
      setRepoName('');
      setRepoInstallId('');
      loadData();
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkRepo = async (repoId: string) => {
    try {
      await api.del(`/projects/${projectId}/repos/${repoId}`);
      loadData();
    } catch {
      // Handle error
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect external tools to your project</p>
      </div>

      {/* Linear Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-base">Linear</CardTitle>
                <CardDescription>Sync tasks bidirectionally with Linear issues</CardDescription>
              </div>
            </div>
            {linearIntegration?.enabled ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                <Check className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {linearIntegration?.enabled ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Connected to team:{' '}
                <span className="font-medium text-foreground">
                  {linearIntegration.teamName || linearIntegration.teamId}
                </span>
              </div>
              <Button variant="destructive" size="sm" onClick={handleLinearDisconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Dialog open={linearOpen} onOpenChange={setLinearOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Connect Linear
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect Linear</DialogTitle>
                  <DialogDescription>
                    Enter your Linear API key and team ID to enable task sync.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder="lin_api_..."
                      value={linearApiKey}
                      onChange={(e) => setLinearApiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Team ID</Label>
                    <Input
                      placeholder="Your Linear team ID"
                      value={linearTeamId}
                      onChange={(e) => setLinearTeamId(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLinearOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinearConnect}
                    disabled={saving || !linearApiKey.trim() || !linearTeamId.trim()}
                  >
                    {saving ? 'Connecting...' : 'Connect'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* GitHub Repos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Github className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">GitHub Repositories</CardTitle>
                <CardDescription>Link repos for the coding agent to create PRs</CardDescription>
              </div>
            </div>
            <Dialog open={repoOpen} onOpenChange={setRepoOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Link Repo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Link GitHub Repository</DialogTitle>
                  <DialogDescription>
                    Connect a GitHub repository for the coding agent.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Input
                      placeholder="github-username"
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Repository</Label>
                    <Input
                      placeholder="repo-name"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Installation ID (optional)</Label>
                    <Input
                      placeholder="GitHub App installation ID"
                      value={repoInstallId}
                      onChange={(e) => setRepoInstallId(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRepoOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinkRepo}
                    disabled={saving || !repoOwner.trim() || !repoName.trim()}
                  >
                    {saving ? 'Linking...' : 'Link Repository'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {repos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repositories linked yet.</p>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {repo.owner}/{repo.repo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnlinkRepo(repo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
