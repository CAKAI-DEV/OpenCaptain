import { eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import type { CreateProjectInput, Project } from './projects.types';

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { orgId, name, description } = input;

  const [project] = await db
    .insert(schema.projects)
    .values({
      orgId,
      name,
      description: description ?? null,
    })
    .returning();

  if (!project) {
    throw new Error('Failed to create project');
  }

  return project;
}

export async function getProjectsByOrg(orgId: string): Promise<Project[]> {
  const projects = await db.query.projects.findMany({
    where: eq(schema.projects.orgId, orgId),
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });

  return projects;
}

export async function getProjectById(id: string, orgId: string): Promise<Project | null> {
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, id),
  });

  // Ensure project belongs to the user's org
  if (!project || project.orgId !== orgId) {
    return null;
  }

  return project;
}
