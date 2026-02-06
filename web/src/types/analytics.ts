export interface OutputMetrics {
  byUser: Array<{
    userId: string;
    tasksCompleted: number;
    deliverablesCompleted: number;
  }>;
  bySquad: Array<{
    squadId: string;
    tasksCompleted: number;
    deliverablesCompleted: number;
  }>;
  totals: {
    tasksCompleted: number;
    deliverablesCompleted: number;
  };
}

export interface VelocityPeriod {
  periodStart: string;
  periodEnd: string;
  velocity: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  completed: number;
}

export interface PersonalMetrics {
  tasksCompleted: number;
  deliverablesCompleted: number;
  tasksByPriority: Record<string, number>;
  averageCompletionTime: number | null;
}

export type HealthLevel = 'healthy' | 'warning' | 'critical';
