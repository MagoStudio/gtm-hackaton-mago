import { useMemo } from 'react';
import { useUploads, useAllDeals, usePipelineSnapshot } from '@/hooks/useDeals';
import { computeMetrics, computeWow } from '@/lib/metrics';
import { CsvUpload } from '@/components/CsvUpload';
import { MetricCard } from '@/components/MetricCard';
import { StatusChart } from '@/components/StatusChart';
import { StatusTable } from '@/components/StatusTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarChart3, DollarSign, Scale, Clock, Upload } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const { data: uploads = [] } = useUploads();
  const { data: allDeals = [] } = useAllDeals();

  // Auto-select previous upload for WoW comparison
  const compareUpload = uploads.length > 1 ? uploads[1] : null;
  const { data: compareDeals = [] } = usePipelineSnapshot(compareUpload?.created_at || null);

  // Primary metrics from live pipeline
  const currentMetrics = useMemo(() => computeMetrics(allDeals), [allDeals]);
  const compareMetrics = useMemo(() => computeMetrics(compareDeals), [compareDeals]);

  const hasCompare = compareUpload && compareDeals.length > 0;

  const wowDeals = hasCompare ? computeWow(currentMetrics.totalDeals, compareMetrics.totalDeals) : null;
  const wowPipeline = hasCompare ? computeWow(currentMetrics.totalPipelineValue, compareMetrics.totalPipelineValue) : null;
  const wowWeighted = hasCompare ? computeWow(currentMetrics.totalWeightedValue, compareMetrics.totalWeightedValue) : null;

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl w-full space-y-6 px-4 py-6 sm:px-6">
        {/* Upload + WoW comparison selector */}
        <div className="flex flex-wrap items-center gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Weekly CSV</DialogTitle>
              </DialogHeader>
              <CsvUpload />
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary cards */}
        {allDeals.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Deals"
                value={currentMetrics.totalDeals.toLocaleString()}
                delta={wowDeals}
                icon={<BarChart3 className="h-5 w-5" />}
              />
              <MetricCard
                title="Pipeline Value"
                value={fmtCurrency(currentMetrics.totalPipelineValue)}
                delta={wowPipeline}
                icon={<DollarSign className="h-5 w-5" />}
              />
              <MetricCard
                title="Weighted Pipeline"
                value={fmtCurrency(currentMetrics.totalWeightedValue)}
                delta={wowWeighted}
                icon={<Scale className="h-5 w-5" />}
              />
              <MetricCard
                title="Avg Days in Status"
                value={
                  currentMetrics.statusMetrics.length
                    ? (
                        currentMetrics.statusMetrics.reduce((s, m) => s + m.avgDaysInStatus * m.count, 0) /
                        Math.max(1, currentMetrics.statusMetrics.reduce((s, m) => s + m.count, 0))
                      ).toFixed(1)
                    : '0'
                }
                icon={<Clock className="h-5 w-5" />}
              />
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <StatusChart
                metrics={currentMetrics.statusMetrics}
                dataKey="count"
                title="Deals by Status"
              />
              <StatusChart
                metrics={currentMetrics.statusMetrics}
                dataKey="totalValue"
                title="Deal Value by Status"
                formatValue={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
            </div>

            <StatusChart
              metrics={currentMetrics.statusMetrics}
              dataKey="weightedValue"
              title="Weighted Amount by Status"
              formatValue={(v) => `$${(v / 1000).toFixed(0)}k`}
            />

            {/* Table */}
            <StatusTable metrics={currentMetrics.statusMetrics} />
          </>
        )}

        {allDeals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">No data yet</h2>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Upload your first weekly CRM export above to start tracking your pipeline.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
