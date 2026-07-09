import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Settings, FileText, Loader2 } from 'lucide-react';
import { useQuotes, useProfiles } from '@/hooks/useQuotes';
import { formatEur } from '@/lib/quote-defaults';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-600',
  accepted: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function Quotes() {
  const navigate = useNavigate();
  const { data: quotes, isLoading } = useQuotes();
  const { data: profiles } = useProfiles();

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles?.forEach(p => { if (p.user_id && p.display_name) m[p.user_id] = p.display_name; });
    return m;
  }, [profiles]);

  // Group by parent_quote_id and show latest version
  const grouped = useMemo(() => {
    if (!quotes) return [];
    const map = new Map<string, typeof quotes>();
    quotes.forEach(q => {
      const key = q.parent_quote_id || q.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    });
    // Return latest version per group
    return Array.from(map.values()).map(group => {
      group.sort((a, b) => b.version - a.version);
      return { latest: group[0], versions: group };
    }).sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
  }, [quotes]);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quotes</h1>
            <p className="text-sm text-muted-foreground">Manage and track all your quotes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/quotes/settings')}>
              <Settings className="h-4 w-4 mr-1" /> Pricing Config
            </Button>
            <Button size="sm" onClick={() => navigate('/quotes/new')}>
              <Plus className="h-4 w-4 mr-1" /> New Quote
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No quotes yet. Create your first one!</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Year 1</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Last Edit</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map(({ latest, versions }) => (
                  <TableRow
                    key={latest.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/quotes/${latest.id}`)}
                  >
                    <TableCell className="font-medium">{latest.quote_number}</TableCell>
                    <TableCell>{latest.company_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[latest.status] || ''}>
                        {latest.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatEur(latest.total_year1)}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        v{latest.version}{versions.length > 1 ? ` (${versions.length} versions)` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {profileMap[latest.created_by] || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {latest.last_edited_by ? profileMap[latest.last_edited_by] || '—' : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(latest.created_at), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
