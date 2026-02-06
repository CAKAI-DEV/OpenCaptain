import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import type { SaveWorkflowBody, WorkflowEdge, WorkflowNode } from './workflows.types';

export interface Workflow {
  id: string;
  projectId: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get workflow for a project. Returns null if no workflow exists.
 */
export async function getWorkflow(projectId: string): Promise<Workflow | null> {
  const result = await db.query.workflows.findFirst({
    where: eq(schema.workflows.projectId, projectId),
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    projectId: result.projectId,
    name: result.name,
    nodes: result.nodes as WorkflowNode[],
    edges: result.edges as WorkflowEdge[],
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * Save (upsert) workflow for a project.
 */
export async function saveWorkflow(projectId: string, data: SaveWorkflowBody): Promise<Workflow> {
  const now = new Date();

  const result = await db
    .insert(schema.workflows)
    .values({
      projectId,
      name: data.name ?? 'Default Workflow',
      nodes: data.nodes,
      edges: data.edges,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.workflows.projectId,
      set: {
        name: data.name ?? 'Default Workflow',
        nodes: data.nodes,
        edges: data.edges,
        updatedAt: now,
      },
    })
    .returning();

  const saved = result[0];
  if (!saved) {
    throw new Error('Failed to save workflow');
  }

  logger.info({ projectId, nodeCount: data.nodes.length }, 'Workflow saved');

  return {
    id: saved.id,
    projectId: saved.projectId,
    name: saved.name,
    nodes: saved.nodes as WorkflowNode[],
    edges: saved.edges as WorkflowEdge[],
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}
