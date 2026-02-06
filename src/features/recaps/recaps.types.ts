import { z } from 'zod';

/**
 * Recap scope determines what data is included
 */
export type RecapScope = 'personal' | 'squad' | 'project';

/**
 * Recap period
 */
export type RecapPeriod = 'daily' | 'weekly';

/**
 * Recap job data for BullMQ
 */
export interface RecapJobData {
  type: 'generate_recap';
  userId: string;
  projectId: string;
  organizationId: string;
  period: RecapPeriod;
}

/**
 * Personal metrics for recap
 */
export interface PersonalMetrics {
  tasksCompleted: number;
  deliverablesCompleted: number;
  tasksInProgress: number;
  blockers: number;
}

/**
 * Squad metrics for recap
 */
export interface SquadMetrics {
  totalCompleted: number;
  byPerson: Array<{ name: string; completed: number }>;
  activeBlockers: number;
  velocity: number; // items per day
}

/**
 * Project metrics for recap
 */
export interface ProjectMetrics {
  totalCompleted: number;
  bySquad: Array<{ name: string; completed: number }>;
  byDay: Array<{ date: string; count: number }>;
  criticalBlockers: number;
  atRiskDeadlines: number;
}

/**
 * Context for recap generation
 */
export interface RecapContext {
  scope: RecapScope;
  period: RecapPeriod;
  userName: string;
  projectName: string;
  metrics: PersonalMetrics | SquadMetrics | ProjectMetrics;
  blockers: Array<{ title: string; reportedAt: Date; status: string }>;
  upcomingDeadlines: Array<{ title: string; dueDate: Date; type: 'task' | 'deliverable' }>;
  recentActivity: Array<{ description: string; timestamp: Date }>;
}

/**
 * Generate recap request schema
 */
export const generateRecapSchema = z.object({
  projectId: z.string().uuid(),
  period: z.enum(['daily', 'weekly']),
});

export type GenerateRecapInput = z.infer<typeof generateRecapSchema>;
