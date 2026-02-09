export interface Squad {
  id: string;
  projectId: string;
  name: string;
  parentSquadId: string | null;
  leadUserId: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Squad[];
}

export interface SquadMember {
  userId: string;
  email: string;
  squadId: string;
  joinedAt: string;
}
