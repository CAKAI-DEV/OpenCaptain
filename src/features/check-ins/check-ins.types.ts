import { z } from 'zod';
import type { CheckInQuestion } from '../../shared/db/schema/check-in-blocks';

/**
 * Question schema for validation
 */
export const questionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(500),
  type: z.enum(['text', 'number', 'select', 'boolean']),
  options: z.array(z.string()).optional(),
  required: z.boolean(),
});

/**
 * Create check-in block input
 */
export const createCheckInBlockSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  cronPattern: z.string().min(1).max(50),
  timezone: z.string().max(50).default('UTC'),
  questions: z.array(questionSchema).min(1).max(20),
  templateId: z.string().max(50).optional(),
  targetType: z.enum(['all', 'squad', 'role']).default('all'),
  targetSquadId: z.string().uuid().optional(),
  targetRole: z.enum(['admin', 'pm', 'squad_lead', 'member']).optional(),
  enabled: z.boolean().default(true),
});

export type CreateCheckInBlockInput = z.infer<typeof createCheckInBlockSchema>;

/**
 * Update check-in block input
 */
export const updateCheckInBlockSchema = createCheckInBlockSchema.partial();
export type UpdateCheckInBlockInput = z.infer<typeof updateCheckInBlockSchema>;

/**
 * Check-in job data for BullMQ
 */
export interface CheckInJobData {
  type: 'send_check_in';
  checkInBlockId: string;
  userId: string;
}

/**
 * Check-in block result with computed fields
 */
export interface CheckInBlockResult {
  id: string;
  projectId: string;
  createdById: string;
  name: string;
  description: string | null;
  cronPattern: string;
  timezone: string;
  questions: CheckInQuestion[];
  templateId: string | null;
  targetType: string;
  targetSquadId: string | null;
  targetRole: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
