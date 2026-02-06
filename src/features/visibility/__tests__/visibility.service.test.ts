import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../../shared/db';
import { connectRedis, disconnectRedis } from '../../../shared/lib/redis';
import {
  buildVisibilityContext,
  computeVisibleSquads,
  getVisibilityGrants,
  getVisibilityGrantsWithSquads,
  grantVisibility,
  loadUserContext,
  revokeVisibility,
} from '../visibility.service';

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

// Helper to create test squad
async function createTestSquad(projectId: string, name = 'Test Squad') {
  const [squad] = await db.insert(schema.squads).values({ projectId, name }).returning();
  if (!squad) throw new Error('Failed to create squad');
  return squad;
}

describe('grantVisibility', () => {
  test('creates visibility grant', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    const grant = await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
    });

    expect(grant).toBeDefined();
    expect(grant?.granteeUserId).toBe(grantee.id);
    expect(grant?.squadId).toBe(squad.id);
    expect(grant?.grantedById).toBe(granter.id);
  });

  test('creates grant with expiration date', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const grant = await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
      expiresAt,
    });

    expect(grant?.expiresAt).toEqual(expiresAt);
  });

  test('upserts existing grant (updates expiration)', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    // First grant
    await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
    });

    // Update with new expiration
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
      expiresAt: newExpiry,
    });

    // Should only have one grant
    const grants = await db.query.visibilityGrants.findMany({
      where: (g, { eq }) => eq(g.granteeUserId, grantee.id),
    });
    expect(grants).toHaveLength(1);
    expect(grants[0]?.expiresAt).toEqual(newExpiry);
  });
});

describe('revokeVisibility', () => {
  test('removes visibility grant', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
    });

    await revokeVisibility(grantee.id, squad.id);

    const grants = await getVisibilityGrants(grantee.id);
    expect(grants).toHaveLength(0);
  });

  test('does nothing when grant does not exist', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    // Should not throw when trying to revoke non-existent grant
    await revokeVisibility(user.id, squad.id);
  });
});

describe('getVisibilityGrants', () => {
  test('returns active grants for user', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad1 = await createTestSquad(project.id, 'Squad 1');
    const squad2 = await createTestSquad(project.id, 'Squad 2');

    await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad1.id,
      grantedById: granter.id,
    });
    await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad2.id,
      grantedById: granter.id,
    });

    const grants = await getVisibilityGrants(grantee.id);

    expect(grants).toHaveLength(2);
    const squadIds = grants.map((g) => g.squadId);
    expect(squadIds).toContain(squad1.id);
    expect(squadIds).toContain(squad2.id);
  });

  test('excludes expired grants', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    // Create expired grant directly in DB
    await db.insert(schema.visibilityGrants).values({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
      expiresAt: new Date(Date.now() - 1000), // Already expired
    });

    const grants = await getVisibilityGrants(grantee.id);

    expect(grants).toHaveLength(0);
  });

  test('returns empty array when no grants', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    const grants = await getVisibilityGrants(user.id);

    expect(grants).toHaveLength(0);
  });
});

describe('getVisibilityGrantsWithSquads', () => {
  test('returns grants with squad details', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id, 'Engineering');

    await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
    });

    const grants = await getVisibilityGrantsWithSquads(grantee.id);

    expect(grants).toHaveLength(1);
    expect(grants[0]?.squad.id).toBe(squad.id);
    expect(grants[0]?.squad.name).toBe('Engineering');
    expect(grants[0]?.squad.projectId).toBe(project.id);
  });
});

describe('loadUserContext', () => {
  test('loads project memberships', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    await db.insert(schema.projectMembers).values({
      projectId: project.id,
      userId: user.id,
      role: 'admin',
    });

    const context = await loadUserContext(user.id, org.id);

    expect(context.id).toBe(user.id);
    expect(context.orgId).toBe(org.id);
    expect(context.projectRoles).toHaveLength(1);
    expect(context.projectRoles[0]?.projectId).toBe(project.id);
    expect(context.projectRoles[0]?.role).toBe('admin');
  });

  test('loads squad memberships with isLead flag', async () => {
    const org = await createTestOrg();
    const lead = await createTestUser(org.id, 'lead@example.com');
    const member = await createTestUser(org.id, 'member@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    // Set lead on squad
    await db
      .update(schema.squads)
      .set({ leadUserId: lead.id })
      .where(eq(schema.squads.id, squad.id));

    // Add both as members
    await db.insert(schema.squadMembers).values({ squadId: squad.id, userId: lead.id });
    await db.insert(schema.squadMembers).values({ squadId: squad.id, userId: member.id });

    const leadContext = await loadUserContext(lead.id, org.id);
    const memberContext = await loadUserContext(member.id, org.id);

    expect(leadContext.squadMemberships).toHaveLength(1);
    expect(leadContext.squadMemberships[0]?.isLead).toBe(true);

    expect(memberContext.squadMemberships).toHaveLength(1);
    expect(memberContext.squadMemberships[0]?.isLead).toBe(false);
  });

  test('loads visibility grants', async () => {
    const org = await createTestOrg();
    const granter = await createTestUser(org.id, 'granter@example.com');
    const grantee = await createTestUser(org.id, 'grantee@example.com');
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    await grantVisibility({
      granteeUserId: grantee.id,
      squadId: squad.id,
      grantedById: granter.id,
    });

    const context = await loadUserContext(grantee.id, org.id);

    expect(context.visibilityGrants).toHaveLength(1);
    expect(context.visibilityGrants[0]?.squadId).toBe(squad.id);
  });

  test('sets restrictedToSquad to false by default', async () => {
    const org = await createTestOrg();
    const user = await createTestUser(org.id);

    const context = await loadUserContext(user.id, org.id);

    expect(context.restrictedToSquad).toBe(false);
  });
});

