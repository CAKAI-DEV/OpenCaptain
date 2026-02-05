export interface CreateInvitationInput {
  orgId: string;
  email: string;
  invitedById: string;
  role?: string;
}

export interface CreateLinkInput {
  orgId: string;
  createdById: string;
  role?: string;
}

export type InvitationResult =
  | { type: 'invited'; email: string }
  | { type: 'existing'; userId: string };

export interface ShareableLinkResult {
  id: string;
  url: string;
  expiresAt: Date;
}

export type AcceptResult = { success: true; orgId: string } | { success: false; error: string };
