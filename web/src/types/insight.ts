export interface Insight {
  id: string;
  projectId: string;
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  actionType: string;
  priority: 'low' | 'medium' | 'high';
}
