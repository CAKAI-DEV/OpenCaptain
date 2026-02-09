import type { Edge } from '@xyflow/react';
import type { WorkflowNode } from '@/lib/workflow/types';
import { api } from './index';

interface WorkflowResponseData {
  workflow: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  nodes: WorkflowNode[];
  edges: Edge[];
}

/**
 * Fetch workflow configuration for a project.
 */
export async function fetchWorkflow(projectId: string): Promise<{
  nodes: WorkflowNode[];
  edges: Edge[];
}> {
  const res = await api.get<{ data: WorkflowResponseData }>(`/projects/${projectId}/workflows`);
  return {
    nodes: res.data.nodes,
    edges: res.data.edges,
  };
}

/**
 * Save workflow configuration for a project.
 */
export async function saveWorkflow(
  projectId: string,
  nodes: WorkflowNode[],
  edges: Edge[]
): Promise<void> {
  await api.post(`/projects/${projectId}/workflows`, { nodes, edges });
}
