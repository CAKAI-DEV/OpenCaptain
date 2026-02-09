export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  actorId: string;
  actorEmail?: string;
  projectId: string | null;
  description: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}
