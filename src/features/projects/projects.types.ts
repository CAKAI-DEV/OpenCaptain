export interface CreateProjectInput {
  orgId: string;
  name: string;
  description?: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
