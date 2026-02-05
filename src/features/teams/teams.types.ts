export interface CreateSquadInput {
  projectId: string;
  name: string;
  parentSquadId?: string;
  leadUserId?: string;
}

export interface UpdateSquadInput {
  name?: string;
  leadUserId?: string | null;
}

export interface AddSquadMemberInput {
  squadId: string;
  userId: string;
}

export interface SquadMember {
  id: string;
  squadId: string;
  userId: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
  };
}

export interface SquadWithHierarchy {
  id: string;
  projectId: string;
  name: string;
  parentSquadId: string | null;
  leadUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  subSquads: SquadWithHierarchy[];
  members: SquadMember[];
}

export interface SquadBasic {
  id: string;
  projectId: string;
  name: string;
  parentSquadId: string | null;
  leadUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
