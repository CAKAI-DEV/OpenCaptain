import Link from 'next/link';
import { HealthCard } from '@/components/common/health-card';
import { apiClient } from '@/lib/api';
import type { OutputMetrics, VelocityPeriod } from '@/types/analytics';
import type { ApiResponse } from '@/types/api';
import type { Project } from '@/types/project';

// Helper to compute health level from metrics
function computeHealth(current: number, previous: number): 'healthy' | 'warning' | 'critical' {
  if (previous === 0) return current > 0 ? 'healthy' : 'warning';
  const change = ((current - previous) / previous) * 100;
  if (change >= -10) return 'healthy';
  if (change >= -30) return 'warning';
  return 'critical';
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // Fetch project and metrics in parallel
  const [project, velocityResponse] = await Promise.all([
    apiClient<Project>(`/projects/${projectId}`),
    apiClient<ApiResponse<VelocityPeriod[]>>(
      `/metrics/velocity?projectId=${projectId}&periodDays=7&numPeriods=4`
    ),
  ]);

  const velocity = velocityResponse.data;
  const currentVelocity = velocity[velocity.length - 1]?.velocity ?? 0;
  const previousVelocity = velocity[velocity.length - 2]?.velocity ?? 0;
  const velocityHealth = computeHealth(currentVelocity, previousVelocity);

  // Get task counts for the past week
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const outputResponse = await apiClient<ApiResponse<OutputMetrics>>(
    `/metrics/output?projectId=${projectId}&startDate=${weekAgo}&endDate=${today}`
  );
  const output = outputResponse.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          title="Velocity (7d)"
          value={currentVelocity}
          health={velocityHealth}
          description="Tasks completed this week"
          trend={
            currentVelocity > previousVelocity
              ? 'up'
              : currentVelocity < previousVelocity
                ? 'down'
                : 'neutral'
          }
        />
        <HealthCard
          title="Tasks Completed"
          value={output.totals.tasksCompleted}
          health={output.totals.tasksCompleted > 0 ? 'healthy' : 'warning'}
          description="Last 7 days"
        />
        <HealthCard
          title="Deliverables"
          value={output.totals.deliverablesCompleted}
          health={output.totals.deliverablesCompleted > 0 ? 'healthy' : 'warning'}
          description="Last 7 days"
        />
        <HealthCard
          title="Active Members"
          value={output.byUser.length}
          health={output.byUser.length > 0 ? 'healthy' : 'warning'}
          description="Contributors this week"
        />
      </div>

      {/* Quick links to views */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href={`/projects/${projectId}/board`}
          className="block p-4 border rounded-lg hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">Board View</h3>
          <p className="text-sm text-muted-foreground">Kanban board with drag-and-drop</p>
        </Link>
        <Link
          href={`/projects/${projectId}/list`}
          className="block p-4 border rounded-lg hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">List View</h3>
          <p className="text-sm text-muted-foreground">Filterable task list</p>
        </Link>
        <Link
          href={`/projects/${projectId}/analytics`}
          className="block p-4 border rounded-lg hover:border-primary transition-colors"
        >
          <h3 className="font-semibold">Analytics</h3>
          <p className="text-sm text-muted-foreground">Charts and metrics</p>
        </Link>
      </div>
    </div>
  );
}
