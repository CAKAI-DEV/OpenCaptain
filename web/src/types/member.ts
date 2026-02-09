export type ProjectRole = 'admin' | 'pm' | 'squad_lead' | 'member';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  reportsToUserId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
  };
}
