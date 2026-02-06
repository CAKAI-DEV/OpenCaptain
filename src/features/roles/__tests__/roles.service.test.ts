import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { hash } from '@node-rs/argon2';
import { db, schema } from '../../../shared/db';
import { connectRedis, disconnectRedis } from '../../../shared/lib/redis';
import {
  assignRole,
  getDefaultReportsTo,
  getProjectMembers,
  getUserRoles,
  removeFromProject,
} from '../roles.service';

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// Setup
beforeAll(async () => {
  await connectRedis();
});

afterEach(async () => {
  // Delete in order: tables with FKs first, then parent tables
  await db.delete(schema.invitations);
  await db.delete(schema.inviteLinks);
  await db.delete(schema.visibilityGrants);
  await db.delete(schema.magicLinks);
  await db.delete(schema.squadMembers);
  await db.delete(schema.squads);
  await db.delete(schema.projectMembers);
  await db.delete(schema.projects);
  await db.delete(schema.refreshTokens);
  await db.delete(schema.users);
  await db.delete(schema.organizations);
});

afterAll(async () => {
  await disconnectRedis();
});

// Helper to create test organization
async function createTestOrg(name = 'Test Org') {
  const [org] = await db.insert(schema.organizations).values({ name }).returning();
  if (!org) throw new Error('Failed to create org');
  return org;
}

// Helper to create test user
async function createTestUser(orgId: string, email = 'test@example.com') {
  const [user] = await db
    .insert(schema.users)
    .values({
      orgId,
      email,
      passwordHash: await hash('password123', ARGON2_OPTIONS),
      emailVerified: true,
    })
    .returning();
  if (!user) throw new Error('Failed to create user');
  return user;
}

// Helper to create test project
async function createTestProject(orgId: string, name = 'Test Project') {
  const [project] = await db.insert(schema.projects).values({ orgId, name }).returning();
  if (!project) throw new Error('Failed to create project');
  return project;
}

describe('assignRole', () => {
  test('assigns new role to user in project', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    const result = await assignRole({
      projectId: project.id,
      userId: user.id,
      role: 'member',
    });

    expect(result.id).toBeString();
    expect(result.projectId).toBe(project.id);
    expect(result.userId).toBe(user.id);
    expect(result.role).toBe('member');
    expect(result.reportsToUserId).toBeNull();
  });

  test('updates existing role (upsert)', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    // Assign initial role
    await assignRole({
      projectId: project.id,
      userId: user.id,
      role: 'member',
    });

    // Update to different role
    const result = await assignRole({
      projectId: project.id,
      userId: user.id,
      role: 'squad_lead',
    });

    expect(result.role).toBe('squad_lead');

    // Verify only one membership exists
    const members = await db.query.projectMembers.findMany();
    expect(members).toHaveLength(1);
  });

  test('throws error for invalid role', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    await expect(
      assignRole({
        projectId: project.id,
        userId: user.id,
        role: 'invalid_role',
      })
    ).rejects.toThrow();
  });

  test('throws error for non-existent project', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    await expect(
      assignRole({
        projectId: '00000000-0000-0000-0000-000000000000',
        userId: user.id,
        role: 'member',
      })
    ).rejects.toThrow();
  });

  test('throws error for non-existent user', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    await expect(
      assignRole({
        projectId: project.id,
        userId: '00000000-0000-0000-0000-000000000000',
        role: 'member',
      })
    ).rejects.toThrow();
  });

  test('sets explicit reportsToUserId when provided', async () => {
    const org = await createTestOrg();
    const manager = await createTestUser(org.id, 'manager@example.com');
    const user = await createTestUser(org.id, 'user@example.com');
    const project = await createTestProject(org.id);

    const result = await assignRole({
      projectId: project.id,
      userId: user.id,
      role: 'member',
      reportsToUserId: manager.id,
    });

    expect(result.reportsToUserId).toBe(manager.id);
  });
});

describe('removeFromProject', () => {
  test('removes user from project', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    await assignRole({ projectId: project.id, userId: user.id, role: 'member' });
    await removeFromProject(project.id, user.id);

    const members = await db.query.projectMembers.findMany();
    expect(members).toHaveLength(0);
  });

  test('throws error when user not in project', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    await expect(removeFromProject(project.id, user.id)).rejects.toThrow();
  });
});

