import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PersonalMetrics } from '@/types/analytics';

interface PersonalStatsProps {
  metrics: PersonalMetrics;
}

export function PersonalStats({ metrics }: PersonalStatsProps) {
  const highPriorityCount =
    (metrics.tasksByPriority?.high ?? 0) + (metrics.tasksByPriority?.urgent ?? 0);

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    const days = Math.round(ms / (24 * 60 * 60 * 1000));
    if (days === 0) {
      const hours = Math.round(ms / (60 * 60 * 1000));
      return `${hours}h`;
    }
    return `${days}d`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Your Performance</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasks Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.tasksCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.deliverablesCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highPriorityCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(metrics.averageCompletionTime)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
