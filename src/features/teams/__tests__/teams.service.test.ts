import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { hash } from '@node-rs/argon2';
import { db, schema } from '../../../shared/db';
import { connectRedis, disconnectRedis } from '../../../shared/lib/redis';
import {
  addSquadMember,
  createSquad,
  deleteSquad,
  getSquad,
  getSquadHierarchy,
  getSquadMembers,
  removeSquadMember,
  updateSquad,
} from '../teams.service';

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

describe('createSquad', () => {
  test('creates top-level squad', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    const squad = await createSquad({
      projectId: project.id,
      name: 'Engineering',
    });

    expect(squad.id).toBeString();
    expect(squad.projectId).toBe(project.id);
    expect(squad.name).toBe('Engineering');
    expect(squad.parentSquadId).toBeNull();
    expect(squad.leadUserId).toBeNull();
  });

  test('creates squad with lead', async () => {
    const org = await createTestOrg();
    const lead = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    const squad = await createSquad({
      projectId: project.id,
      name: 'Frontend',
      leadUserId: lead.id,
    });

    expect(squad.leadUserId).toBe(lead.id);
  });

  test('creates sub-squad (1-level nesting)', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    const parentSquad = await createSquad({
      projectId: project.id,
      name: 'Engineering',
    });

    const subSquad = await createSquad({
      projectId: project.id,
      name: 'Frontend',
      parentSquadId: parentSquad.id,
    });

    expect(subSquad.parentSquadId).toBe(parentSquad.id);
  });

  test('enforces 1-level nesting limit', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    const grandparent = await createSquad({
      projectId: project.id,
      name: 'Engineering',
    });

    const parent = await createSquad({
      projectId: project.id,
      name: 'Frontend',
      parentSquadId: grandparent.id,
    });

    // Trying to create sub-sub-squad should fail
    await expect(
      createSquad({
        projectId: project.id,
        name: 'React Team',
        parentSquadId: parent.id,
      })
    ).rejects.toThrow('Nesting Limit');
  });

  test('throws error for non-existent project', async () => {
    await expect(
      createSquad({
        projectId: '00000000-0000-0000-0000-000000000000',
        name: 'Squad',
      })
    ).rejects.toThrow();
  });

  test('throws error for non-existent parent squad', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    await expect(
      createSquad({
        projectId: project.id,
        name: 'Sub Squad',
        parentSquadId: '00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toThrow();
  });

  test('throws error for non-existent lead user', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    await expect(
      createSquad({
        projectId: project.id,
        name: 'Squad',
        leadUserId: '00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toThrow();
  });
});

describe('getSquadHierarchy', () => {
  test('returns empty array when no squads', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    const hierarchy = await getSquadHierarchy(project.id);

    expect(hierarchy).toHaveLength(0);
  });

  test('returns top-level squads with subSquads nested', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    const engineering = await createSquad({ projectId: project.id, name: 'Engineering' });
    await createSquad({
      projectId: project.id,
      name: 'Frontend',
      parentSquadId: engineering.id,
    });
    await createSquad({
      projectId: project.id,
      name: 'Backend',
      parentSquadId: engineering.id,
    });
    await createSquad({ projectId: project.id, name: 'Design' });

    const hierarchy = await getSquadHierarchy(project.id);

    // Should have 2 top-level squads
    expect(hierarchy).toHaveLength(2);

    const engineeringInHierarchy = hierarchy.find((s) => s.name === 'Engineering');
    const designInHierarchy = hierarchy.find((s) => s.name === 'Design');

    expect(engineeringInHierarchy).toBeDefined();
    expect(engineeringInHierarchy?.subSquads).toHaveLength(2);

    const subSquadNames = engineeringInHierarchy?.subSquads.map((s) => s.name) || [];
    expect(subSquadNames).toContain('Frontend');
    expect(subSquadNames).toContain('Backend');

    expect(designInHierarchy).toBeDefined();
    expect(designInHierarchy?.subSquads).toHaveLength(0);
  });

  test('includes members in squads', async () => {
    const org = await createTestOrg();
    const user1 = await createTestUser(org.id, 'user1@example.com');
    const user2 = await createTestUser(org.id, 'user2@example.com');
    const project = await createTestProject(org.id);

    const squad = await createSquad({ projectId: project.id, name: 'Engineering' });
    await addSquadMember({ squadId: squad.id, userId: user1.id });
    await addSquadMember({ squadId: squad.id, userId: user2.id });

    const hierarchy = await getSquadHierarchy(project.id);

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0]?.members).toHaveLength(2);

    const emails = hierarchy[0]?.members.map((m) => m.user.email) || [];
    expect(emails).toContain('user1@example.com');
    expect(emails).toContain('user2@example.com');
  });

  test('filters by visibleSquadIds when provided', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    const visibleSquad = await createSquad({ projectId: project.id, name: 'Visible' });
    await createSquad({ projectId: project.id, name: 'Hidden' });

    const hierarchy = await getSquadHierarchy(project.id, [visibleSquad.id]);

    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0]?.name).toBe('Visible');
  });

  test('returns all squads when visibleSquadIds is empty (admin/PM)', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);

    await createSquad({ projectId: project.id, name: 'Squad 1' });
    await createSquad({ projectId: project.id, name: 'Squad 2' });

    // Empty array means "all visible"
    const hierarchy = await getSquadHierarchy(project.id, []);

    expect(hierarchy).toHaveLength(2);
  });
});

