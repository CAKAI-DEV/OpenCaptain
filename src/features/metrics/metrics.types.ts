export interface OutputMetrics {
  totalCompleted: number;
  byDay: Array<{ date: string; count: number }>;
  byPerson: Array<{ userId: string; email: string; count: number }>;
  bySquad: Array<{ squadId: string; name: string; count: number }>;
}

export interface VelocityPeriod {
  periodStart: Date;
  periodEnd: Date;
  velocity: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface MetricsQueryInput {
  projectId: string;
  startDate: Date;
  endDate: Date;
  squadId?: string;
  granularity?: 'daily' | 'weekly' | 'monthly';
}

export interface PersonalMetrics {
  totalCompleted: number;
  byDay: Array<{ date: string; count: number }>;
  projectAverage: number;
}
