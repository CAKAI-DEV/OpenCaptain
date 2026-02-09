export interface Squad {
  id: string;
  projectId: string;
  name: string;
  parentSquadId: string | null;
  leadUserId: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Squad[];
  subSquads?: Squad[];
  members?: SquadMember[];
}

export interface SquadMember {
  id: string;
  userId: string;
  squadId: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
}
