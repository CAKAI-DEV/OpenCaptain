import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db, schema } from '../../../shared/db';
import { connectRedis, disconnectRedis } from '../../../shared/lib/redis';
import { createProject, getProjectById, getProjectsByOrg } from '../projects.service';

// Setup
beforeAll(async () => {
  await connectRedis();
});

// Teardown handled by global tests/setup.ts afterEach

afterAll(async () => {
  await disconnectRedis();
});

// Helper to create test organization
async function createTestOrg(name = 'Test Org') {
  const [org] = await db.insert(schema.organizations).values({ name }).returning();
  if (!org) throw new Error('Failed to create org');
  return org;
}

describe('createProject', () => {
  test('creates project with name and description', async () => {
    const org = await createTestOrg();

    const project = await createProject({
      orgId: org.id,
      name: 'Test Project',
      description: 'A test project',
    });

    expect(project.id).toBeString();
    expect(project.orgId).toBe(org.id);
    expect(project.name).toBe('Test Project');
    expect(project.description).toBe('A test project');
    expect(project.createdAt).toBeInstanceOf(Date);
    expect(project.updatedAt).toBeInstanceOf(Date);
  });

  test('creates project without description', async () => {
    const org = await createTestOrg();

    const project = await createProject({
      orgId: org.id,
      name: 'Minimal Project',
    });

    expect(project.name).toBe('Minimal Project');
    expect(project.description).toBeNull();
  });

  test('creates multiple projects for same org', async () => {
    const org = await createTestOrg();

    const project1 = await createProject({ orgId: org.id, name: 'Project 1' });
    const project2 = await createProject({ orgId: org.id, name: 'Project 2' });

    expect(project1.id).not.toBe(project2.id);
    expect(project1.orgId).toBe(project2.orgId);
  });
});

describe('getProjectsByOrg', () => {
  test('returns empty array when no projects', async () => {
    const org = await createTestOrg();

    const projects = await getProjectsByOrg(org.id);

    expect(projects).toHaveLength(0);
  });

  test('returns all projects for org ordered by createdAt desc', async () => {
    const org = await createTestOrg();

    // Create projects with slight delay to ensure different timestamps
    await createProject({ orgId: org.id, name: 'First Project' });
    await createProject({ orgId: org.id, name: 'Second Project' });
    await createProject({ orgId: org.id, name: 'Third Project' });

    const projects = await getProjectsByOrg(org.id);

    expect(projects).toHaveLength(3);
    // Most recent first
    expect(projects[0]?.name).toBe('Third Project');
    expect(projects[2]?.name).toBe('First Project');
  });

  test('only returns projects for specified org', async () => {
    const org1 = await createTestOrg('Org 1');
    const org2 = await createTestOrg('Org 2');

    await createProject({ orgId: org1.id, name: 'Org1 Project' });
    await createProject({ orgId: org2.id, name: 'Org2 Project' });

    const projects1 = await getProjectsByOrg(org1.id);
    const projects2 = await getProjectsByOrg(org2.id);

    expect(projects1).toHaveLength(1);
    expect(projects1[0]?.name).toBe('Org1 Project');
    expect(projects2).toHaveLength(1);
    expect(projects2[0]?.name).toBe('Org2 Project');
  });
});

describe('getProjectById', () => {
  test('returns project when found and belongs to org', async () => {
    const org = await createTestOrg();
    const createdProject = await createProject({ orgId: org.id, name: 'My Project' });

    const project = await getProjectById(createdProject.id, org.id);

    expect(project).not.toBeNull();
    expect(project?.id).toBe(createdProject.id);
    expect(project?.name).toBe('My Project');
  });

  test('returns null when project does not exist', async () => {
    const org = await createTestOrg();

    const project = await getProjectById('00000000-0000-0000-0000-000000000000', org.id);

    expect(project).toBeNull();
  });

  test('returns null when project belongs to different org', async () => {
    const org1 = await createTestOrg('Org 1');
    const org2 = await createTestOrg('Org 2');
    const createdProject = await createProject({ orgId: org1.id, name: 'Org1 Project' });

    // Try to get project with org2's ID
    const project = await getProjectById(createdProject.id, org2.id);

    expect(project).toBeNull();
  });
});
