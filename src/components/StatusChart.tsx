import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StatusMetric } from '@/lib/metrics';

const STATUS_COLORS: Record<string, string> = {
  'Lead': 'hsl(210, 80%, 55%)',
  'Prospect': 'hsl(200, 70%, 50%)',
  'Email follow up': 'hsl(190, 60%, 45%)',
  'Discovery Meeting': 'hsl(38, 92%, 50%)',
  'Tech Qualification': 'hsl(32, 85%, 48%)',
  'Design proposal': 'hsl(280, 55%, 55%)',
  'Committed': 'hsl(142, 60%, 45%)',
  'Closed-won': 'hsl(142, 70%, 35%)',
  'Closed-lost': 'hsl(0, 68%, 52%)',
  'Recycle': 'hsl(215, 14%, 52%)',
};

function getCssVar(name: string) {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!val) return 'transparent';
  return `hsl(${val})`;
}

interface Props {
  metrics: StatusMetric[];
  dataKey: 'count' | 'totalValue' | 'weightedValue';
  title: string;
  formatValue?: (v: number) => string;
}

export function StatusChart({ metrics, dataKey, title, formatValue }: Props) {
  const data = metrics.filter((m) => m.count > 0);
  const fmt = formatValue || ((v: number) => v.toLocaleString());

  const bg = getCssVar('--card');
  const border = getCssVar('--border');
  const fg = getCssVar('--foreground');
  const muted = getCssVar('--muted-foreground');
  const accent = getCssVar('--accent');

  return (
    <Card className="border-border/40 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
              <XAxis
                dataKey="status"
                tick={{ fill: muted, fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                height={60}
                axisLine={{ stroke: border }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => fmt(v)}
              />
              <Tooltip
                contentStyle={{
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: '8px',
                  color: fg,
                  fontSize: '13px',
                  padding: '8px 12px',
                }}
                formatter={(value: number, _name: string, props: any) => [
                  fmt(value),
                  props.payload.status,
                ]}
                itemStyle={{ color: fg }}
                labelStyle={{ display: 'none' }}
                cursor={{ fill: 'hsl(var(--accent))', opacity: 0.5 }}
              />
              <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || muted} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
