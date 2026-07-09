import { getWeightForStatus, STAGE_ORDER, ACTIVE_STAGES } from './constants';

export interface Deal {
  status: string;
  deal_value: number | null;
  last_interaction: string | null;
  created_at: string;
}

export interface StatusMetric {
  status: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  weight: number;
  avgDaysInStatus: number;
}

export interface PipelineSummary {
  totalPipelineValue: number;
  totalWeightedValue: number;
  totalDeals: number;
  statusMetrics: StatusMetric[];
}

export function computeMetrics(deals: Deal[]): PipelineSummary {
  const byStatus = new Map<string, Deal[]>();

  for (const deal of deals) {
    const s = deal.status || '';
    if (!byStatus.has(s)) byStatus.set(s, []);
    byStatus.get(s)!.push(deal);
  }

  const statusMetrics: StatusMetric[] = STAGE_ORDER.map((status) => {
    const group = byStatus.get(status) || [];
    const weight = getWeightForStatus(status);
    const totalValue = group.reduce((sum, d) => sum + (d.deal_value || 0), 0);
    const weightedValue = totalValue * weight;

    const now = Date.now();
    const daysArr = group.map((d) => {
      const ref = d.last_interaction ? new Date(d.last_interaction).getTime() : new Date(d.created_at).getTime();
      return Math.max(0, (now - ref) / (1000 * 60 * 60 * 24));
    });
    const avgDays = daysArr.length ? daysArr.reduce((a, b) => a + b, 0) / daysArr.length : 0;

    return {
      status,
      count: group.length,
      totalValue,
      weightedValue,
      weight,
      avgDaysInStatus: Math.round(avgDays * 10) / 10,
    };
  });

  const activeDeals = deals.filter((d) => ACTIVE_STAGES.includes(d.status || ''));
  const totalPipelineValue = activeDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
  const totalWeightedValue = statusMetrics.reduce((sum, m) => sum + m.weightedValue, 0);

  return {
    totalPipelineValue,
    totalWeightedValue,
    totalDeals: deals.length,
    statusMetrics,
  };
}

export interface WowDelta {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export function computeWow(current: number, previous: number): WowDelta {
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : current !== 0 ? 100 : 0;
  return { current, previous, change, changePercent: Math.round(changePercent * 10) / 10 };
}
