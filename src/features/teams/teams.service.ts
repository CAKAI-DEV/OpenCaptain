import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { ApiError } from '../../shared/middleware/error-handler';
import type {
  AddSquadMemberInput,
  CreateSquadInput,
  SquadBasic,
  SquadMember,
  SquadWithHierarchy,
  UpdateSquadInput,
} from './teams.types';

/**
 * Creates a new squad. If parentSquadId is provided, validates that:
 * 1. Parent exists
 * 2. Parent has no parent itself (enforces 1-level nesting limit)
 */
export async function createSquad(input: CreateSquadInput): Promise<SquadBasic> {
  // If parentSquadId is provided, verify nesting constraints
  if (input.parentSquadId) {
    const parentSquad = await db.query.squads.findFirst({
      where: eq(schema.squads.id, input.parentSquadId),
    });

    if (!parentSquad) {
      throw new ApiError(
        404,
        'squads/parent-not-found',
        'Parent Squad Not Found',
        'The specified parent squad does not exist'
      );
    }

    // Enforce 1-level nesting limit
    if (parentSquad.parentSquadId !== null) {
      throw new ApiError(
        400,
        'squads/nesting-limit',
        'Nesting Limit Exceeded',
        'Squads can only be nested one level deep. Sub-sub-squads are not allowed.'
      );
    }
  }

  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, input.projectId),
  });

  if (!project) {
    throw new ApiError(
      404,
      'squads/project-not-found',
      'Project Not Found',
      'The specified project does not exist'
    );
  }

  // Verify lead user exists if provided
  if (input.leadUserId) {
    const leadUser = await db.query.users.findFirst({
      where: eq(schema.users.id, input.leadUserId),
    });

    if (!leadUser) {
      throw new ApiError(
        404,
        'squads/lead-not-found',
        'Squad Lead Not Found',
        'The specified lead user does not exist'
      );
    }
  }

  const result = await db
    .insert(schema.squads)
    .values({
      projectId: input.projectId,
      name: input.name,
      parentSquadId: input.parentSquadId || null,
      leadUserId: input.leadUserId || null,
    })
    .returning();

  const squad = result[0];
  if (!squad) {
    throw new ApiError(
      500,
      'squads/creation-failed',
      'Squad Creation Failed',
      'Failed to create squad'
    );
  }

  return squad;
}

/**
 * Gets the squad hierarchy for a project.
 * Returns top-level squads with nested subSquads arrays.
 */
export async function getSquadHierarchy(projectId: string): Promise<SquadWithHierarchy[]> {
  // Get all squads for the project
  const allSquads = await db.query.squads.findMany({
    where: eq(schema.squads.projectId, projectId),
  });

  // If no squads, return empty array early
  if (allSquads.length === 0) {
    return [];
  }

  // Get members for all squads in one query - need to fetch for each squad
  const membersBySquad: Record<string, SquadMember[]> = {};
  for (const squad of allSquads) {
    const squadMembersResult = await db.query.squadMembers.findMany({
      where: eq(schema.squadMembers.squadId, squad.id),
    });

    // Fetch user details for each member
    const members: SquadMember[] = [];
    for (const sm of squadMembersResult) {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, sm.userId),
      });
      if (user) {
        members.push({
          id: sm.id,
          squadId: sm.squadId,
          userId: sm.userId,
          createdAt: sm.createdAt,
          user: {
            id: user.id,
            email: user.email,
          },
        });
      }
    }
    membersBySquad[squad.id] = members;
  }

  // Build hierarchy - separate top-level and sub-squads
  const topLevelSquads: SquadWithHierarchy[] = [];
  const subSquadMap = new Map<string, SquadWithHierarchy[]>();

  for (const squad of allSquads) {
    const squadWithHierarchy: SquadWithHierarchy = {
      ...squad,
      subSquads: [],
      members: membersBySquad[squad.id] || [],
    };

    if (squad.parentSquadId === null) {
      topLevelSquads.push(squadWithHierarchy);
    } else {
      const existing = subSquadMap.get(squad.parentSquadId) || [];
      existing.push(squadWithHierarchy);
      subSquadMap.set(squad.parentSquadId, existing);
    }
  }

  // Attach sub-squads to their parents
  for (const topSquad of topLevelSquads) {
    topSquad.subSquads = subSquadMap.get(topSquad.id) || [];
  }

  return topLevelSquads;
}

/**
 * Gets a single squad by ID
 */
