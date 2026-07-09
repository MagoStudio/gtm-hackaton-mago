import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Download, Edit, Copy, Loader2 } from 'lucide-react';
import { useQuote, useQuoteVersions, useProfiles } from '@/hooks/useQuotes';
import { formatEur, type QuoteLineItems, type ProductionLineItems } from '@/lib/quote-defaults';
import { generateQuotePdf } from '@/lib/quote-pdf';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-600',
  accepted: 'bg-green-500/10 text-green-600',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);
  const { data: profiles } = useProfiles();

  const parentId = quote?.parent_quote_id || quote?.id;
  const { data: versions } = useQuoteVersions(parentId);

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles?.forEach(p => { if (p.user_id && p.display_name) m[p.user_id] = p.display_name; });
    return m;
  }, [profiles]);

  if (isLoading || !quote) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );

  const li = quote.line_items as unknown as QuoteLineItems;

  const handleDownload = () => {
    generateQuotePdf({
      ...quote,
      quote_name: (quote as any).quote_name,
      description: (quote as any).description,
      quote_type: (quote as any).quote_type,
      line_items: li,
      creatorName: profileMap[quote.created_by] || undefined,
    });
  };

  const handleNewVersion = () => {
    const parent = quote.parent_quote_id || quote.id;
    navigate(`/quotes/new?parentId=${parent}&parentVersion=${quote.version}&company=${encodeURIComponent(quote.company_name || '')}&contact=${encodeURIComponent(quote.contact_person || '')}&email=${encodeURIComponent(quote.contact_email || '')}${quote.deal_id ? `&dealId=${quote.deal_id}` : ''}`);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/quotes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{quote.quote_number}</h1>
              <p className="text-sm text-muted-foreground">
                Version {quote.version} • Created by {profileMap[quote.created_by] || 'Unknown'}
                {quote.last_edited_by && ` • Last edited by ${profileMap[quote.last_edited_by] || 'Unknown'}`}
              </p>
            </div>
            <Badge variant="secondary" className={STATUS_COLORS[quote.status] || ''}>{quote.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/quotes/new?edit=${quote.id}`)}>
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button size="sm" onClick={handleNewVersion}>
              <Copy className="h-4 w-4 mr-1" /> New Version
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {/* Client info */}
            <Card>
              <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-3 text-sm">
                <div><span className="text-muted-foreground">Company: </span>{quote.company_name || '—'}</div>
                <div><span className="text-muted-foreground">Contact: </span>{quote.contact_person || '—'}</div>
                <div><span className="text-muted-foreground">Email: </span>{quote.contact_email || '—'}</div>
              </CardContent>
            </Card>

            {/* Line items sections */}
            {(quote as any).quote_type === 'production_calculator' && li?.production ? (
              <Card>
                <CardHeader><CardTitle className="text-base">Production Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {(quote as any).description && (
                    <p className="text-muted-foreground whitespace-pre-wrap">{(quote as any).description}</p>
                  )}
                  <div>
                    <p className="font-medium mb-1">Production Details</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">Base render time</span><span>{Math.floor(li.production.length_seconds / 60)}m {li.production.length_seconds % 60}s</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Shots</span><span>{li.production.num_shots}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Difficulty</span><span className="capitalize">{li.production.difficulty} (×{li.production.multiplier})</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Iteration rate</span><span>+{Math.round(li.production.iteration_rate * 100)}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Effective render time</span><span>{Math.floor(li.production.effective_render_seconds / 60)}m {li.production.effective_render_seconds % 60}s</span></div>
                  </div>
                  <Separator />
                  <div>
                    <p className="font-medium mb-1">Credits</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">Rendering credits</span><span>{li.production.rendering_credits.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Image gen credits</span><span>{li.production.image_gen_credits.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Buffer (+{li.production.buffer_percent}%)</span><span>{(li.production.total_credits - li.production.subtotal_credits).toLocaleString()}</span></div>
                    <div className="flex justify-between font-semibold"><span>Total credits</span><span>{li.production.total_credits.toLocaleString()}</span></div>
                    {li.production.credit_discount > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Credit discount</span><span>{li.production.credit_discount}%</span></div>
                    )}
                    <div className="flex justify-between font-bold text-primary"><span>Rendering Cost</span><span>{formatEur(li.production.total_cost)}</span></div>
                  </div>

                  {li?.services?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">Professional Services</p>
                        {li.services.map((s, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{s.name} × {s.quantity}</span>
                            <span>{formatEur(s.total)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {li?.custom_dev?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="font-medium mb-1">Custom Development</p>
                        {li.custom_dev.map((c, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{c.type} × {c.quantity}</span>
                            <span>{formatEur(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">Hosting</p>
                    <p>{li?.hosting?.model} {li?.hosting?.installation_fee ? `(+ ${formatEur(li.hosting.installation_fee)} install)` : ''}</p>
                  </div>

                  {li?.licenses?.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Licenses</p>
                      {li.licenses.map((l, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{l.type} × {l.quantity}</span>
                          <span>{formatEur(l.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {li?.credits?.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Credits</p>
                      {li.credits.map((c, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{c.tier} × {c.quantity} ({c.total_credits.toLocaleString()} credits)</span>
                          <span>{formatEur(c.total_price)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {li?.support?.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Support</p>
                      {li.support.map((s, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{s.tier}</span>
                          <span>{formatEur(s.annual)}/yr</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {li?.services?.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Professional Services</p>
                      {li.services.map((s, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{s.name} × {s.quantity}</span>
                          <span>{formatEur(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {li?.custom_dev?.length > 0 && (
                    <div>
                      <p className="font-medium mb-1">Custom Development</p>
                      {li.custom_dev.map((c, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{c.type} × {c.quantity}</span>
                          <span>{formatEur(c.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {quote.notes && (
              <Card>
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm whitespace-pre-wrap">{quote.notes}</p></CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{(quote as any).quote_type === 'one_off' ? 'Subtotal' : 'Recurring Total'}</span><span className="font-medium">{formatEur(quote.total_arr)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total One-Time</span><span className="font-medium">{formatEur(quote.total_onetime)}</span></div>
                {quote.contract_discount > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{quote.contract_discount}%</span></div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold"><span>{(quote as any).quote_type === 'one_off' ? 'Total' : 'Year 1'}</span><span className="text-primary">{formatEur(quote.total_year1)}</span></div>
              </CardContent>
            </Card>

            {/* Version history */}
            {versions && versions.length > 1 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Version History</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {versions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => navigate(`/quotes/${v.id}`)}
                      className={`w-full text-left p-2 rounded-md text-sm hover:bg-accent/50 transition-colors ${v.id === quote.id ? 'bg-accent' : ''}`}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">v{v.version}</span>
                        <span className="text-muted-foreground">{formatEur(v.total_year1)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(v.created_at), 'MMM d, yyyy')} • {profileMap[v.created_by] || 'Unknown'}
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
