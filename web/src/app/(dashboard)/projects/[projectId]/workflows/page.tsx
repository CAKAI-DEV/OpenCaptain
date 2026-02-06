'use client';

import type { Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WorkflowEditor } from '@/components/workflow';
import { toast } from '@/hooks/use-toast';
import { fetchWorkflow, saveWorkflow } from '@/lib/api/workflows';
import type { WorkflowNode } from '@/lib/workflow/types';

export default function WorkflowsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [initialNodes, setInitialNodes] = useState<WorkflowNode[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch workflow on mount
  useEffect(() => {
    async function loadWorkflow() {
      try {
        const workflow = await fetchWorkflow(projectId);
        setInitialNodes(workflow.nodes);
        setInitialEdges(workflow.edges);
      } catch (err) {
        // No workflow yet or error - start with empty canvas
        console.error('Failed to load workflow:', err);
      } finally {
        setLoading(false);
      }
    }
    loadWorkflow();
  }, [projectId]);

  const handleSave = async (nodes: WorkflowNode[], edges: Edge[]) => {
    try {
      await saveWorkflow(projectId, nodes, edges);
      toast({ title: 'Workflow saved' });
    } catch (err) {
      console.error('Failed to save workflow:', err);
      toast({ title: 'Failed to save workflow', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <WorkflowEditor initialNodes={initialNodes} initialEdges={initialEdges} onSave={handleSave} />
    </div>
  );
}
