export interface OutputMetrics {
  totalCompleted: number;
  byDay: Array<{ date: string; count: number }>;
  byPerson: Array<{ userId: string; email: string; count: number }>;
  bySquad: Array<{ squadId: string; name: string; count: number }>;
}

export interface VelocityPeriod {
  periodStart: string;
  periodEnd: string;
  velocity: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface PersonalMetrics {
  totalCompleted: number;
  byDay: Array<{ date: string; count: number }>;
  projectAverage: number;
}

export type HealthLevel = 'healthy' | 'warning' | 'critical';
