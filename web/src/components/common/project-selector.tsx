'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects } from '@/hooks/use-projects';

export function ProjectSelector() {
  const router = useRouter();
  const params = useParams();
  const currentProjectId = params.projectId as string | undefined;
  const { projects, loading } = useProjects();

  if (loading) {
    return <Skeleton className="h-9 w-48" />;
  }

  const handleChange = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  return (
    <Select value={currentProjectId} onValueChange={handleChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
