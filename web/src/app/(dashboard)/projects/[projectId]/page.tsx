import {
  BarChart3,
  Bot,
  Clock,
  KanbanSquare,
  Lightbulb,
  Link2,
  List,
  Package,
  Users,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { HealthCard } from '@/components/common/health-card';
import { apiClient } from '@/lib/api.server';
import type { OutputMetrics, VelocityPeriod } from '@/types/analytics';
import type { ApiResponse } from '@/types/api';
import type { Project } from '@/types/project';

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

  let project: Project | null = null;
  let currentVelocity = 0;
  let previousVelocity = 0;
  let totalCompleted = 0;
  let activeSquads = 0;
  let activeMembers = 0;

  try {
    project = await apiClient<Project>(`/projects/${projectId}`);
  } catch {
    // Project fetch failed
  }

  try {
    const velocityResponse = await apiClient<ApiResponse<VelocityPeriod[]>>(
      `/metrics/velocity?projectId=${projectId}&periodDays=7&numPeriods=4`
    );
    const velocity = velocityResponse.data;
    currentVelocity = velocity[velocity.length - 1]?.velocity ?? 0;
    previousVelocity = velocity[velocity.length - 2]?.velocity ?? 0;
  } catch {
    // Velocity metrics not available
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgoDate = new Date(now);
    weekAgoDate.setDate(weekAgoDate.getDate() - 7);
    const weekAgo = weekAgoDate.toISOString().split('T')[0];

    const outputResponse = await apiClient<ApiResponse<OutputMetrics>>(
      `/metrics/output?projectId=${projectId}&startDate=${weekAgo}&endDate=${today}`
    );
    totalCompleted = outputResponse.data.totalCompleted;
    activeSquads = outputResponse.data.bySquad.length;
    activeMembers = outputResponse.data.byPerson.length;
  } catch {
    // Output metrics not available
  }

  const velocityHealth = computeHealth(currentVelocity, previousVelocity);

  const quickLinks = [
    {
      name: 'Board',
      href: `/projects/${projectId}/board`,
      icon: KanbanSquare,
      desc: 'Kanban board with drag-and-drop',
    },
    { name: 'List', href: `/projects/${projectId}/list`, icon: List, desc: 'Filterable task list' },
    {
      name: 'Deliverables',
      href: `/projects/${projectId}/deliverables`,
      icon: Package,
      desc: 'Track deliverables',
    },
    {
      name: 'Analytics',
      href: `/projects/${projectId}/analytics`,
      icon: BarChart3,
      desc: 'Charts and metrics',
    },
    {
      name: 'Team',
      href: `/projects/${projectId}/team`,
      icon: Users,
      desc: 'Manage squads & members',
    },
    {
      name: 'Workflows',
      href: `/projects/${projectId}/workflows`,
      icon: Workflow,
      desc: 'Visual workflow editor',
    },
    {
      name: 'Check-ins',
      href: `/projects/${projectId}/checkins`,
      icon: Clock,
      desc: 'Automated check-ins',
    },
    {
      name: 'Insights',
      href: `/projects/${projectId}/insights`,
      icon: Lightbulb,
      desc: 'AI-powered insights',
    },
    {
      name: 'Integrations',
      href: `/projects/${projectId}/integrations`,
      icon: Link2,
      desc: 'Connect tools',
    },
    { name: 'AI Chat', href: '/chat', icon: Bot, desc: 'Talk to BlockBot' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{project?.name || 'Project'}</h1>
        {project?.description && (
          <p className="text-muted-foreground mt-1">{project.description}</p>
        )}
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
          title="Completed"
          value={totalCompleted}
          health={totalCompleted > 0 ? 'healthy' : 'warning'}
          description="Last 7 days"
        />
        <HealthCard
          title="Active Squads"
          value={activeSquads}
          health={activeSquads > 0 ? 'healthy' : 'warning'}
          description="Squads with completions"
        />
        <HealthCard
          title="Active Members"
          value={activeMembers}
          health={activeMembers > 0 ? 'healthy' : 'warning'}
          description="Contributors this week"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Access</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className="flex items-start gap-3 p-4 border rounded-lg hover:border-primary hover:bg-muted/50 transition-colors"
              >
                <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-sm">{link.name}</h3>
                  <p className="text-xs text-muted-foreground">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
