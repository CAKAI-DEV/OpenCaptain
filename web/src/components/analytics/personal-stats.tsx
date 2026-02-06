import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PersonalMetrics } from '@/types/analytics';

interface PersonalStatsProps {
  metrics: PersonalMetrics;
}

export function PersonalStats({ metrics }: PersonalStatsProps) {
  // Calculate trend from byDay data
  const recentDays = metrics.byDay.slice(-7);
  const recentTotal = recentDays.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Your Performance</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentTotal}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Project Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.projectAverage}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
