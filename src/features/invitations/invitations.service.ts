import { hash, verify } from '@node-rs/argon2';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, schema } from '../../shared/db';
import { env } from '../../shared/lib/env';
import { sendAddedToOrgEmail, sendInvitationEmail } from './invitations.email';
import type {
  AcceptResult,
  CreateInvitationInput,
  CreateLinkInput,
  InvitationResult,
  ShareableLinkResult,
} from './invitations.types';

const INVITE_EXPIRY_DAYS = 7;
const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// Dummy hash for timing attack prevention
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export async function createEmailInvitation(
  input: CreateInvitationInput
): Promise<InvitationResult> {
  const { orgId, email, invitedById, role } = input;

  // Check if user already exists with this email
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (existingUser) {
    // If user exists and is already in this org, they're already a member
    if (existingUser.orgId === orgId) {
      return { type: 'existing', userId: existingUser.id };
    }

    // User exists but in different org - update their org (auto-add per RESEARCH recommendation)
    await db.update(schema.users).set({ orgId }).where(eq(schema.users.id, existingUser.id));

    // Get org name and inviter email for notification
    const org = await db.query.organizations.findFirst({
      where: eq(schema.organizations.id, orgId),
    });
    const inviter = await db.query.users.findFirst({
      where: eq(schema.users.id, invitedById),
    });

    if (org && inviter) {
      await sendAddedToOrgEmail(email, org.name, inviter.email);
    }

    return { type: 'existing', userId: existingUser.id };
  }

  // Generate secure token
  const token = nanoid(32);
  const tokenHash = await hash(token, ARGON2_OPTIONS);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Insert invitation
  await db.insert(schema.invitations).values({
    orgId,
    email,
    tokenHash,
    role,
    invitedById,
    expiresAt,
  });

  // Get org name and inviter email for email
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, orgId),
  });
  const inviter = await db.query.users.findFirst({
    where: eq(schema.users.id, invitedById),
  });

  const orgName = org?.name ?? 'an organization';
  await sendInvitationEmail(email, token, orgName, inviter?.email);

  return { type: 'invited', email };
}

export async function createShareableLink(input: CreateLinkInput): Promise<ShareableLinkResult> {
  const { orgId, createdById, role } = input;

  const token = nanoid(32);
  const tokenHash = await hash(token, ARGON2_OPTIONS);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const [link] = await db
    .insert(schema.inviteLinks)
    .values({
      orgId,
      tokenHash,
      role,
      createdById,
      expiresAt,
    })
    .returning();

  if (!link) {
    throw new Error('Failed to create invite link');
  }

  return {
    id: link.id,
    url: `${env.APP_URL}/join/${token}`,
    expiresAt,
  };
}

export async function acceptInvitation(token: string, userId: string): Promise<AcceptResult> {
  // Query all non-expired, non-accepted invitations
  const invitations = await db.query.invitations.findMany({
    where: and(gt(schema.invitations.expiresAt, new Date()), isNull(schema.invitations.acceptedAt)),
  });

  // Check each invitation's hash against provided token
  for (const inv of invitations) {
    try {
      const isMatch = await verify(inv.tokenHash, token);
      if (isMatch) {
        // Mark as accepted
        await db
          .update(schema.invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(schema.invitations.id, inv.id));

        // Update user's org
        await db.update(schema.users).set({ orgId: inv.orgId }).where(eq(schema.users.id, userId));

        return { success: true, orgId: inv.orgId };
      }
    } catch {}
  }

  // Always do a hash comparison even on no match (timing attack prevention)
  try {
    await verify(DUMMY_HASH, token);
  } catch {
    // Expected to fail
  }

  return { success: false, error: 'Invalid or expired invitation' };
}

export async function acceptInviteLink(token: string, userId: string): Promise<AcceptResult> {
  // Query all non-expired invite links
  const links = await db.query.inviteLinks.findMany({
    where: gt(schema.inviteLinks.expiresAt, new Date()),
  });

  // Check each link's hash against provided token
  for (const link of links) {
    try {
      const isMatch = await verify(link.tokenHash, token);
      if (isMatch) {
        // Increment usage count (links are reusable until expiry)
        await db
          .update(schema.inviteLinks)
          .set({ usageCount: link.usageCount + 1 })
          .where(eq(schema.inviteLinks.id, link.id));

        // Update user's org
        await db.update(schema.users).set({ orgId: link.orgId }).where(eq(schema.users.id, userId));

        return { success: true, orgId: link.orgId };
      }
    } catch {}
  }

  // Always do a hash comparison even on no match (timing attack prevention)
  try {
    await verify(DUMMY_HASH, token);
  } catch {
    // Expected to fail
  }

  return { success: false, error: 'Invalid or expired invite link' };
}
