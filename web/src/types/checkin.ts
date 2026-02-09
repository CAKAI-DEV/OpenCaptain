export interface CheckInTemplate {
  id: string;
  name: string;
  description: string;
  questions: string[];
}

export interface CheckInBlock {
  id: string;
  projectId: string;
  name: string;
  templateId: string;
  cronExpression: string;
  timezone: string;
  targetSquadId: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
