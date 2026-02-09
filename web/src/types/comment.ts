export interface Comment {
  id: string;
  targetType: 'task' | 'deliverable';
  targetId: string;
  userId: string;
  email?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
