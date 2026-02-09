export type ProjectRole = 'admin' | 'pm' | 'squad_lead' | 'member';

export interface ProjectMember {
  userId: string;
  email: string;
  role: ProjectRole;
  reportsToUserId: string | null;
  joinedAt: string;
}
