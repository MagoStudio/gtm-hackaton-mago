import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Bot, User, Loader2 } from 'lucide-react';

interface AuditEntry {
  id: string;
  actor_type: string;
  actor_label: string | null;
  action: string;
  resource_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function AuditFeed() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, actor_type, actor_label, action, resource_type, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries((data as AuditEntry[]) || []);
        setLoading(false);
      });
  }, []);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/50">
            <Activity className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Activity Feed</CardTitle>
            <CardDescription>Recent actions by humans and agents</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {entries.map(entry => {
                const meta = entry.metadata || {};
                const detail = (meta as Record<string, string>).company || (meta as Record<string, string>).summary || '';
                return (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {entry.actor_type === 'agent' ? (
                        <Bot className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm">
                        <span className="font-medium">{entry.actor_label || 'Unknown'}</span>
                        {' '}
                        <span className="text-muted-foreground">{entry.action.replace('.', ' → ')}</span>
                        {detail && <span className="text-muted-foreground"> · {detail}</span>}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{formatTime(entry.created_at)}</span>
                        {entry.resource_type && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.resource_type}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
