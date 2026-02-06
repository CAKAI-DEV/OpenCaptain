import { format, subDays } from 'date-fns';
import { Suspense } from 'react';
import { PersonalStats } from '@/components/analytics/personal-stats';
import { BurndownChart } from '@/components/charts/burndown-chart';
import { DateRangePicker } from '@/components/charts/date-range-picker';
import { OutputChart } from '@/components/charts/output-chart';
import { VelocityChart } from '@/components/charts/velocity-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api.server';
import type {
  BurndownPoint,
  OutputMetrics,
  PersonalMetrics,
  VelocityPeriod,
} from '@/types/analytics';
import type { ApiResponse } from '@/types/api';

interface AnalyticsPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}

async function AnalyticsLoader({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from: string;
  to: string;
}) {
  // Fetch all metrics in parallel
  const [velocityRes, burndownRes, outputRes, personalRes] = await Promise.all([
    apiClient<ApiResponse<VelocityPeriod[]>>(
      `/metrics/velocity?projectId=${projectId}&periodDays=7&numPeriods=8`
    ),
    apiClient<ApiResponse<BurndownPoint[]>>(
      `/metrics/burndown?projectId=${projectId}&startDate=${from}&endDate=${to}`
    ),
    apiClient<ApiResponse<OutputMetrics>>(
      `/metrics/output?projectId=${projectId}&startDate=${from}&endDate=${to}`
    ),
    apiClient<ApiResponse<PersonalMetrics>>(
      `/metrics/personal?projectId=${projectId}&startDate=${from}&endDate=${to}`
    ),
  ]);

  const velocity = velocityRes.data;
  const burndown = burndownRes.data;
  const output = outputRes.data;
  const personal = personalRes.data;

  // Transform output data for chart
  const outputByPerson = output.byPerson.map((u) => ({
    name: u.email.split('@')[0],
    count: u.count,
  }));

  const outputBySquad = output.bySquad.map((s) => ({
    name: s.name,
    count: s.count,
  }));

  return (
    <div className="space-y-8">
      {/* Personal Stats - visible to all */}
      <PersonalStats metrics={personal} />

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <VelocityChart
          data={velocity}
          title="Team Velocity"
          description="Tasks completed per week"
        />
        <BurndownChart
          data={burndown}
          title="Sprint Burndown"
          description="Work remaining over time"
        />
      </div>

      {/* Output by Person - visible to squad leads and PMs */}
      {outputByPerson.length > 0 && (
        <OutputChart
          data={outputByPerson}
          title="Output by Member"
          description="Individual contribution in selected period"
        />
      )}

      {/* Output by Squad - visible to PMs */}
      {outputBySquad.length > 0 && (
        <OutputChart
          data={outputBySquad}
          title="Output by Squad"
          description="Squad performance in selected period"
        />
      )}

      {/* Totals Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Completed</div>
          <div className="text-3xl font-bold">{output.totalCompleted}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Active Squads</div>
          <div className="text-3xl font-bold">{output.bySquad.length}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Active Contributors</div>
          <div className="text-3xl font-bold">{output.byPerson.length}</div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[350px]" />
        <Skeleton className="h-[350px]" />
      </div>
      <Skeleton className="h-[350px]" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const { projectId } = await params;
  const { from, to } = await searchParams;

  // Default to last 30 days if no range specified
  const startDate = from ?? format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const endDate = to ?? format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <DateRangePicker />
      </div>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsLoader projectId={projectId} from={startDate} to={endDate} />
      </Suspense>
    </div>
  );
}
