import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OutputMetrics } from '@/types/analytics';

interface SquadStatsProps {
  output: OutputMetrics;
  squadId?: string;
}

export function SquadStats({ output, squadId }: SquadStatsProps) {
  // Find squad data if squadId provided, otherwise show aggregate
  const squadData = squadId ? output.bySquad.find((s) => s.squadId === squadId) : null;

  const tasksTotal = squadData ? squadData.tasksCompleted : output.totals.tasksCompleted;
  const deliverablesTotal = squadData
    ? squadData.deliverablesCompleted
    : output.totals.deliverablesCompleted;
  const memberCount = squadData ? 1 : output.byUser.length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {squadId ? 'Squad Performance' : 'Team Performance'}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasks Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasksTotal}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deliverables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliverablesTotal}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
