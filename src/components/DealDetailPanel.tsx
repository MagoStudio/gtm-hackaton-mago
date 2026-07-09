import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, User, Users, DollarSign, Calendar, MapPin, Briefcase, FileText, AlertTriangle, MessageSquare, Send, Loader2, Info, Mail, Phone, Link2, ChevronDown, Mic, Sparkles, Zap, RefreshCw, Plus, ArrowDownLeft, ArrowUpRight, PhoneCall, Video, StickyNote, Linkedin, Receipt } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useNotesForDeal, useAddNote, useUpdateDeal } from '@/hooks/useDeals';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getVerticalColors } from '@/lib/vertical-colors';
import { STAGE_ORDER } from '@/lib/constants';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { useAuth } from '@/hooks/useAuth';
import type { Deal } from '@/components/DealCard';
import { DealContactsTab, useDealContacts } from '@/components/DealContactsTab';

function decodeHtmlEntities(text: string) {
  return text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

interface Props {
  deal: Deal | null;
  open: boolean;
  onClose: () => void;
  uploadId?: string | null;
}


function fmtDate(d: string | null) {
  if (!d) return null;
  try { return format(new Date(d), 'MMM d, yyyy'); } catch { return d; }
}

const OWNER_OPTIONS = ['Alvaro', 'Andre', 'Samori'];

function Field({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
      {!Icon && <div className="w-4" />}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">{label}</p>
        <p className="text-sm text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

function EditableField({ icon: Icon, label, value, fieldName, dealId, type = 'text' }: {
  icon?: React.ElementType; label: string; value: string | number | null; fieldName: string; dealId: string; type?: 'text' | 'number';
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ''));
  const updateDeal = useUpdateDeal();

  // Sync when deal changes externally
  useEffect(() => {
    if (!editing) setVal(String(value ?? ''));
  }, [value, editing]);

  const handleSave = async () => {
    const parsed = type === 'number' ? (val.trim() ? Number(val) : null) : (val.trim() || null);
    try {
      await updateDeal.mutateAsync({ dealId, updates: { [fieldName]: parsed } });
      toast.success(`${label} updated`);
      setEditing(false);
    } catch {
      toast.error(`Failed to update ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icon ? <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" /> : <div className="w-4" />}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              type={type}
              className="h-7 text-sm bg-secondary/40 border-border/40"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setVal(String(value ?? '')); setEditing(false); } }}
            />
            <Button size="sm" onClick={handleSave} disabled={updateDeal.isPending} className="h-7 text-xs px-2">
              {updateDeal.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setVal(String(value ?? '')); setEditing(false); }} className="h-7 text-xs px-2">✕</Button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="w-full text-left group/ef">
            <p className="text-sm text-foreground break-words">
              {value ?? <span className="text-muted-foreground/50 italic">Click to add…</span>}
            </p>
            <span className="text-[10px] text-muted-foreground/0 group-hover/ef:text-muted-foreground/40 transition-colors">Click to edit</span>
          </button>
        )}
      </div>
    </div>
  );
}
const DEFAULT_DEAL_VALUES = [48000, 15000, 1800];

function DealValueSelect({ deal }: { deal: Deal }) {
  const updateDeal = useUpdateDeal();
  const [customValue, setCustomValue] = useState('');

  const currentValue = deal.deal_value ?? 0;

  const selectPreset = async (val: number) => {
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { deal_value: val } });
      toast.success('Deal value updated');
    } catch {
      toast.error('Failed to update deal value');
    }
  };

  const saveCustom = async () => {
    const num = parseFloat(customValue);
    if (isNaN(num)) return;
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { deal_value: num } });
      toast.success('Deal value updated');
      setCustomValue('');
    } catch {
      toast.error('Failed to update deal value');
    }
  };

  const fmtVal = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="flex items-start gap-3 py-2.5">
      <DollarSign className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">Deal Value</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-full justify-between text-sm bg-secondary/40 border-border/40 font-normal">
              <span className="truncate">
                {currentValue ? fmtVal(currentValue) : <span className="text-muted-foreground/50 italic">Select deal value…</span>}
              </span>
              <ChevronDown className="h-3.5 w-3.5 ml-1 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-0.5">
              {DEFAULT_DEAL_VALUES.map((v) => (
                <button
                  key={v}
                  onClick={() => selectPreset(v)}
                  className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left ${currentValue === v ? 'bg-accent font-medium' : ''}`}
                >
                  {fmtVal(v)}
                </button>
              ))}
            </div>
            <Separator className="my-1.5" />
            <div className="flex items-center gap-1.5">
              <Input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCustom()}
                placeholder="Custom amount…"
                type="number"
                className="h-7 text-xs"
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={saveCustom} disabled={!customValue.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

const DEFAULT_VERTICAL_OPTIONS = ['VFX', 'Animation', 'TV', 'Advertisement'];

function VerticalMultiSelect({ deal }: { deal: Deal }) {
  const updateDeal = useUpdateDeal();
  const queryClient = useQueryClient();
  const [newVertical, setNewVertical] = useState('');

  // Get all distinct verticals from existing deals (use separate query key to avoid overwriting main deals cache)
  const { data: verticalData = [] } = useQuery({
    queryKey: ['distinct-verticals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('company_vertical');
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const allVerticals = useMemo(() => {
    const fromDeals = verticalData
      .flatMap((d: any) => (d.company_vertical || '').split(',').map((s: string) => s.trim()))
      .filter((s: string) => s.length > 0);
    const combined = new Set([...DEFAULT_VERTICAL_OPTIONS, ...fromDeals]);
    return [...combined].sort();
  }, [verticalData]);

  // Parse current value (comma-separated) into array
  const selected = useMemo(() => {
    if (!deal.company_vertical) return [] as string[];
    return deal.company_vertical.split(',').map((s) => s.trim()).filter(Boolean);
  }, [deal.company_vertical]);

  const toggle = async (vertical: string) => {
    const next = selected.includes(vertical)
      ? selected.filter((v) => v !== vertical)
      : [...selected, vertical];
    const newValue = next.join(', ') || null;
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { company_vertical: newValue } });
      queryClient.invalidateQueries({ queryKey: ['distinct-verticals'] });
    } catch {
      toast.error('Failed to update vertical');
    }
  };

  const addCustomVertical = async () => {
    const trimmed = newVertical.trim();
    if (!trimmed) return;
    // Check if already exists (case-insensitive)
    if (allVerticals.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      // Just toggle it on if not selected
      const existing = allVerticals.find((v) => v.toLowerCase() === trimmed.toLowerCase())!;
      if (!selected.includes(existing)) {
        await toggle(existing);
      }
      setNewVertical('');
      return;
    }
    // Add as new vertical and select it
    const next = [...selected, trimmed];
    const newValue = next.join(', ');
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { company_vertical: newValue } });
      queryClient.invalidateQueries({ queryKey: ['distinct-verticals'] });
      setNewVertical('');
    } catch {
      toast.error('Failed to add vertical');
    }
  };

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-4" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">Vertical</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-full justify-between text-sm bg-secondary/40 border-border/40 font-normal">
              <span className="truncate">
                {selected.length > 0 ? selected.join(', ') : <span className="text-muted-foreground/50 italic">Select verticals…</span>}
              </span>
              <ChevronDown className="h-3.5 w-3.5 ml-1 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {allVerticals.map((v) => (
                <button
                  key={v}
                  onClick={() => toggle(v)}
                  className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                >
                  <Checkbox checked={selected.includes(v)} className="pointer-events-none" />
                  <span>{v}</span>
                </button>
              ))}
            </div>
            <Separator className="my-1.5" />
            <div className="flex items-center gap-1.5">
              <Input
                value={newVertical}
                onChange={(e) => setNewVertical(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomVertical()}
                placeholder="Add new…"
                className="h-7 text-xs"
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={addCustomVertical} disabled={!newVertical.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}


function EditableNextSteps({ deal }: { deal: Deal }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(deal.next_steps || '');
  const updateDeal = useUpdateDeal();

  const handleSave = async () => {
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { next_steps: value.trim() } });
      toast.success('Next steps updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update');
    }
  };

  // Sync when deal changes
  if (!editing && value !== (deal.next_steps || '')) {
    setValue(deal.next_steps || '');
  }

  return (
    <div className="flex items-start gap-3 py-2.5">
      <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="min-h-[80px] resize-none bg-secondary/40 border-border/40 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave(); }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSave} disabled={updateDeal.isPending} className="h-7 text-xs gap-1">
                {updateDeal.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setValue(deal.next_steps || ''); setEditing(false); }} className="h-7 text-xs">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full text-left group/ns"
          >
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {value || <span className="text-muted-foreground/50 italic">Click to add next steps…</span>}
            </p>
            <span className="text-[10px] text-muted-foreground/40 group-hover/ns:text-primary transition-colors">Click to edit</span>
          </button>
        )}
      </div>
    </div>
  );
}

