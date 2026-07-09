import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WowDelta } from '@/lib/metrics';

interface MetricCardProps {
  title: string;
  value: string;
  delta?: WowDelta | null;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ title, value, delta, icon, className }: MetricCardProps) {
  const isUp = delta && delta.change > 0;
  const isDown = delta && delta.change < 0;
  const isFlat = !delta || delta.change === 0;

  return (
    <Card className={cn(
      'border-border/40 bg-card transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5',
      className
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          </div>
          {icon && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
        {delta && (
          <div className="mt-3 flex items-center gap-1.5">
            {isUp && <TrendingUp className="h-3.5 w-3.5 text-green-400" />}
            {isDown && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
            {isFlat && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className={cn(
              'text-xs font-medium tabular-nums',
              isUp && 'text-green-400',
              isDown && 'text-red-400',
              isFlat && 'text-muted-foreground',
            )}>
              {isUp && '+'}{delta.changePercent}% WoW
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
