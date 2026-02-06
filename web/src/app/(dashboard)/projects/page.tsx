import { Plus } from 'lucide-react';
import Link from 'next/link';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api.server';
import type { Project } from '@/types/project';

export default async function ProjectsPage() {
  let projects: Project[] = [];

  try {
    projects = await apiClient<Project[]>('/projects');
  } catch (error) {
    console.error('Failed to fetch projects:', error);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your projects and tasks</p>
        </div>
        <CreateProjectDialog />
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">No projects yet</h2>
            <p className="text-muted-foreground">
              Create your first project to start managing tasks with AI assistance.
            </p>
            <CreateProjectDialog />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.description || 'No description'}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
