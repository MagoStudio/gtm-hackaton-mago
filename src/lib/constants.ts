export const STAGE_WEIGHTS: Record<string, number> = {
  'Lead': 0.10,
  'Prospect': 0.10,
  'Email follow up': 0.10,
  'Discovery Meeting': 0.40,
  'Tech Qualification': 0.60,
  'Design proposal': 0.60,
  'Committed': 0.80,
  'Closed-won': 1.00,
  'Closed-lost': 0.00,
  'Recycle': 0.05,
  '': 0.00,
};

export const STAGE_ORDER = [
  'Lead',
  'Prospect',
  'Email follow up',
  'Discovery Meeting',
  'Tech Qualification',
  'Design proposal',
  'Committed',
  'Closed-won',
  'Closed-lost',
  'Recycle',
];

export const ACTIVE_STAGES = STAGE_ORDER.filter(
  (s) => s !== 'Closed-won' && s !== 'Closed-lost'
);

export function getWeightForStatus(status: string): number {
  return STAGE_WEIGHTS[status] ?? 0;
}
