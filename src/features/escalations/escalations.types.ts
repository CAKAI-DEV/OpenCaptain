import { z } from 'zod';
import type {
  EscalationStep,
  EscalationTriggerType,
} from '../../shared/db/schema/escalation-blocks';

/**
 * Escalation step schema for validation
 */
export const escalationStepSchema = z.object({
  delayMinutes: z.number().min(0), // 0 = immediate
  routeType: z.enum(['reports_to', 'role', 'user']),
  routeRole: z.string().optional(),
  routeUserId: z.string().uuid().optional(),
  message: z.string().max(1000).optional(),
});

/**
 * Create escalation block input
 */
export const createEscalationBlockSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  triggerType: z.enum(['blocker_reported', 'deadline_risk', 'output_below_threshold']),
  deadlineWarningDays: z.number().min(1).max(30).optional(),
  outputThreshold: z.number().min(1).optional(),
  outputPeriodDays: z.number().min(1).max(30).optional(),
  targetType: z.enum(['all', 'squad', 'role']).default('all'),
  targetSquadId: z.string().uuid().optional(),
  targetRole: z.enum(['admin', 'pm', 'squad_lead', 'member']).optional(),
  escalationSteps: z.array(escalationStepSchema).min(1).max(10),
  enabled: z.boolean().default(true),
});

export type CreateEscalationBlockInput = z.infer<typeof createEscalationBlockSchema>;

/**
 * Update escalation block input
 */
export const updateEscalationBlockSchema = createEscalationBlockSchema.partial();
export type UpdateEscalationBlockInput = z.infer<typeof updateEscalationBlockSchema>;

/**
 * Report blocker input
 */
export const reportBlockerSchema = z.object({
  description: z.string().min(1).max(5000),
  taskId: z.string().uuid().optional(),
});

export type ReportBlockerInput = z.infer<typeof reportBlockerSchema>;

/**
 * Resolve blocker input
 */
export const resolveBlockerSchema = z.object({
  resolutionNote: z.string().max(5000).optional(),
});

export type ResolveBlockerInput = z.infer<typeof resolveBlockerSchema>;

/**
 * Escalation job data for BullMQ
 */
export interface EscalationJobData {
  type: 'process_escalation' | 'check_deadline' | 'check_output';
  escalationInstanceId?: string;
  projectId?: string;
  escalationBlockId?: string;
  userId?: string;
  taskId?: string;
}

/**
 * Escalation block result with computed fields
 */
export interface EscalationBlockResult {
  id: string;
  projectId: string;
  createdById: string;
  name: string;
  description: string | null;
  triggerType: EscalationTriggerType;
  deadlineWarningDays: number | null;
  outputThreshold: number | null;
  outputPeriodDays: number | null;
  targetType: string;
  targetSquadId: string | null;
  targetRole: string | null;
  escalationSteps: EscalationStep[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Blocker result
 */
export interface BlockerResult {
  id: string;
  projectId: string;
  reportedById: string;
  taskId: string | null;
  description: string;
  status: string;
  resolvedById: string | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Escalation instance result
 */
export interface EscalationInstanceResult {
  id: string;
  projectId: string;
  escalationBlockId: string;
  triggerType: string;
  blockerId: string | null;
  targetUserId: string;
  taskId: string | null;
  currentStep: number;
  status: string;
  startedAt: Date;
  lastEscalatedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
