export interface AssignRoleInput {
  projectId: string;
  userId: string;
  role: string;
  reportsToUserId?: string;
}

export interface ProjectMemberWithUser {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  reportsToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
  };
}

export interface UserProjectRole {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  reportsToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
  };
}