function OwnerSelect({ deal }: { deal: Deal }) {
  const updateDeal = useUpdateDeal();

  const handleChange = async (value: string) => {
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { prospect_owner: value } });
      toast.success('Owner updated');
    } catch {
      toast.error('Failed to update owner');
    }
  };

  return (
    <div className="flex items-start gap-3 py-2.5">
      <User className="h-4 w-4 mt-2.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1">Prospect Owner</p>
        <Select value={deal.prospect_owner || undefined} onValueChange={handleChange}>
          <SelectTrigger className="h-8 text-sm bg-secondary/40 border-border/40">
            <SelectValue placeholder="Select owner…" />
          </SelectTrigger>
          <SelectContent>
            {OWNER_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StatusSelect({ deal }: { deal: Deal }) {
  const updateDeal = useUpdateDeal();
  const handleChange = async (value: string) => {
    try {
      await updateDeal.mutateAsync({ dealId: deal.id, updates: { status: value } });
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-4" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1">Status</p>
        <Select value={deal.status} onValueChange={handleChange}>
          <SelectTrigger className="h-8 text-sm bg-secondary/40 border-border/40">
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
  );
}

function DetailsTab({ deal }: { deal: Deal }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 pb-6 pr-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">Contact</p>
        <EditableField icon={User} label="First Name" value={deal.first_name} fieldName="first_name" dealId={deal.id} />
        <EditableField icon={User} label="Last Name" value={deal.last_name} fieldName="last_name" dealId={deal.id} />
        <EditableField icon={Briefcase} label="Job Title" value={deal.job_title} fieldName="job_title" dealId={deal.id} />
        <EditableField icon={Mail} label="Email" value={deal.email} fieldName="email" dealId={deal.id} />
        <EditableField icon={Phone} label="Phone" value={deal.phone} fieldName="phone" dealId={deal.id} />
        <EditableField icon={Link2} label="LinkedIn" value={deal.linkedin_url} fieldName="linkedin_url" dealId={deal.id} />
        <EditableField icon={MapPin} label="Country" value={deal.country} fieldName="country" dealId={deal.id} />
        <EditableField label="Address" value={deal.address} fieldName="address" dealId={deal.id} />
        <EditableField label="Description" value={deal.description} fieldName="description" dealId={deal.id} />

        <Separator className="my-3 bg-border/30" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">Company</p>
        <EditableField icon={Building2} label="Company" value={deal.company} fieldName="company" dealId={deal.id} />
        <VerticalMultiSelect deal={deal} />
        <EditableField label="Size" value={deal.company_size} fieldName="company_size" dealId={deal.id} />

        <Separator className="my-3 bg-border/30" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">Deal</p>
        <StatusSelect deal={deal} />
        <DealValueSelect deal={deal} />
        <EditableField label="Actual ACV" value={deal.actual_acv} fieldName="actual_acv" dealId={deal.id} type="number" />
        <div className="flex items-start gap-2 py-1 px-1">
          <Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-muted-foreground">Last Interaction</p>
            {deal.last_interaction ? (() => {
              const days = Math.floor((Date.now() - new Date(deal.last_interaction).getTime()) / 86400000);
              const color = days > 14 ? 'text-destructive' : days > 7 ? 'text-[hsl(var(--warning,38_92%_50%))]' : 'text-foreground';
              return (
                <p className={`text-xs font-medium ${color}`}>
                  {formatDistanceToNow(new Date(deal.last_interaction), { addSuffix: true })}
                  <span className="text-muted-foreground font-normal ml-1">({fmtDate(deal.last_interaction)})</span>
                </p>
              );
            })() : (
              <p className="text-xs text-destructive font-medium">No interactions yet</p>
            )}
          </div>
        </div>
        <EditableField label="Closed Date" value={deal.closed_date} fieldName="closed_date" dealId={deal.id} />
        <OwnerSelect deal={deal} />



        <Separator className="my-3 bg-border/30" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">Next Steps</p>
        <EditableNextSteps deal={deal} />

        <EditableField icon={AlertTriangle} label="Lost Reason" value={deal.lost_reason} fieldName="lost_reason" dealId={deal.id} />
        <EditableField label="Strongest Connection" value={deal.strongest_connection} fieldName="strongest_connection" dealId={deal.id} />
      </div>
    </ScrollArea>
  );
}

function NotesTab({ dealId }: { dealId: string }) {
  const [newNote, setNewNote] = useState('');
  const { data: notes = [], isLoading } = useNotesForDeal(dealId);
  const addNote = useAddNote();

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    try {
      await addNote.mutateAsync({ dealId, content: newNote.trim() });
      setNewNote('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="space-y-3 pb-4 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && notes.length === 0 && (
            <p className="text-xs text-muted-foreground/60 py-10 text-center">No notes yet — add one below</p>
          )}
          {!isLoading && notes.length > 0 && notes.map((note) => {
            const isTranscript = note.note_type === 'transcript';
            return (
              <div key={note.id} className={`rounded-lg border p-3 space-y-1.5 ${isTranscript ? 'bg-primary/5 border-primary/20' : 'bg-secondary/50 border-border/30'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isTranscript && <Mic className="h-3 w-3 text-primary" />}
                    {note.author && <span className="text-xs font-medium text-foreground">{note.author}</span>}
                    {isTranscript && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">
                        Transcript
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/70 shrink-0">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {note.content}
                </p>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border/40 pt-3 space-y-2">
        <Textarea
          placeholder="Write a note…"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="min-h-[72px] resize-none bg-secondary/40 border-border/40 text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd(); }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/50">⌘ + Enter to send</span>
          <Button size="sm" onClick={handleAdd} disabled={!newNote.trim() || addNote.isPending} className="gap-1.5">
            {addNote.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Add Note
          </Button>
        </div>
      </div>
    </div>
  );
}

const interactionIcons: Record<string, React.ElementType> = {
  email_sent: ArrowUpRight,
  email_received: ArrowDownLeft,
  call: PhoneCall,
  meeting: Video,
  note: StickyNote,
  linkedin: Linkedin,
};

const interactionLabels: Record<string, string> = {
  email_sent: 'Email Sent',
  email_received: 'Email Received',
  call: 'Call',
  meeting: 'Meeting',
  note: 'Note',
  linkedin: 'LinkedIn',
};

function TouchpointsTab({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isConnected, isCheckingConnection, connectedEmail, isSyncing, connectGmail, syncDealEmails } = useGmailConnection();
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState('note');
  const [logSubject, setLogSubject] = useState('');
  const [logBody, setLogBody] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  // Fetch deal_interactions
  const { data: interactions = [], isLoading: loadingInteractions } = useQuery({
    queryKey: ['deal-interactions', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_interactions')
        .select('*')
        .eq('deal_id', dealId)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch outreach_emails
  const { data: outreachEmails = [], isLoading: loadingOutreach } = useQuery({
    queryKey: ['outreach-emails', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_emails')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-sync on mount if connected
  useEffect(() => {
    if (isConnected && dealId) {
      syncDealEmails(dealId);
    }
  }, [isConnected, dealId]);

  // Merge into unified timeline
  const timeline = [
    ...interactions.map((i) => ({
      id: i.id,
      type: i.interaction_type,
      subject: i.subject,
      body: i.body,
      date: i.occurred_at,
      source: i.source,
      contactEmail: i.contact_email,
    })),
    ...outreachEmails.map((e) => ({
      id: e.id,
      type: 'email_sent' as const,
      subject: e.subject,
      body: e.body,
      date: e.sent_at || e.created_at,
      source: 'outreach' as const,
      contactEmail: e.recipient_email,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isLoading = loadingInteractions || loadingOutreach;

  const handleLogInteraction = async () => {
    if (!user || !logBody.trim()) return;
    setIsLogging(true);
    try {
      const { error } = await supabase.from('deal_interactions').insert({
        deal_id: dealId,
        user_id: user.id,
        interaction_type: logType,
        subject: logSubject.trim() || null,
        body: logBody.trim(),
        source: 'manual',
        occurred_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success('Interaction logged');
      setLogSubject('');
      setLogBody('');
      setShowLogForm(false);
      queryClient.invalidateQueries({ queryKey: ['deal-interactions', dealId] });
    } catch {
      toast.error('Failed to log interaction');
    } finally {
      setIsLogging(false);
    }
  };

  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      {/* Gmail connection bar */}
      <div className="shrink-0 mb-3 space-y-2">
        {isCheckingConnection ? null : !isConnected ? (
          <Button size="sm" variant="outline" className="w-full gap-2 text-xs" onClick={connectGmail}>
            <Mail className="h-3.5 w-3.5" />
            Connect Gmail to sync emails
          </Button>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">Connected: {connectedEmail}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 gap-1 text-[11px]"
              onClick={() => syncDealEmails(dealId)}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs"
            onClick={() => setShowLogForm(!showLogForm)}
          >
            <Plus className="h-3.5 w-3.5" />
            Log Interaction
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => navigate(`/agents/crm?dealId=${dealId}`)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Outreach
          </Button>
        </div>
      </div>

      {/* Log interaction form */}
      {showLogForm && (
        <div className="shrink-0 mb-3 rounded-lg border border-border/40 bg-secondary/30 p-3 space-y-2">
          <Select value={logType} onValueChange={setLogType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="email_sent">Email Sent</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Subject (optional)"
            value={logSubject}
            onChange={(e) => setLogSubject(e.target.value)}
            className="h-8 text-xs"
          />
          <Textarea
            placeholder="Details…"
            value={logBody}
            onChange={(e) => setLogBody(e.target.value)}
            className="min-h-[60px] resize-none text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowLogForm(false)}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleLogInteraction} disabled={isLogging || !logBody.trim()}>
              {isLogging && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pb-4 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && timeline.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <Mail className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/60">No touchpoints yet</p>
            </div>
          )}
          {!isLoading && timeline.map((item) => {
            const Icon = interactionIcons[item.type] || Mail;
            const label = interactionLabels[item.type] || item.type;
            const isMago = item.contactEmail?.endsWith('@mago.studio') || item.type === 'email_sent';
            const borderColor = isMago
              ? 'border-l-primary'
              : 'border-l-amber-500';
            const decoded = item.body ? decodeHtmlEntities(item.body) : '';

            return (
              <Collapsible key={item.id}>
                <div className={`rounded-lg border border-border/30 border-l-[3px] ${borderColor} ${isMago ? 'bg-primary/5' : 'bg-amber-500/5'}`}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-3 flex flex-col gap-1.5 text-left hover:bg-accent/20 transition-colors group">
                      <div className="flex items-start gap-2 w-full min-w-0">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/70 mt-0.5" />
                        <span className="text-xs font-semibold flex-1 text-foreground min-w-0 break-words">{item.subject || label}</span>
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform group-data-[state=open]:rotate-180 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-1.5 pl-[22px] flex-wrap">
                        {isMago ? (
                          <Badge className="text-[9px] h-4 px-1.5 bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
                            <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />Sent
                          </Badge>
                        ) : (
                          <Badge className="text-[9px] h-4 px-1.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/15">
                            <ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />Received
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                        </span>
                      </div>
                      {decoded && (
                        <p className="text-[11px] text-foreground/60 line-clamp-2 pl-[22px] leading-relaxed break-words">{decoded}</p>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  {decoded && (
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 border-t border-border/20">
                        {item.contactEmail && (
                          <p className="text-[10px] text-muted-foreground mt-2 mb-1.5">
                            {isMago ? 'To' : 'From'}: <span className="font-medium text-foreground/70">{item.contactEmail}</span>
                          </p>
                        )}
                        <div className="mt-2 text-xs text-foreground/80 leading-[1.7] whitespace-pre-wrap break-words">
                          {decoded}
                        </div>
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function QuotesTab({ deal }: { deal: Deal }) {
  const navigate = useNavigate();
  const contactName = [deal.first_name, deal.last_name].filter(Boolean).join(' ').trim();
  const quoteSelect = 'id, quote_number, quote_name, status, total_year1, created_at, quote_type, company_name, contact_person, deal_id';

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['deal-quotes', deal.id],
    queryFn: async () => {
      const { data: linkedQuotes, error: linkedError } = await supabase
        .from('quotes')
        .select(quoteSelect)
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false });

      if (linkedError) throw linkedError;

      let fallbackQuery = supabase
        .from('quotes')
        .select(quoteSelect)
        .is('deal_id', null);

      if (deal.company?.trim()) {
        fallbackQuery = fallbackQuery.ilike('company_name', `%${deal.company.trim()}%`);
      }
      if (contactName) {
        fallbackQuery = fallbackQuery.ilike('contact_person', `%${contactName}%`);
      }

      const { data: fallbackQuotes, error: fallbackError } = await fallbackQuery
        .order('created_at', { ascending: false })
        .limit(20);

      if (fallbackError) throw fallbackError;

      const merged = [...(linkedQuotes ?? []), ...(fallbackQuotes ?? [])];
      return merged
        .filter((quote, index, self) => self.findIndex((q) => q.id === quote.id) === index)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const fmtVal = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500/10 text-blue-600',
    accepted: 'bg-green-500/10 text-green-600',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="space-y-2 pb-4 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && quotes.length === 0 && (
            <p className="text-xs text-muted-foreground/60 py-10 text-center">No quotes yet for this deal</p>
          )}
          {quotes.map((q) => (
            <button
              key={q.id}
              onClick={() => navigate(`/quotes/${q.id}`)}
              className="w-full text-left rounded-lg border bg-secondary/50 border-border/30 p-3 space-y-1.5 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{q.quote_name || q.quote_number}</span>
                <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[q.status] || ''}`}>
                  {q.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{q.quote_number}</span>
                <span className="font-medium text-foreground">{fmtVal(q.total_year1)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                {format(new Date(q.created_at), 'MMM d, yyyy')}
              </p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DealDetailPanel({ deal, open, onClose, uploadId }: Props) {
  const navigate = useNavigate();
  const { data: notes = [] } = useNotesForDeal(deal?.id ?? null);
  const { data: contacts = [] } = useDealContacts(deal?.id ?? null);
  const { data: emails = [] } = useQuery({
    queryKey: ['outreach-emails-count', deal?.id],
    queryFn: async () => {
      if (!deal) return [];
      const { data, error } = await supabase
        .from('outreach_emails')
        .select('id')
        .eq('deal_id', deal.id);
      if (error) throw error;
      return data;
    },
    enabled: !!deal,
  });
  const { data: interactionsCount = [] } = useQuery({
    queryKey: ['deal-interactions-count', deal?.id],
    queryFn: async () => {
      if (!deal) return [];
      const { data, error } = await supabase
        .from('deal_interactions')
        .select('id')
        .eq('deal_id', deal.id);
      if (error) throw error;
      return data;
    },
    enabled: !!deal,
  });
  const touchpointCount = emails.length + interactionsCount.length;
  const { data: dealQuotes = [] } = useQuery({
    queryKey: ['deal-quotes-count', deal?.id],
    queryFn: async () => {
      if (!deal) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id')
        .eq('deal_id', deal.id);
      if (error) throw error;
      return data;
    },
    enabled: !!deal,
  });

  if (!deal) return null;
  const name = [deal.first_name, deal.last_name].filter(Boolean).join(' ') || 'Unknown';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 bg-background border-border/40 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 shrink-0 space-y-3">
          <SheetTitle className="text-lg font-bold text-foreground">{deal.company || name}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{deal.status}</Badge>
            {deal.company_vertical && (() => {
              const vc = getVerticalColors(deal.company_vertical);
              return (
                <Badge variant="outline" className={`text-[11px] font-medium ${vc.bg} ${vc.text} ${vc.border}`}>
                  {deal.company_vertical}
                </Badge>
              );
            })()}
            {deal.company_size && (
              <Badge variant="outline" className="text-[11px] font-normal">{deal.company_size}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-2 text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm"
              onClick={() => navigate(`/agents/crm?dealId=${deal.id}`)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Outreach with AI
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 gap-2 text-xs bg-accent hover:bg-accent/80 border border-border shadow-sm"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('dealId', deal.id);
                if (deal.company) params.set('company', deal.company);
                if (deal.first_name || deal.last_name) params.set('contact', `${deal.first_name || ''} ${deal.last_name || ''}`.trim());
                if (deal.email) params.set('email', deal.email);
                window.location.href = `/quotes/new?${params.toString()}`;
              }}
            >
              <FileText className="h-3.5 w-3.5" />
              Generate Quote
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0 px-6 pb-6">
          <TabsList className="w-full shrink-0 bg-secondary/50 h-auto flex-wrap gap-0.5 p-1">
            <TabsTrigger value="details" className="flex-1 gap-1 text-[11px] px-2 py-1.5 min-w-0">
              <Info className="h-3 w-3 shrink-0" />
              Details
            </TabsTrigger>
            <TabsTrigger value="people" className="flex-1 gap-1 text-[11px] px-2 py-1.5 min-w-0">
              <Users className="h-3 w-3 shrink-0" />
              People
              {contacts.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">{contacts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 gap-1 text-[11px] px-2 py-1.5 min-w-0">
              <MessageSquare className="h-3 w-3 shrink-0" />
              Notes
              {notes.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">{notes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="touchpoints" className="flex-1 gap-1 text-[11px] px-2 py-1.5 min-w-0">
              <Zap className="h-3 w-3 shrink-0" />
              Touch
              {touchpointCount > 0 && (
                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">{touchpointCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex-1 gap-1 text-[11px] px-2 py-1.5 min-w-0">
              <Receipt className="h-3 w-3 shrink-0" />
              Quotes
              {dealQuotes.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">{dealQuotes.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="flex-1 mt-4 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col outline-none focus:ring-0">
            <DetailsTab deal={deal} />
          </TabsContent>
          <TabsContent value="people" className="flex-1 mt-4 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col outline-none focus:ring-0">
            <DealContactsTab dealId={deal.id} deal={deal} />
          </TabsContent>
          <TabsContent value="notes" className="flex-1 mt-4 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col outline-none focus:ring-0">
            <NotesTab dealId={deal.id} />
          </TabsContent>
          <TabsContent value="touchpoints" className="flex-1 mt-4 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col outline-none focus:ring-0">
            <TouchpointsTab dealId={deal.id} />
          </TabsContent>
          <TabsContent value="quotes" className="flex-1 mt-4 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col outline-none focus:ring-0">
            <QuotesTab deal={deal} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
