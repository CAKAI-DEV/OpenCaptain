export interface GrantVisibilityInput {
  granteeUserId: string;
  squadId: string;
  grantedById: string;
  expiresAt?: Date;
}

export interface UserVisibilityContext {
  isAdmin: boolean;
  isPM: boolean;
  isRestricted: boolean;
  visibleSquadIds: string[];
  visibleProjectIds: string[];
}
