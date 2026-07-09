import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { StatusMetric } from '@/lib/metrics';

interface Props {
  metrics: StatusMetric[];
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function StatusTable({ metrics }: Props) {
  return (
    <Card className="border-border/40 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Pipeline Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">Deals</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">Value</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">Weight</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">Weighted</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">Avg Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m) => (
              <TableRow key={m.status || 'empty'} className="border-border/30">
                <TableCell className="font-medium">{m.status || '(No status)'}</TableCell>
                <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtCurrency(m.totalValue)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{(m.weight * 100).toFixed(0)}%</TableCell>
                <TableCell className="text-right tabular-nums">{fmtCurrency(m.weightedValue)}</TableCell>
                <TableCell className="text-right tabular-nums">{m.avgDaysInStatus}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
