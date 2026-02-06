import { z } from 'zod';

/**
 * Intent types for message classification.
 */
export const intentEnum = z.enum([
  'query_tasks', // "what's due this week?", "my tasks"
  'query_status', // "squad status", "project progress"
  'create_task', // "create task X", "add task"
  'update_task', // "mark task X as done", "complete task"
  'switch_project', // "/switch", "switch to project X"
  'report_blocker', // "I'm blocked on X", "stuck", "can't proceed"
  'help', // "help", "what can you do?"
  'general_chat', // Conversational, not task-specific
  'unknown', // Can't determine intent
]);

export type Intent = z.infer<typeof intentEnum>;

/**
 * Entities extracted from user messages.
 */
export const entitiesSchema = z.object({
  projectName: z.string().optional(),
  taskTitle: z.string().optional(),
  timeRange: z.enum(['today', 'this_week', 'this_month', 'overdue']).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee: z.string().optional(),
  blockerDescription: z.string().optional(),
});

export type Entities = z.infer<typeof entitiesSchema>;

/**
 * Result from intent detection.
 */
export const intentResultSchema = z.object({
  intent: intentEnum,
  entities: entitiesSchema,
  confidence: z.number().min(0).max(1),
});

export type IntentResult = z.infer<typeof intentResultSchema>;

/**
 * User context for message processing.
 */
export interface MessageContext {
  userId: string;
  organizationId: string;
  currentProjectId: string | null;
  visibleProjectIds: string[];
  conversationId: string | null;
}

/**
 * Response from message processing.
 */
export interface ProcessedMessage {
  response: string;
  newProjectId?: string; // If context switched
}
