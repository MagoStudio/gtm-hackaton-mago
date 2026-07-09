import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, User, DollarSign, Calendar, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getVerticalColors } from '@/lib/vertical-colors';

export interface Deal {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  deal_value: number | null;
  actual_acv: number | null;
  country: string | null;
  company_vertical: string | null;
  company_size: string | null;
  prospect_owner: string | null;
  last_interaction: string | null;
  next_steps: string | null;
  lost_reason: string | null;
  closed_date: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  address: string | null;
  description: string | null;
  nb_interactions: number | null;
  strongest_connection: string | null;
}

interface Props {
  deal: Deal;
  onClick?: (deal: Deal) => void;
}

const STATUS_BORDER: Record<string, string> = {
  'Lead': 'border-l-[hsl(210,80%,65%)]',
  'Prospect': 'border-l-[hsl(200,70%,60%)]',
  'Email follow up': 'border-l-[hsl(190,60%,55%)]',
  'Discovery Meeting': 'border-l-[hsl(38,80%,60%)]',
  'Tech Qualification': 'border-l-[hsl(32,75%,58%)]',
  'Design proposal': 'border-l-[hsl(280,50%,65%)]',
  'Committed': 'border-l-[hsl(142,55%,55%)]',
  'Closed-won': 'border-l-[hsl(142,65%,42%)]',
  'Closed-lost': 'border-l-destructive',
  'Recycle': 'border-l-muted-foreground',
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function DealCard({ deal, onClick }: Props) {
  const name = [deal.first_name, deal.last_name].filter(Boolean).join(' ') || 'Unknown';
  const value = deal.deal_value || 0;
  const acv = deal.actual_acv || 0;

  return (
    <Card
      className={`border-l-[3px] ${STATUS_BORDER[deal.status] || 'border-l-muted-foreground'} border-border/40 bg-card/80 p-3.5 space-y-2.5 hover:bg-card hover:border-border/70 transition-colors cursor-pointer group active:scale-[0.98]`}
      onClick={() => onClick?.(deal)}
    >
      {/* Company — prominent */}
      {deal.company && (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm font-bold text-foreground truncate">{deal.company}</p>
          {deal.company_size && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0">
              {deal.company_size}
            </Badge>
          )}
        </div>
      )}

      {/* Contact */}
      <div className="space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground leading-tight truncate">{name}</p>
          {deal.country && (
            <span className="shrink-0 text-[11px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {deal.country}
            </span>
          )}
        </div>
        {deal.job_title && (
          <p className="text-[11px] text-muted-foreground/70 truncate">{deal.job_title}</p>
        )}
      </div>

      {/* Value */}
      <div className="flex items-center gap-3">
        {value > 0 && (
          <div className="flex items-center gap-1 text-xs font-medium text-foreground">
            <DollarSign className="h-3 w-3 text-primary" />
            {fmtCurrency(value)}
          </div>
        )}
        {acv > 0 && acv !== value && (
          <span className="text-[11px] text-muted-foreground">
            ACV {fmtCurrency(acv)}
          </span>
        )}
      </div>

      {/* Last interaction */}
      {deal.last_interaction && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          {formatDistanceToNow(new Date(deal.last_interaction), { addSuffix: true })}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {deal.prospect_owner && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{deal.prospect_owner}</span>
          </div>
        )}
      </div>

      {/* Vertical badge */}
      {deal.company_vertical && (() => {
        const vc = getVerticalColors(deal.company_vertical);
        return (
          <Badge variant="outline" className={`text-[10px] font-medium ${vc.bg} ${vc.text} ${vc.border}`}>
            {deal.company_vertical}
          </Badge>
        );
      })()}

      {/* Next steps / lost reason */}
      {deal.next_steps && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 border-t border-border/30 pt-2">
          {deal.next_steps}
        </p>
      )}
      {deal.lost_reason && (
        <p className="text-[11px] text-destructive leading-relaxed border-t border-border/30 pt-2">
          Lost: {deal.lost_reason}
        </p>
      )}
    </Card>
  );
}
