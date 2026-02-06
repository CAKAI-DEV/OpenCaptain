import { z } from 'zod';

// Node schema matches React Flow Node structure
export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['checkIn', 'escalation', 'role', 'visibility']),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.string(), z.unknown()),
});

// Edge schema matches React Flow Edge structure
export const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string().optional(),
});

export const saveWorkflowBodySchema = z.object({
  name: z.string().optional(),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
});

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type SaveWorkflowBody = z.infer<typeof saveWorkflowBodySchema>;
