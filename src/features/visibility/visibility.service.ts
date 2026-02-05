import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import type { UserContext } from '../../shared/lib/permissions';
import type { GrantVisibilityInput, UserVisibilityContext } from './visibility.types';

/**
 * Grant cross-squad visibility to a user
 */
export async function grantVisibility(input: GrantVisibilityInput) {
  const [grant] = await db
    .insert(schema.visibilityGrants)
    .values({
      granteeUserId: input.granteeUserId,
      squadId: input.squadId,
      grantedById: input.grantedById,
      expiresAt: input.expiresAt,
    })
    .onConflictDoUpdate({
      target: [schema.visibilityGrants.granteeUserId, schema.visibilityGrants.squadId],
      set: { expiresAt: input.expiresAt, grantedById: input.grantedById },
    })
    .returning();

  return grant;
}

/**
 * Revoke visibility grant from a user
 */
export async function revokeVisibility(granteeUserId: string, squadId: string) {
  await db
    .delete(schema.visibilityGrants)
    .where(
      and(
        eq(schema.visibilityGrants.granteeUserId, granteeUserId),
        eq(schema.visibilityGrants.squadId, squadId)
      )
    );
}

/**
 * Get active visibility grants for a user (non-expired)
 */
export async function getVisibilityGrants(userId: string) {
  return db.query.visibilityGrants.findMany({
    where: and(
      eq(schema.visibilityGrants.granteeUserId, userId),
      or(
        isNull(schema.visibilityGrants.expiresAt),
        gt(schema.visibilityGrants.expiresAt, new Date())
      )
    ),
  });
}

/**
 * Get visibility grants with squad details
 */
export async function getVisibilityGrantsWithSquads(userId: string) {
  const grants = await getVisibilityGrants(userId);
  const squadsWithDetails = [];

  for (const grant of grants) {
    const squad = await db.query.squads.findFirst({
      where: eq(schema.squads.id, grant.squadId),
    });

    if (squad) {
      squadsWithDetails.push({
        ...grant,
        squad: {
          id: squad.id,
          name: squad.name,
          projectId: squad.projectId,
        },
      });
    }
  }

  return squadsWithDetails;
}

/**
 * Load full user context from database for CASL abilities
 */
export async function loadUserContext(userId: string, orgId: string): Promise<UserContext> {
  // Get project memberships
  const projectMemberships = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.userId, userId),
  });

  // Get squad memberships
  const squadMemberships = await db.query.squadMembers.findMany({
    where: eq(schema.squadMembers.userId, userId),
  });

  // Get squad details to determine if user is lead
  const squadMembershipsWithLead: Array<{ squadId: string; isLead: boolean }> = [];
  for (const sm of squadMemberships) {
    const squad = await db.query.squads.findFirst({
      where: eq(schema.squads.id, sm.squadId),
    });
    squadMembershipsWithLead.push({
      squadId: sm.squadId,
      isLead: squad?.leadUserId === userId,
    });
  }

  // Get visibility grants (non-expired)
  const grants = await getVisibilityGrants(userId);

  // Check if user is restricted (future: from user_settings table)
  // For now, default to NOT restricted (per CONTEXT decision)
  const restrictedToSquad = false;

  return {
    id: userId,
    orgId,
    projectRoles: projectMemberships.map((pm) => ({
      projectId: pm.projectId,
      role: pm.role,
    })),
    squadMemberships: squadMembershipsWithLead,
    visibilityGrants: grants.map((g) => ({ squadId: g.squadId })),
    restrictedToSquad,
  };
}

/**
 * Compute the list of visible squad IDs for a user.
 * Returns empty array for admin/PM (meaning all squads visible).
 */
export function computeVisibleSquads(userContext: UserContext): string[] {
  // Admin/PM see all - handled at query level
  if (userContext.projectRoles.some((pr) => ['admin', 'pm'].includes(pr.role))) {
    return []; // Empty means "all" for admin/PM
  }

  if (!userContext.restrictedToSquad) {
    return []; // Not restricted, sees all in project
  }

  // Restricted: own squads + granted squads
  const ownSquads = userContext.squadMemberships.map((sm) => sm.squadId);
  const grantedSquads = userContext.visibilityGrants.map((vg) => vg.squadId);
  return [...new Set([...ownSquads, ...grantedSquads])];
}

/**
 * Build user visibility context for API response
 */
export async function buildVisibilityContext(
  userId: string,
  orgId: string
): Promise<UserVisibilityContext> {
  const userContext = await loadUserContext(userId, orgId);

  const isAdmin = userContext.projectRoles.some((pr) => pr.role === 'admin');
  const isPM = userContext.projectRoles.some((pr) => pr.role === 'pm');
  const visibleSquadIds = computeVisibleSquads(userContext);
  const visibleProjectIds = userContext.projectRoles.map((pr) => pr.projectId);

  return {
    isAdmin,
    isPM,
    isRestricted: userContext.restrictedToSquad,
    visibleSquadIds,
    visibleProjectIds,
  };
}
