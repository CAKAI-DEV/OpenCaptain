import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OutputMetrics, VelocityPeriod } from '@/types/analytics';

interface ProjectStatsProps {
  output: OutputMetrics;
  velocity: VelocityPeriod[];
}

export function ProjectStats({ output, velocity }: ProjectStatsProps) {
  // Calculate velocity trend
  const recentVelocity = velocity.length > 0 ? velocity[velocity.length - 1].velocity : 0;
  const previousVelocity = velocity.length > 1 ? velocity[velocity.length - 2].velocity : 0;
  const velocityChange =
    previousVelocity > 0 ? ((recentVelocity - previousVelocity) / previousVelocity) * 100 : 0;

  // Count active squads (those with any output)
  const activeSquads = output.bySquad.filter(
    (s) => s.tasksCompleted > 0 || s.deliverablesCompleted > 0
  ).length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Project Overview</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{output.totals.tasksCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{output.totals.deliverablesCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Squads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSquads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Velocity Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {velocityChange > 0 ? '+' : ''}
              {velocityChange.toFixed(0)}%
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