describe('getProjectMembers', () => {
  test('returns all members with user details', async () => {
    const org = await createTestOrg();
    const user1 = await createTestUser(org.id, 'user1@example.com');
    const user2 = await createTestUser(org.id, 'user2@example.com');
    const project = await createTestProject(org.id);

    await assignRole({ projectId: project.id, userId: user1.id, role: 'admin' });
    await assignRole({ projectId: project.id, userId: user2.id, role: 'member' });

    const members = await getProjectMembers(project.id);

    expect(members).toHaveLength(2);
    expect(members[0]?.user.email).toBeString();
    expect(members[1]?.user.email).toBeString();

    const emails = members.map((m) => m.user.email);
    expect(emails).toContain('user1@example.com');
    expect(emails).toContain('user2@example.com');
  });

  test('returns empty array when no members', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    const members = await getProjectMembers(project.id);

    expect(members).toHaveLength(0);
  });

  test('throws error for non-existent project', async () => {
    await expect(getProjectMembers('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});

describe('getUserRoles', () => {
  test('returns all project roles for user', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project1 = await createTestProject(org.id, 'Project 1');
    const project2 = await createTestProject(org.id, 'Project 2');

    await assignRole({ projectId: project1.id, userId: user.id, role: 'admin' });
    await assignRole({ projectId: project2.id, userId: user.id, role: 'member' });

    const roles = await getUserRoles(user.id);

    expect(roles).toHaveLength(2);

    const projectNames = roles.map((r) => r.project.name);
    expect(projectNames).toContain('Project 1');
    expect(projectNames).toContain('Project 2');

    const roleNames = roles.map((r) => r.role);
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('member');
  });

  test('returns empty array when user has no roles', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    const roles = await getUserRoles(user.id);

    expect(roles).toHaveLength(0);
  });

  test('throws error for non-existent user', async () => {
    await expect(getUserRoles('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});

describe('getDefaultReportsTo', () => {
  test('returns null when no higher authority exists', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    // Only has member
    await assignRole({ projectId: project.id, userId: user.id, role: 'member' });

    const reportsTo = await getDefaultReportsTo(project.id, 'member');

    expect(reportsTo).toBeNull();
  });

  test('returns closest higher tier member', async () => {
    const org = await createTestOrg();
    const admin = await createTestUser(org.id, 'admin@example.com');
    const pm = await createTestUser(org.id, 'pm@example.com');
    const squadLead = await createTestUser(org.id, 'lead@example.com');
    const project = await createTestProject(org.id);

    await assignRole({ projectId: project.id, userId: admin.id, role: 'admin' });
    await assignRole({ projectId: project.id, userId: pm.id, role: 'pm' });
    await assignRole({ projectId: project.id, userId: squadLead.id, role: 'squad_lead' });

    // Member should report to squad_lead (closest higher tier)
    const memberReportsTo = await getDefaultReportsTo(project.id, 'member');
    expect(memberReportsTo).toBe(squadLead.id);

    // Squad lead should report to pm (closest higher tier)
    const leadReportsTo = await getDefaultReportsTo(project.id, 'squad_lead');
    expect(leadReportsTo).toBe(pm.id);

    // PM should report to admin
    const pmReportsTo = await getDefaultReportsTo(project.id, 'pm');
    expect(pmReportsTo).toBe(admin.id);
  });

  test('returns admin when only admin exists above', async () => {
    const org = await createTestOrg();
    const admin = await createTestUser(org.id, 'admin@example.com');
    const project = await createTestProject(org.id);

    await assignRole({ projectId: project.id, userId: admin.id, role: 'admin' });

    // Member should report to admin (only higher tier available)
    const reportsTo = await getDefaultReportsTo(project.id, 'member');
    expect(reportsTo).toBe(admin.id);
  });

  test('auto-assigns reportsTo when adding new member', async () => {
    const org = await createTestOrg();
    const lead = await createTestUser(org.id, 'lead@example.com');
    const member = await createTestUser(org.id, 'member@example.com');
    const project = await createTestProject(org.id);

    // First assign squad_lead
    await assignRole({ projectId: project.id, userId: lead.id, role: 'squad_lead' });

    // Then add member without explicit reportsTo
    const result = await assignRole({
      projectId: project.id,
      userId: member.id,
      role: 'member',
    });

    // Should auto-assign to squad_lead
    expect(result.reportsToUserId).toBe(lead.id);
  });
});
