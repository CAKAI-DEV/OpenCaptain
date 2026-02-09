'use client';

import { Filter, Package, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { deliverablesApi } from '@/lib/api/deliverables';
import type { Deliverable, DeliverableType } from '@/types/deliverable';

const PRESETS = [
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'video', label: 'Video' },
  { value: 'design', label: 'Design Asset' },
  { value: 'report', label: 'Report' },
];

export default function DeliverablesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [types, setTypes] = useState<DeliverableType[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTypeId, setNewTypeId] = useState('');
  const [creating, setCreating] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [delRes, typesRes] = await Promise.all([
        deliverablesApi.list({ projectId }),
        deliverablesApi.listTypes(projectId),
      ]);
      setDeliverables(delRes.data || []);
      setTypes(typesRes.data || []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateDeliverable = async () => {
    if (!newTitle.trim() || !newTypeId) return;
    setCreating(true);
    try {
      await deliverablesApi.create({
        projectId,
        deliverableTypeId: newTypeId,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewTypeId('');
      loadData();
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromPreset = async (preset: string) => {
    try {
      await deliverablesApi.createTypeFromPreset(projectId, preset);
      setCreateTypeOpen(false);
      loadData();
    } catch {
      // Handle error
    }
  };

  const filteredDeliverables =
    filterType === 'all'
      ? deliverables
      : deliverables.filter((d) => d.deliverableTypeId === filterType);

  const getTypeName = (typeId: string) => types.find((t) => t.id === typeId)?.name || 'Unknown';

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      in_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      published: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deliverables</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track and manage project deliverables
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createTypeOpen} onOpenChange={setCreateTypeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Deliverable Type</DialogTitle>
                <DialogDescription>Choose a preset type to get started quickly.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-4">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="outline"
                    className="h-auto py-4 flex flex-col"
                    onClick={() => handleCreateFromPreset(preset.value)}
                  >
                    <Package className="h-5 w-5 mb-1" />
                    {preset.label}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Deliverable
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Deliverable</DialogTitle>
                <DialogDescription>Add a new deliverable to this project.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newTypeId} onValueChange={setNewTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="Deliverable title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Description..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDeliverable}
                  disabled={creating || !newTitle.trim() || !newTypeId}
                >
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Type filter */}
      {types.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilterType('all')}
            >
              All ({deliverables.length})
            </Button>
            {types.map((type) => {
              const count = deliverables.filter((d) => d.deliverableTypeId === type.id).length;
              return (
                <Button
                  key={type.id}
                  variant={filterType === type.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilterType(type.id)}
                >
                  {type.name} ({count})
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                <div className="h-3 bg-muted rounded w-1/2 mt-3 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDeliverables.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No deliverables yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {types.length === 0
                ? 'Start by adding a deliverable type, then create deliverables.'
                : 'Create your first deliverable to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDeliverables.map((deliverable) => (
            <Card key={deliverable.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium">{deliverable.title}</CardTitle>
                  <Badge variant="secondary" className={getStatusColor(deliverable.status)}>
                    {deliverable.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {deliverable.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {deliverable.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {getTypeName(deliverable.deliverableTypeId)}
                    </Badge>
                    {deliverable.dueDate && (
                      <span>Due {new Date(deliverable.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