export async function getSquad(squadId: string): Promise<SquadBasic | null> {
  const squad = await db.query.squads.findFirst({
    where: eq(schema.squads.id, squadId),
  });

  return squad || null;
}

/**
 * Updates a squad. Cannot change projectId or parentSquadId.
 */
export async function updateSquad(squadId: string, updates: UpdateSquadInput): Promise<SquadBasic> {
  const existing = await db.query.squads.findFirst({
    where: eq(schema.squads.id, squadId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'squads/not-found',
      'Squad Not Found',
      'The specified squad does not exist'
    );
  }

  // Verify lead user exists if provided
  if (updates.leadUserId) {
    const leadUser = await db.query.users.findFirst({
      where: eq(schema.users.id, updates.leadUserId),
    });

    if (!leadUser) {
      throw new ApiError(
        404,
        'squads/lead-not-found',
        'Squad Lead Not Found',
        'The specified lead user does not exist'
      );
    }
  }

  const result = await db
    .update(schema.squads)
    .set({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.leadUserId !== undefined && { leadUserId: updates.leadUserId }),
      updatedAt: new Date(),
    })
    .where(eq(schema.squads.id, squadId))
    .returning();

  const squad = result[0];
  if (!squad) {
    throw new ApiError(
      500,
      'squads/update-failed',
      'Squad Update Failed',
      'Failed to update squad'
    );
  }

  return squad;
}

/**
 * Deletes a squad (cascades to members via FK)
 */
export async function deleteSquad(squadId: string): Promise<void> {
  const existing = await db.query.squads.findFirst({
    where: eq(schema.squads.id, squadId),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'squads/not-found',
      'Squad Not Found',
      'The specified squad does not exist'
    );
  }

  await db.delete(schema.squads).where(eq(schema.squads.id, squadId));
}

/**
 * Adds a member to a squad
 */
export async function addSquadMember(
  input: AddSquadMemberInput
): Promise<{ id: string; squadId: string; userId: string; createdAt: Date }> {
  // Verify squad exists
  const squad = await db.query.squads.findFirst({
    where: eq(schema.squads.id, input.squadId),
  });

  if (!squad) {
    throw new ApiError(
      404,
      'squads/not-found',
      'Squad Not Found',
      'The specified squad does not exist'
    );
  }

  // Verify user exists
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, input.userId),
  });

  if (!user) {
    throw new ApiError(
      404,
      'squads/user-not-found',
      'User Not Found',
      'The specified user does not exist'
    );
  }

  try {
    const result = await db
      .insert(schema.squadMembers)
      .values({
        squadId: input.squadId,
        userId: input.userId,
      })
      .returning();

    const member = result[0];
    if (!member) {
      throw new ApiError(
        500,
        'squads/member-add-failed',
        'Add Member Failed',
        'Failed to add member to squad'
      );
    }

    return member;
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      throw new ApiError(
        409,
        'squads/member-exists',
        'Member Already Exists',
        'This user is already a member of this squad'
      );
    }
    throw error;
  }
}

/**
 * Removes a member from a squad
 */
export async function removeSquadMember(squadId: string, userId: string): Promise<void> {
  // Find the specific membership
  const allMembers = await db.query.squadMembers.findMany({
    where: eq(schema.squadMembers.squadId, squadId),
  });

  const membership = allMembers.find((m) => m.userId === userId);

  if (!membership) {
    throw new ApiError(
      404,
      'squads/membership-not-found',
      'Membership Not Found',
      'This user is not a member of this squad'
    );
  }

  await db.delete(schema.squadMembers).where(eq(schema.squadMembers.id, membership.id));
}

/**
 * Gets all members of a squad
 */
export async function getSquadMembers(squadId: string): Promise<SquadMember[]> {
  const squad = await db.query.squads.findFirst({
    where: eq(schema.squads.id, squadId),
  });

  if (!squad) {
    throw new ApiError(
      404,
      'squads/not-found',
      'Squad Not Found',
      'The specified squad does not exist'
    );
  }

  const squadMembersResult = await db.query.squadMembers.findMany({
    where: eq(schema.squadMembers.squadId, squadId),
  });

  // Fetch user details for each member
  const members: SquadMember[] = [];
  for (const sm of squadMembersResult) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, sm.userId),
    });
    if (user) {
      members.push({
        id: sm.id,
        squadId: sm.squadId,
        userId: sm.userId,
        createdAt: sm.createdAt,
        user: {
          id: user.id,
          email: user.email,
        },
      });
    }
  }

  return members;
}
