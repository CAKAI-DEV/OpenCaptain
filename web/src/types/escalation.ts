export interface EscalationStep {
  routeType: string;
  routeRole?: string;
  delayMinutes: number;
  message: string;
}

export interface EscalationBlock {
  id: string;
  projectId: string;
  createdById: string;
  name: string;
  description: string | null;
  triggerType: string;
  deadlineWarningDays: number | null;
  outputThreshold: number | null;
  outputPeriodDays: number | null;
  targetType: string;
  targetSquadId: string | null;
  targetRole: string | null;
  escalationSteps: EscalationStep[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Blocker {
  id: string;
  projectId: string;
  reportedById: string;
  taskId: string | null;
  description: string;
  status: string;
  resolvedById: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