describe('getSquad', () => {
  test('returns squad when found', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);
    const createdSquad = await createSquad({ projectId: project.id, name: 'Engineering' });

    const squad = await getSquad(createdSquad.id);

    expect(squad).not.toBeNull();
    expect(squad?.id).toBe(createdSquad.id);
    expect(squad?.name).toBe('Engineering');
  });

  test('returns null when squad not found', async () => {
    // Use valid UUID format even though it doesn't exist
    const squad = await getSquad('00000000-0000-0000-0000-000000000000');

    expect(squad).toBeNull();
  });
});

describe('updateSquad', () => {
  test('updates squad name', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Old Name' });

    const updated = await updateSquad(squad.id, { name: 'New Name' });

    expect(updated.name).toBe('New Name');
  });

  test('updates squad lead', async () => {
    const org = await createTestOrg();
    const lead = await createTestUser(org.id);
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    const updated = await updateSquad(squad.id, { leadUserId: lead.id });

    expect(updated.leadUserId).toBe(lead.id);
  });

  test('throws error for non-existent squad', async () => {
    await expect(
      updateSquad('00000000-0000-0000-0000-000000000000', { name: 'New Name' })
    ).rejects.toThrow();
  });

  test('throws error for non-existent lead user', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    await expect(
      updateSquad(squad.id, { leadUserId: '00000000-0000-0000-0000-000000000000' })
    ).rejects.toThrow();
  });
});

describe('deleteSquad', () => {
  test('deletes squad', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    await deleteSquad(squad.id);

    const deleted = await getSquad(squad.id);
    expect(deleted).toBeNull();
  });

  test('throws error for non-existent squad', async () => {
    await expect(deleteSquad('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});

describe('addSquadMember', () => {
  test('adds member to squad', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    const member = await addSquadMember({ squadId: squad.id, userId: user.id });

    expect(member.squadId).toBe(squad.id);
    expect(member.userId).toBe(user.id);
  });

  test('throws error when adding same user twice', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    await addSquadMember({ squadId: squad.id, userId: user.id });

    // Should throw on duplicate - either ApiError or DrizzleError with unique constraint
    await expect(addSquadMember({ squadId: squad.id, userId: user.id })).rejects.toThrow();
  });

  test('throws error for non-existent squad', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    await expect(
      addSquadMember({ squadId: '00000000-0000-0000-0000-000000000000', userId: user.id })
    ).rejects.toThrow();
  });

  test('throws error for non-existent user', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    await expect(
      addSquadMember({ squadId: squad.id, userId: '00000000-0000-0000-0000-000000000000' })
    ).rejects.toThrow();
  });
});

describe('removeSquadMember', () => {
  test('removes member from squad', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    await addSquadMember({ squadId: squad.id, userId: user.id });
    await removeSquadMember(squad.id, user.id);

    const members = await getSquadMembers(squad.id);
    expect(members).toHaveLength(0);
  });

  test('throws error when member not in squad', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    await expect(removeSquadMember(squad.id, user.id)).rejects.toThrow();
  });
});

describe('getSquadMembers', () => {
  test('returns all members with user details', async () => {
    const org = await createTestOrg();
    const user1 = await createTestUser(org.id, 'user1@example.com');
    const user2 = await createTestUser(org.id, 'user2@example.com');
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    await addSquadMember({ squadId: squad.id, userId: user1.id });
    await addSquadMember({ squadId: squad.id, userId: user2.id });

    const members = await getSquadMembers(squad.id);

    expect(members).toHaveLength(2);

    const emails = members.map((m) => m.user.email);
    expect(emails).toContain('user1@example.com');
    expect(emails).toContain('user2@example.com');
  });

  test('returns empty array when no members', async () => {
    const org = await createTestOrg();
    const project = await createTestProject(org.id);
    const squad = await createSquad({ projectId: project.id, name: 'Squad' });

    const members = await getSquadMembers(squad.id);

    expect(members).toHaveLength(0);
  });

  test('throws error for non-existent squad', async () => {
    await expect(getSquadMembers('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});
