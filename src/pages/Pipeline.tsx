import { useState, useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAllDeals, useUploads } from '@/hooks/useDeals';
import { DealCard } from '@/components/DealCard';
import { DealDetailPanel } from '@/components/DealDetailPanel';
import type { Deal } from '@/components/DealCard';
import { Badge } from '@/components/ui/badge';
import { STAGE_ORDER } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, TrendingUp, BarChart3, Kanban, Search, Bot, Download, Plus, Filter, Sparkles, Loader2, MoreHorizontal, Pencil, FileDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppLayout } from '@/components/AppLayout';
import { toast } from 'sonner';

const COLUMN_COLORS: Record<string, string> = {
  'Lead': 'bg-[hsl(210,80%,55%)]',
  'Prospect': 'bg-[hsl(200,70%,50%)]',
  'Email follow up': 'bg-[hsl(190,60%,45%)]',
  'Discovery Meeting': 'bg-[hsl(38,92%,50%)]',
  'Tech Qualification': 'bg-[hsl(32,85%,48%)]',
  'Design proposal': 'bg-[hsl(280,55%,55%)]',
  'Committed': 'bg-[hsl(142,60%,45%)]',
  'Closed-won': 'bg-[hsl(142,70%,35%)]',
  'Closed-lost': 'bg-destructive',
  'Recycle': 'bg-muted-foreground',
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function Pipeline() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: deals = [] } = useAllDeals();
  const { data: uploads = [] } = useUploads();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [enrichingStage, setEnrichingStage] = useState<string | null>(null);

  // Stage label overrides (display name → canonical name stays in DB)
  const [stageLabels, setStageLabels] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('mago-stage-labels');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameStage, setRenameStage] = useState<string>('');
  const [renameValue, setRenameValue] = useState<string>('');

  const saveStageLabels = useCallback((next: Record<string, string>) => {
    setStageLabels(next);
    localStorage.setItem('mago-stage-labels', JSON.stringify(next));
  }, []);

  const toggleDealSelected = useCallback((id: string) => {
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllInStage = useCallback((stageDeals: Deal[]) => {
    setSelectedDealIds((prev) => {
      const next = new Set(prev);
      const allSelected = stageDeals.every((d) => next.has(d.id));
      if (allSelected) {
        for (const d of stageDeals) next.delete(d.id);
      } else {
        for (const d of stageDeals) next.add(d.id);
      }
      return next;
    });
  }, []);

  const enrichStageEmails = useCallback(async (stage: string, dealIds: string[]) => {
    if (dealIds.length === 0) return;
    setEnrichingStage(stage);
    try {
      // Pre-check: skip if everything already has an email (avoid wasting API credits)
      const [{ data: dealRows, error: dealErr }, { data: contactRows, error: contactErr }] = await Promise.all([
        supabase.from('deals').select('id, email').in('id', dealIds),
        supabase.from('deal_contacts').select('id, email').in('deal_id', dealIds),
      ]);
      if (dealErr) throw dealErr;
      if (contactErr) throw contactErr;

      const leadsMissing = (dealRows ?? []).filter((d) => !d.email).length;
      const contactsMissing = (contactRows ?? []).filter((c) => !c.email).length;
      const totalContacts = contactRows?.length ?? 0;
      const totalLeads = dealRows?.length ?? 0;

      if (leadsMissing === 0 && contactsMissing === 0) {
        toast.info('Already enriched — every lead and contact in this selection already has an email. No API credits used.');
        setSelectedDealIds((prev) => {
          const next = new Set(prev);
          for (const id of dealIds) next.delete(id);
          return next;
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('find-email-cascade', {
        body: { dealIds },
      });
      if (error) throw error;
      if (data?.credits_insufficient) {
        toast.warning('FullEnrich credits exhausted — top up the FullEnrich account to enrich emails/phones.', { duration: 8000 });
        setEnrichingStage(null);
        return;
      }
      const found = data?.summary?.found ?? 0;
      const processed = data?.summary?.processed ?? contactsMissing;
      const leadsFound = data?.summary?.leadsFound ?? 0;
      const leadsProcessed = data?.summary?.leadsProcessed ?? leadsMissing;

      // Totals including already-enriched ones so the user sees full coverage
      const contactsWithEmail = (totalContacts - contactsMissing) + found;
      const leadsWithEmail = (totalLeads - leadsMissing) + leadsFound;

      toast.success(
        `Enrichment complete · Contacts: ${contactsWithEmail}/${totalContacts} have an email (+${found} new of ${processed} tried) · Leads: ${leadsWithEmail}/${totalLeads} (+${leadsFound} new of ${leadsProcessed} tried)`,
        { duration: 8000 },
      );
      setSelectedDealIds((prev) => {
        const next = new Set(prev);
        for (const id of dealIds) next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['all-deals'] });
    } catch (e: any) {
      toast.error(`Enrich failed: ${e?.message || e}`);
    } finally {
      setEnrichingStage(null);
    }
  }, [queryClient]);

  // Keep selectedDeal in sync with live query data
  const selectedDeal = useMemo(
    () => (selectedDealId ? deals.find((d) => d.id === selectedDealId) ?? null : null),
    [selectedDealId, deals],
  );

  // Add lead dialog state
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    first_name: '',
    last_name: '',
    company: '',
    job_title: '',
    email: '',
    deal_value: '',
    status: 'Lead',
  });
  const [saving, setSaving] = useState(false);

  const handleAddLead = useCallback(async () => {
    if (!user || !newLead.first_name.trim()) return;
    setSaving(true);
    try {
      let uploadId = uploads[0]?.id;

      // If no uploads exist, create a placeholder one
      if (!uploadId) {
        const d = new Date();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const { data, error } = await supabase
          .from('uploads')
          .insert({
            user_id: user.id,
            week_label: monday.toISOString().split('T')[0],
            file_name: 'manual-entry',
            record_count: 0,
          })
          .select()
          .single();
        if (error) throw error;
        uploadId = data.id;
        queryClient.invalidateQueries({ queryKey: ['uploads'] });
      }

      const { error } = await supabase.from('deals').insert({
        upload_id: uploadId,
        first_name: newLead.first_name.trim(),
        last_name: newLead.last_name.trim(),
        company: newLead.company.trim(),
        job_title: newLead.job_title.trim(),
        email: newLead.email.trim(),
        deal_value: parseFloat(newLead.deal_value) || 0,
        status: newLead.status,
      });

      if (error) throw error;

      // Optimistically add the deal to the cache so it appears instantly
      queryClient.setQueryData(['all-deals'], (old: typeof deals | undefined) => [
        {
          id: crypto.randomUUID(),
          upload_id: uploadId,
          first_name: newLead.first_name.trim(),
          last_name: newLead.last_name.trim(),
          company: newLead.company.trim(),
          job_title: newLead.job_title.trim(),
          email: newLead.email.trim(),
          deal_value: parseFloat(newLead.deal_value) || 0,
          status: newLead.status,
          created_at: new Date().toISOString(),
        } as any,
        ...(old || []),
      ]);
      // Then refetch to get the real server data
      queryClient.invalidateQueries({ queryKey: ['all-deals'] });
      toast.success('Lead added');
      setAddLeadOpen(false);
      setNewLead({ first_name: '', last_name: '', company: '', job_title: '', email: '', deal_value: '', status: 'Lead' });
    } catch (e: any) {
      toast.error(e.message || 'Failed to add lead');
    } finally {
      setSaving(false);
    }
  }, [user, newLead, uploads, queryClient]);

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (ownerFilter !== 'all') {
      result = result.filter((d) => (d.prospect_owner || '').toLowerCase().includes(ownerFilter.toLowerCase()));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => {
        const name = [d.first_name, d.last_name].filter(Boolean).join(' ').toLowerCase();
        const company = (d.company || '').toLowerCase();
        return name.includes(q) || company.includes(q);
      });
    }
    return result;
  }, [deals, search, ownerFilter]);

  const columns = useMemo(() => {
    const grouped: Record<string, typeof filteredDeals> = {};
    for (const stage of STAGE_ORDER) {
      grouped[stage] = [];
    }
    for (const deal of filteredDeals) {
      const status = deal.status || '';
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(deal);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0));
    }
    return grouped;
  }, [filteredDeals]);

  const downloadChampionsCsv = useCallback(async (stageDeals: Deal[]) => {
    const dealIds = stageDeals.map((d) => d.id);
    if (dealIds.length === 0) return;
    const { data: contacts, error } = await supabase
      .from('deal_contacts')
      .select('deal_id, first_name, last_name, linkedin_url, company, email, is_champion')
      .in('deal_id', dealIds)
      .eq('is_champion', true);
    if (error) {
      toast.error('Failed to load champions');
      return;
    }
    const dealById = new Map(stageDeals.map((d) => [d.id, d]));
    const rows: string[][] = [['Name', 'Surname', 'LinkedIn', 'Company', 'Email']];
    for (const c of contacts || []) {
      const d = dealById.get(c.deal_id);
      rows.push([
        c.first_name || '',
        c.last_name || '',
        c.linkedin_url || '',
        c.company || d?.company || '',
        c.email || '',
      ]);
    }
    if (rows.length === 1) {
      toast.info('No champions found in Email follow up');
      return;
    }
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-followup-champions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${rows.length - 1} champion${rows.length - 1 === 1 ? '' : 's'}`);
  }, []);

  const downloadStageCsv = useCallback(async (stageDeals: Deal[], stageDisplayName: string) => {
    const dealIds = stageDeals.map((d) => d.id);
    if (dealIds.length === 0) {
      toast.info('No deals to export in this stage');
      return;
    }
    const { data: contacts, error } = await supabase
      .from('deal_contacts')
      .select('deal_id, first_name, last_name, linkedin_url, company, email, is_champion')
      .in('deal_id', dealIds)
      .eq('is_champion', true);
    if (error) {
      toast.error('Failed to load champions');
      return;
    }
    const dealById = new Map(stageDeals.map((d) => [d.id, d]));
    const rows: string[][] = [['Name', 'Surname', 'LinkedIn', 'Company', 'Email']];
    for (const c of contacts || []) {
      const d = dealById.get(c.deal_id);
      rows.push([
        c.first_name || '',
        c.last_name || '',
        c.linkedin_url || '',
        c.company || d?.company || '',
        c.email || '',
      ]);
    }
    if (rows.length === 1) {
      toast.info('No champions found in this stage');
      return;
    }
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = stageDisplayName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.download = `${safeName}-champions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length - 1} champion${rows.length - 1 === 1 ? '' : 's'}`);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { draggableId, destination } = result;
      if (!destination) return;

      const newStatus = destination.droppableId;
      const deal = deals.find((d) => d.id === draggableId);
      if (!deal || deal.status === newStatus) return;

      queryClient.setQueryData(['all-deals'], (old: typeof deals | undefined) =>
        (old || []).map((d) => (d.id === draggableId ? { ...d, status: newStatus } : d)),
      );

      const { error } = await supabase
        .from('deals')
        .update({ status: newStatus })
        .eq('id', draggableId);

      if (error) {
        toast.error('Failed to move deal');
        queryClient.invalidateQueries({ queryKey: ['all-deals'] });
      } else {
        toast.success(`Moved to ${stageLabels[newStatus] ?? newStatus}`);
      }
    },
    [deals, queryClient, stageLabels],
  );

  return (
    <AppLayout>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6 border-b border-border/40">
        <Button
          variant="default"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setAddLeadOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => {
            const headers = ['First Name','Last Name','Company','Job Title','Email','Phone','LinkedIn','Country','Address','Status','Deal Value','Actual ACV','Prospect Owner','Next Steps','Lost Reason','Company Vertical','Company Size','Description','Strongest Connection','Closed Date'];
            const rows = deals.map(d => [
              d.first_name, d.last_name, d.company, d.job_title, d.email, d.phone, d.linkedin_url, d.country, d.address, d.status, d.deal_value, d.actual_acv, d.prospect_owner, d.next_steps, d.lost_reason, d.company_vertical, d.company_size, d.description, d.strongest_connection, d.closed_date
            ].map(v => {
              if (v == null) return '';
              const s = String(v);
              return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(','));
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pipeline-export-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="h-9 w-40 bg-secondary/60 border-border/40 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            <SelectItem value="Alvaro">Alvaro</SelectItem>
            <SelectItem value="Andre">Andre</SelectItem>
            <SelectItem value="Samori">Samori</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-56 h-9 bg-secondary/60 border-border/40 text-sm placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 p-4 sm:p-6 min-w-max">
            {STAGE_ORDER.map((stage) => {
              const stageDeals = columns[stage] || [];
              const totalValue = stageDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);

              return (
                <Droppable droppableId={stage} key={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex w-72 shrink-0 flex-col rounded-xl border border-border/30 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-secondary/70 border-primary/30' : 'bg-secondary/40'
                      }`}
                    >
                      {/* Column header */}
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {stageDeals.length > 0 && (
                              <Checkbox
                                checked={stageDeals.every((d) => selectedDealIds.has(d.id))}
                                onCheckedChange={() => toggleSelectAllInStage(stageDeals)}
                                className="h-3.5 w-3.5 border-border"
                              />
                            )}
                            <div className={`h-2.5 w-2.5 rounded-full ${COLUMN_COLORS[stage] || 'bg-muted-foreground'}`} />
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              {stageLabels[stage] ?? stage}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1">
                            {stage === 'Email follow up' && stageDeals.length > 0 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5"
                                title="Download champions CSV"
                                onClick={() => downloadChampionsCsv(stageDeals)}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            )}
                            <Badge variant="secondary" className="text-[11px] font-medium h-5 px-1.5">
                              {stageDeals.length}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  title="Stage actions"
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  className="gap-2 text-xs"
                                  onClick={() => {
                                    setRenameStage(stage);
                                    setRenameValue(stageLabels[stage] ?? stage);
                                    setRenameDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Rename stage
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 text-xs"
                                  onClick={() => downloadStageCsv(stageDeals, stageLabels[stage] ?? stage)}
                                >
                                  <FileDown className="h-3.5 w-3.5" />
                                  Download CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {totalValue > 0 && (
                          <p className="text-[11px] text-muted-foreground pl-[18px]">
                            {fmtCurrency(totalValue)}
                          </p>
                        )}
                        {(() => {
                          const selectedInStage = stageDeals.filter((d) => selectedDealIds.has(d.id));
                          if (selectedInStage.length === 0) return null;
                          const busy = enrichingStage === stage;
                          return (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={busy}
                              className="w-full h-7 mt-1 gap-1.5 text-[11px]"
                              onClick={() => enrichStageEmails(stage, selectedInStage.map((d) => d.id))}
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                              Enrich {selectedInStage.length} deal{selectedInStage.length === 1 ? '' : 's'}
                            </Button>
                          );
                        })()}
                      </div>

                      {/* Cards */}
                      <div className="flex-1 px-2 pb-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                        <div className="space-y-2 min-h-[40px]">
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={`relative group ${dragSnapshot.isDragging ? 'opacity-90 rotate-[1deg]' : ''}`}
                                >
                                  <div
                                    className="absolute top-1.5 left-1.5 z-10"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={selectedDealIds.has(deal.id)}
                                      onCheckedChange={() => toggleDealSelected(deal.id)}
                                      className={`h-3.5 w-3.5 bg-background/80 backdrop-blur-sm border-border ${
                                        selectedDealIds.has(deal.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'
                                      }`}
                                    />
                                  </div>
                                  <DealCard deal={deal} onClick={(d) => setSelectedDealId(d.id)} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {stageDeals.length === 0 && (
                            <div className="py-8 text-center text-xs text-muted-foreground/60">
                              No deals
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      <DealDetailPanel
        deal={selectedDeal}
        open={!!selectedDeal}
        onClose={() => setSelectedDealId(null)}
        uploadId={null}
      />

      {/* Rename Stage Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Stage</DialogTitle>
            <DialogDescription className="text-xs">
              Change how "{stageLabels[renameStage] ?? renameStage}" appears across the pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="stage-name">Display Name</Label>
              <Input
                id="stage-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Stage name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (renameValue.trim()) {
                  saveStageLabels({ ...stageLabels, [renameStage]: renameValue.trim() });
                  setRenameDialogOpen(false);
                  toast.success(`Stage renamed to "${renameValue.trim()}"`);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Lead Dialog */}
      <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lead-first">First Name *</Label>
                <Input id="lead-first" value={newLead.first_name} onChange={(e) => setNewLead(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-last">Last Name</Label>
                <Input id="lead-last" value={newLead.last_name} onChange={(e) => setNewLead(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-company">Company</Label>
              <Input id="lead-company" value={newLead.company} onChange={(e) => setNewLead(p => ({ ...p, company: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-title">Job Title</Label>
              <Input id="lead-title" value={newLead.job_title} onChange={(e) => setNewLead(p => ({ ...p, job_title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lead-email">Email</Label>
              <Input id="lead-email" type="email" value={newLead.email} onChange={(e) => setNewLead(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lead-value">Deal Value</Label>
                <Input id="lead-value" type="number" placeholder="0" value={newLead.deal_value} onChange={(e) => setNewLead(p => ({ ...p, deal_value: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={newLead.status} onValueChange={(v) => setNewLead(p => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLeadOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLead} disabled={saving || !newLead.first_name.trim()}>
              {saving ? 'Saving…' : 'Add Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
