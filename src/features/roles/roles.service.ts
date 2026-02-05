import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { getRoleTier, isValidRole } from '../../shared/lib/permissions';
import { ApiError } from '../../shared/middleware/error-handler';
import type { AssignRoleInput, ProjectMemberWithUser, UserProjectRole } from './roles.types';

/**
 * Assigns a role to a user in a project.
 * If the user already has a role in the project, it updates the role.
 * If reportsToUserId is not provided, computes the default based on role tier hierarchy.
 */
export async function assignRole(input: AssignRoleInput): Promise<{
  id: string;
  projectId: string;
  userId: string;
  role: string;
  reportsToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  // Validate role
  if (!isValidRole(input.role)) {
    throw new ApiError(
      400,
      'roles/invalid-role',
      'Invalid Role',
      `The role '${input.role}' is not valid. Valid roles are: admin, pm, squad_lead, member`
    );
  }

  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, input.projectId),
  });

  if (!project) {
    throw new ApiError(
      404,
      'roles/project-not-found',
      'Project Not Found',
      'The specified project does not exist'
    );
  }

  // Verify user exists
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, input.userId),
  });

  if (!user) {
    throw new ApiError(
      404,
      'roles/user-not-found',
      'User Not Found',
      'The specified user does not exist'
    );
  }

  // Verify reportsToUserId if provided
  if (input.reportsToUserId) {
    const reportsToUser = await db.query.users.findFirst({
      where: eq(schema.users.id, input.reportsToUserId),
    });

    if (!reportsToUser) {
      throw new ApiError(
        404,
        'roles/reports-to-not-found',
        'Reports To User Not Found',
        'The specified reports-to user does not exist'
      );
    }
  }

  // If reportsToUserId not provided, compute default based on role hierarchy
  let reportsToUserId = input.reportsToUserId || null;
  if (!reportsToUserId && input.role !== 'admin') {
    const defaultReportsTo = await getDefaultReportsTo(input.projectId, input.role);
    reportsToUserId = defaultReportsTo;
  }

  // Check if user already has a role in this project
  const existing = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, input.projectId),
      eq(schema.projectMembers.userId, input.userId)
    ),
  });

  if (existing) {
    // Update existing role
    const result = await db
      .update(schema.projectMembers)
      .set({
        role: input.role,
        reportsToUserId,
        updatedAt: new Date(),
      })
      .where(eq(schema.projectMembers.id, existing.id))
      .returning();

    const member = result[0];
    if (!member) {
      throw new ApiError(500, 'roles/update-failed', 'Role Update Failed', 'Failed to update role');
    }

    return member;
  }

  // Insert new role
  const result = await db
    .insert(schema.projectMembers)
    .values({
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      reportsToUserId,
    })
    .returning();

  const member = result[0];
  if (!member) {
    throw new ApiError(
      500,
      'roles/assign-failed',
      'Role Assignment Failed',
      'Failed to assign role'
    );
  }

  return member;
}

/**
 * Removes a user from a project
 */
export async function removeFromProject(projectId: string, userId: string): Promise<void> {
  const existing = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, projectId),
      eq(schema.projectMembers.userId, userId)
    ),
  });

  if (!existing) {
    throw new ApiError(
      404,
      'roles/membership-not-found',
      'Project Membership Not Found',
      'This user is not a member of this project'
    );
  }

  await db.delete(schema.projectMembers).where(eq(schema.projectMembers.id, existing.id));
}

/**
 * Gets all members of a project with their user details
 */
export async function getProjectMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });

  if (!project) {
    throw new ApiError(
      404,
      'roles/project-not-found',
      'Project Not Found',
      'The specified project does not exist'
    );
  }

  const members = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.projectId, projectId),
  });

  // Fetch user details for each member
  const membersWithUsers: ProjectMemberWithUser[] = [];
  for (const member of members) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, member.userId),
    });
    if (user) {
      membersWithUsers.push({
        ...member,
        user: {
          id: user.id,
          email: user.email,
        },
      });
    }
  }

  return membersWithUsers;
}

/**
 * Gets all project roles for a user across all projects
 */
export async function getUserRoles(userId: string): Promise<UserProjectRole[]> {
  // Verify user exists
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    throw new ApiError(
      404,
      'roles/user-not-found',
      'User Not Found',
      'The specified user does not exist'
    );
  }

  const memberships = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.userId, userId),
  });

  // Fetch project details for each membership
  const rolesWithProjects: UserProjectRole[] = [];
  for (const membership of memberships) {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, membership.projectId),
    });
    if (project) {
      rolesWithProjects.push({
        ...membership,
        project: {
          id: project.id,
          name: project.name,
        },
      });
    }
  }

  return rolesWithProjects;
}

/**
 * Finds the default reports-to user for a given role in a project.
 * Looks for the lowest-tier user that has a lower tier number (higher authority)
 * than the given role.
 */
export async function getDefaultReportsTo(projectId: string, role: string): Promise<string | null> {
  const roleTier = getRoleTier(role);

  // Get all members with lower tier (higher authority) in this project
  const members = await db.query.projectMembers.findMany({
    where: eq(schema.projectMembers.projectId, projectId),
  });

  // Filter to members with lower tier (higher authority)
  const higherAuthorityMembers = members.filter((m) => {
    const memberTier = getRoleTier(m.role);
    return memberTier < roleTier;
  });

  if (higherAuthorityMembers.length === 0) {
    return null;
  }

  // Find the one with the highest tier among them (closest authority level)
  // This means the lowest authority among the higher authority members
  const firstMember = higherAuthorityMembers[0];
  if (!firstMember) {
    return null;
  }

  let closestMember = firstMember;
  let closestTier = getRoleTier(closestMember.role);

  for (const member of higherAuthorityMembers) {
    const memberTier = getRoleTier(member.role);
    if (memberTier > closestTier) {
      closestMember = member;
      closestTier = memberTier;
    }
  }

  return closestMember.userId;
}
