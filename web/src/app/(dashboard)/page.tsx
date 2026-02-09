import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api.server';
import type { Project } from '@/types/project';

export default async function DashboardPage() {
  const projects = await apiClient<Project[]>('/projects');

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Welcome to OpenCaptain</h1>
        <p className="text-muted-foreground">
          You don&apos;t have any projects yet. Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your Projects</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>{project.description || 'No description'}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
