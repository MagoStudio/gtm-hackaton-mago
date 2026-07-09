import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  User, Plus, Star, Mail, Phone, Briefcase, Linkedin, Loader2, Trash2, Pencil, Crown, Building2, Search, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

async function runEmailCascade(opts: { contactId?: string; dealId?: string }) {
  const { data, error } = await supabase.functions.invoke('find-email-cascade', { body: opts });
  if (error) throw error;
  return data as { results: Array<{ contactId: string; result: { email: string | null; source: string | null; tried: { provider: string; ok: boolean; reason?: string }[] } }>; summary: { processed: number; found: number } };
}

export interface DealContact {
  id: string;
  deal_id: string;
  is_champion: boolean;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
}

export function useDealContacts(dealId: string | null) {
  return useQuery({
    queryKey: ['deal_contacts', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_contacts')
        .select('*')
        .eq('deal_id', dealId)
        .order('is_champion', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as DealContact[];
    },
    enabled: !!dealId,
  });
}

const emptyContact = {
  first_name: '',
  last_name: '',
  job_title: '',
  email: '',
  phone: '',
  linkedin_url: '',
  company: '',
  notes: '',
  is_champion: false,
};

function ContactProfileDialog({
  contact,
  open,
  onClose,
  dealId,
}: {
  contact: DealContact;
  open: boolean;
  onClose: () => void;
  dealId: string;
}) {
  const queryClient = useQueryClient();
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';
  const isVirtual = contact.id.startsWith('deal-main-');
  const [notes, setNotes] = useState(contact.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  const handleSaveNotes = async () => {
    if (isVirtual) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('deal_contacts')
        .update({ notes: notes.trim() || null })
        .eq('id', contact.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['deal_contacts', dealId] });
      toast.success('Notes updated');
      setEditingNotes(false);
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {name}
            {contact.is_champion && (
              <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                <Crown className="h-3 w-3" /> Champion
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {contact.job_title && (
            <InfoRow icon={Briefcase} label="Title" value={contact.job_title} />
          )}
          {contact.company && (
            <InfoRow icon={Building2} label="Company" value={contact.company} />
          )}
          {contact.email && (
            <InfoRow icon={Mail} label="Email" value={
              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
            } />
          )}
          {contact.phone && (
            <InfoRow icon={Phone} label="Phone" value={
              <a href={`tel:${contact.phone}`} className="text-primary hover:underline">{contact.phone}</a>
            } />
          )}
          {contact.linkedin_url && (
            <InfoRow icon={Linkedin} label="LinkedIn" value={
              <a
                href={contact.linkedin_url.startsWith('http') ? contact.linkedin_url : `https://${contact.linkedin_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate block"
              >
                {contact.linkedin_url.replace(/https?:\/\/(www\.)?/, '')}
              </a>
            } />
          )}
          <Separator className="bg-border/30" />
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Notes</p>
              {!isVirtual && !editingNotes && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1" onClick={() => setEditingNotes(true)}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
              )}
            </div>
            {editingNotes && !isVirtual ? (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this contact…"
                  className="min-h-[80px] resize-none bg-secondary/40 border-border/40 text-sm"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setNotes(contact.notes || ''); setEditingNotes(false); }}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {contact.notes || <span className="text-muted-foreground/50 italic">No notes yet</span>}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function ContactFormDialog({
  open,
  onClose,
  dealId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
  existing?: DealContact | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(
    existing
      ? {
          first_name: existing.first_name || '',
          last_name: existing.last_name || '',
          job_title: existing.job_title || '',
          email: existing.email || '',
          phone: existing.phone || '',
          linkedin_url: existing.linkedin_url || '',
          company: existing.company || '',
          notes: existing.notes || '',
          is_champion: existing.is_champion,
        }
      : { ...emptyContact },
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase
          .from('deal_contacts')
          .update({
            first_name: form.first_name.trim() || null,
            last_name: form.last_name.trim() || null,
            job_title: form.job_title.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            linkedin_url: form.linkedin_url.trim() || null,
            company: form.company.trim() || null,
            notes: form.notes.trim() || null,
            is_champion: form.is_champion,
          })
          .eq('id', existing.id);
        if (error) throw error;
        toast.success('Contact updated');
      } else {
        // If setting as champion, unset others first
        if (form.is_champion) {
          await supabase
            .from('deal_contacts')
            .update({ is_champion: false })
            .eq('deal_id', dealId)
            .eq('is_champion', true);
        }
        const { error } = await supabase.from('deal_contacts').insert({
          deal_id: dealId,
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          job_title: form.job_title.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          company: form.company.trim() || null,
          notes: form.notes.trim() || null,
          is_champion: form.is_champion,
        });
        if (error) throw error;
        toast.success('Contact added');
      }
      queryClient.invalidateQueries({ queryKey: ['deal_contacts', dealId] });
      onClose();
    } catch {
      toast.error('Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="First name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className="bg-secondary/40 border-border/40" />
          <Input placeholder="Last name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className="bg-secondary/40 border-border/40" />
          <Input placeholder="Job title" value={form.job_title} onChange={(e) => set('job_title', e.target.value)} className="col-span-2 bg-secondary/40 border-border/40" />
          <Input placeholder="Company" value={form.company} onChange={(e) => set('company', e.target.value)} className="col-span-2 bg-secondary/40 border-border/40" />
          <Input placeholder="Email" value={form.email} onChange={(e) => set('email', e.target.value)} className="col-span-2 bg-secondary/40 border-border/40" />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="bg-secondary/40 border-border/40" />
          <Input placeholder="LinkedIn URL" value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} className="bg-secondary/40 border-border/40" />
          <Input placeholder="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="col-span-2 bg-secondary/40 border-border/40" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={form.is_champion}
            onChange={(e) => set('is_champion', e.target.checked)}
            className="rounded border-border"
          />
          <Crown className="h-4 w-4 text-amber-500" />
          Set as Champion (main point of contact)
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? 'Save' : 'Add Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DealForContacts {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company?: string | null;
  linkedin_url?: string | null;
}

export function DealContactsTab({ dealId, deal }: { dealId: string; deal?: DealForContacts | null }) {
  const queryClient = useQueryClient();
  const { data: contacts = [], isLoading } = useDealContacts(dealId);
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState<DealContact | null>(null);
  const [viewContact, setViewContact] = useState<DealContact | null>(null);
  const [findingFor, setFindingFor] = useState<string | null>(null);
  const [bulkFinding, setBulkFinding] = useState(false);

  const handleFindEmail = async (contactId: string) => {
    setFindingFor(contactId);
    try {
      const data = await runEmailCascade({ contactId });
      const r = data.results[0]?.result;
      if (r?.email) {
        toast.success(`Found via ${r.source}: ${r.email}`);
      } else {
        const tried = (r?.tried ?? []).map((t) => `${t.provider}${t.reason ? ` (${t.reason})` : ''}`).join(', ');
        toast.error(`No email found. Tried: ${tried || 'nothing'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['deal_contacts', dealId] });
    } catch (e) {
      toast.error(`Lookup failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setFindingFor(null);
    }
  };

  const handleBulkFind = async () => {
    setBulkFinding(true);
    try {
      const data = await runEmailCascade({ dealId });
      toast.success(`Found ${data.summary.found} of ${data.summary.processed} emails`);
      queryClient.invalidateQueries({ queryKey: ['deal_contacts', dealId] });
    } catch (e) {
      toast.error(`Bulk lookup failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBulkFinding(false);
    }
  };

  const mainContactFromDeal: DealContact | null = (() => {
    if (!deal) return null;
    const hasName = deal.first_name?.trim() || deal.last_name?.trim();
    if (!hasName) return null;
    // Check if this person is already saved as a contact (match by name)
    const alreadySaved = contacts.some(
      (c) =>
        (c.first_name || '').toLowerCase() === (deal.first_name || '').toLowerCase() &&
        (c.last_name || '').toLowerCase() === (deal.last_name || '').toLowerCase()
    );
    if (alreadySaved) return null;
    return {
      id: `deal-main-${dealId}`,
      deal_id: dealId,
      first_name: deal.first_name || null,
      last_name: deal.last_name || null,
      email: deal.email || null,
      phone: deal.phone || null,
      job_title: deal.job_title || null,
      company: deal.company || null,
      linkedin_url: deal.linkedin_url || null,
      notes: null,
      is_champion: true,
      created_at: '',
    } as DealContact;
  })();

  const displayContacts = mainContactFromDeal ? [mainContactFromDeal, ...contacts] : contacts;
  const isVirtual = (c: DealContact) => c.id.startsWith('deal-main-');

  const handleSetChampion = async (contactId: string) => {
    // Unset all, then set this one
    await supabase.from('deal_contacts').update({ is_champion: false }).eq('deal_id', dealId);
    await supabase.from('deal_contacts').update({ is_champion: true }).eq('id', contactId);
    queryClient.invalidateQueries({ queryKey: ['deal_contacts', dealId] });
    toast.success('Champion updated');
  };

  const handleDelete = async (contactId: string) => {
    const { error } = await supabase.from('deal_contacts').delete().eq('id', contactId);
    if (error) {
      toast.error('Failed to delete');
    } else {
      queryClient.invalidateQueries({ queryKey: ['deal_contacts', dealId] });
      toast.success('Contact removed');
    }
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
          {!isLoading && displayContacts.length === 0 && (
            <p className="text-xs text-muted-foreground/60 py-10 text-center">No contacts yet — add one below</p>
          )}
          {displayContacts.map((c) => {
            const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown';
            const virtual = isVirtual(c);
            return (
              <div
                key={c.id}
                className="rounded-lg border border-border/30 bg-secondary/50 p-3 space-y-1 hover:bg-secondary/70 transition-colors cursor-pointer group"
                onClick={() => setViewContact(c)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      c.is_champion ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground'
                    }`}>
                      {c.is_champion ? <Crown className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        {c.is_champion && (
                          <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-1.5 h-4">
                            Champion
                          </Badge>
                        )}
                        {virtual && (
                          <Badge variant="outline" className="text-[10px] px-1.5 h-4 text-muted-foreground">
                            Main
                          </Badge>
                        )}
                      </div>
                      {c.job_title && (
                        <p className="text-[11px] text-muted-foreground truncate">{c.job_title}</p>
                      )}
                    </div>
                  </div>
                  {!virtual && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {!c.email && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Find email (Apollo → Hunter)" onClick={() => handleFindEmail(c.id)} disabled={findingFor === c.id}>
                          {findingFor === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5 text-primary" />}
                        </Button>
                      )}
                      {!c.is_champion && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Set as Champion" onClick={() => handleSetChampion(c.id)}>
                          <Star className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditContact(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {(c.email || c.phone) && (
                  <div className="flex items-center gap-3 pl-10 text-[11px] text-muted-foreground">
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" /> {c.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border/40 pt-3 flex gap-2">
        <Button size="sm" className="flex-1 gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Contact
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleBulkFind} disabled={bulkFinding} title="Find missing emails via Apollo → Hunter cascade">
          {bulkFinding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Find emails
        </Button>
      </div>

      {showAdd && (
        <ContactFormDialog open dealId={dealId} onClose={() => setShowAdd(false)} />
      )}
      {editContact && (
        <ContactFormDialog open dealId={dealId} existing={editContact} onClose={() => setEditContact(null)} />
      )}
      {viewContact && (
        <ContactProfileDialog contact={viewContact} open onClose={() => setViewContact(null)} dealId={dealId} />
      )}
    </div>
  );
}
