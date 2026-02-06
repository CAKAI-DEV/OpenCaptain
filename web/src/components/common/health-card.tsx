import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HealthLevel } from '@/types/analytics';

interface HealthCardProps {
  title: string;
  value: string | number;
  health: HealthLevel;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

const healthColors: Record<HealthLevel, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

export function HealthCard({ title, value, health, description, trend }: HealthCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('h-3 w-3 rounded-full', healthColors[health])} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {trend && (
            <span
              className={cn(
                'text-xs',
                trend === 'up' && 'text-green-500',
                trend === 'down' && 'text-red-500',
                trend === 'neutral' && 'text-muted-foreground'
              )}
            >
              {trend === 'up' && '\u2191'}
              {trend === 'down' && '\u2193'}
              {trend === 'neutral' && '\u2192'}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