describe('computeVisibleSquads', () => {
  test('returns empty array for admin (all visible)', () => {
    const context = {
      id: 'user-1',
      orgId: 'org-1',
      projectRoles: [{ projectId: 'project-1', role: 'admin' }],
      squadMemberships: [],
      visibilityGrants: [],
      restrictedToSquad: false,
    };

    const visible = computeVisibleSquads(context);

    expect(visible).toHaveLength(0); // Empty = all visible
  });

  test('returns empty array for PM (all visible)', () => {
    const context = {
      id: 'user-1',
      orgId: 'org-1',
      projectRoles: [{ projectId: 'project-1', role: 'pm' }],
      squadMemberships: [],
      visibilityGrants: [],
      restrictedToSquad: false,
    };

    const visible = computeVisibleSquads(context);

    expect(visible).toHaveLength(0); // Empty = all visible
  });

  test('returns empty array for unrestricted user (all visible)', () => {
    const context = {
      id: 'user-1',
      orgId: 'org-1',
      projectRoles: [{ projectId: 'project-1', role: 'member' }],
      squadMemberships: [{ squadId: 'squad-1', isLead: false }],
      visibilityGrants: [],
      restrictedToSquad: false,
    };

    const visible = computeVisibleSquads(context);

    expect(visible).toHaveLength(0); // Empty = all visible for unrestricted
  });

  test('returns own squads + granted squads for restricted user', () => {
    const context = {
      id: 'user-1',
      orgId: 'org-1',
      projectRoles: [{ projectId: 'project-1', role: 'member' }],
      squadMemberships: [
        { squadId: 'squad-1', isLead: false },
        { squadId: 'squad-2', isLead: false },
      ],
      visibilityGrants: [{ squadId: 'squad-3' }],
      restrictedToSquad: true,
    };

    const visible = computeVisibleSquads(context);

    expect(visible).toHaveLength(3);
    expect(visible).toContain('squad-1');
    expect(visible).toContain('squad-2');
    expect(visible).toContain('squad-3');
  });

  test('deduplicates when squad is both owned and granted', () => {
    const context = {
      id: 'user-1',
      orgId: 'org-1',
      projectRoles: [{ projectId: 'project-1', role: 'member' }],
      squadMemberships: [{ squadId: 'squad-1', isLead: false }],
      visibilityGrants: [{ squadId: 'squad-1' }], // Same squad granted
      restrictedToSquad: true,
    };

    const visible = computeVisibleSquads(context);

    expect(visible).toHaveLength(1);
    expect(visible).toContain('squad-1');
  });
});

describe('buildVisibilityContext', () => {
  test('builds complete visibility context for admin', async () => {
    const org = await createTestOrg();
    const admin = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    await db.insert(schema.projectMembers).values({
      projectId: project.id,
      userId: admin.id,
      role: 'admin',
    });

    const context = await buildVisibilityContext(admin.id, org.id);

    expect(context.isAdmin).toBe(true);
    expect(context.isPM).toBe(false);
    expect(context.isRestricted).toBe(false);
    expect(context.visibleSquadIds).toHaveLength(0); // All visible
    expect(context.visibleProjectIds).toContain(project.id);
  });

  test('builds complete visibility context for PM', async () => {
    const org = await createTestOrg();
    const pm = await createTestUser(org.id);
    const project = await createTestProject(org.id);

    await db.insert(schema.projectMembers).values({
      projectId: project.id,
      userId: pm.id,
      role: 'pm',
    });

    const context = await buildVisibilityContext(pm.id, org.id);

    expect(context.isAdmin).toBe(false);
    expect(context.isPM).toBe(true);
    expect(context.visibleSquadIds).toHaveLength(0); // All visible
  });

  test('builds complete visibility context for regular member', async () => {
    const org = await createTestOrg();
    const member = await createTestUser(org.id);
    const project = await createTestProject(org.id);
    const squad = await createTestSquad(project.id);

    await db.insert(schema.projectMembers).values({
      projectId: project.id,
      userId: member.id,
      role: 'member',
    });

    await db.insert(schema.squadMembers).values({
      squadId: squad.id,
      userId: member.id,
    });

    const context = await buildVisibilityContext(member.id, org.id);

    expect(context.isAdmin).toBe(false);
    expect(context.isPM).toBe(false);
    // Default is unrestricted, so visibleSquadIds should be empty (all visible)
    expect(context.visibleSquadIds).toHaveLength(0);
  });
});
