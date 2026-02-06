import type { Edge } from '@xyflow/react';
import { clientApiClient } from '@/lib/api';
import type { WorkflowNode } from '@/lib/workflow/types';

interface WorkflowResponse {
  data: {
    workflow: {
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    } | null;
    nodes: WorkflowNode[];
    edges: Edge[];
  };
}

/**
 * Fetch workflow configuration for a project.
 */
export async function fetchWorkflow(projectId: string): Promise<{
  nodes: WorkflowNode[];
  edges: Edge[];
}> {
  const data = await clientApiClient<WorkflowResponse>(`/projects/${projectId}/workflows`);
  return {
    nodes: data.data.nodes,
    edges: data.data.edges,
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
  await clientApiClient(`/projects/${projectId}/workflows`, {
    method: 'POST',
    body: JSON.stringify({ nodes, edges }),
  });
}
