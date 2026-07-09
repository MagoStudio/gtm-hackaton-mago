import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseCsvFile, ParsedDeal, CsvParseResult } from '@/lib/csv-parser';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle2 } from 'lucide-react';

async function handlePeopleUpload(
  result: Extract<CsvParseResult, { type: 'people' }>,
  userId: string,
  weekLabel: string,
  fileName: string,
) {
  const parsedDeals = result.deals;

  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .insert({
      user_id: userId,
      week_label: weekLabel,
      file_name: fileName,
      record_count: parsedDeals.length,
    })
    .select()
    .single();

  if (uploadError) throw uploadError;

  const { data: allUserDeals, error: allDealsError } = await supabase
    .from('deals')
    .select('id, external_id, first_name, last_name, company, status, prospect_owner, next_steps, description, upload_id, uploads!inner(user_id)')
    .eq('uploads.user_id', userId);

  if (allDealsError) throw allDealsError;

  const byExternalId = new Map<string, typeof allUserDeals[0]>();
  const byNameCompany = new Map<string, typeof allUserDeals[0]>();

  for (const deal of (allUserDeals || [])) {
    if (deal.external_id) byExternalId.set(deal.external_id, deal);
    const key = `${(deal.first_name || '').toLowerCase()}|${(deal.last_name || '').toLowerCase()}|${(deal.company || '').toLowerCase()}`;
    if (key !== '||') byNameCompany.set(key, deal);
  }

  const newDeals: ParsedDeal[] = [];
  const updates: { dealId: string; changes: Record<string, unknown> }[] = [];
  const notesToInsert: { deal_id: string; content: string; author: string; note_type: string }[] = [];

  for (const parsed of parsedDeals) {
    const existing =
      (parsed.external_id && byExternalId.get(parsed.external_id)) ||
      byNameCompany.get(
        `${parsed.first_name.toLowerCase()}|${parsed.last_name.toLowerCase()}|${parsed.company.toLowerCase()}`
      );

    if (existing) {
      const changes: Record<string, unknown> = {};
      if (parsed.status && parsed.status !== existing.status) changes.status = parsed.status;
      if (parsed.prospect_owner && parsed.prospect_owner !== existing.prospect_owner) changes.prospect_owner = parsed.prospect_owner;
      if (parsed.next_steps && parsed.next_steps !== (existing.next_steps || '')) changes.next_steps = parsed.next_steps;
      if (Object.keys(changes).length > 0) updates.push({ dealId: existing.id, changes });
      if (parsed.description && parsed.description !== (existing.description || '')) {
        notesToInsert.push({ deal_id: existing.id, content: parsed.description, author: 'CSV Import', note_type: 'note' });
      }
    } else {
      newDeals.push(parsed);
    }
  }

  for (const { dealId, changes } of updates) {
    const { error } = await supabase.from('deals').update(changes as any).eq('id', dealId);
    if (error) console.error('Update deal error:', error);
  }

  if (notesToInsert.length > 0) {
    const { error } = await supabase.from('deal_notes').insert(notesToInsert);
    if (error) console.error('Insert notes error:', error);
  }

  const BATCH = 100;
  for (let i = 0; i < newDeals.length; i += BATCH) {
    const batch = newDeals.slice(i, i + BATCH).map((d: ParsedDeal) => ({ upload_id: upload.id, ...d }));
    const { error } = await supabase.from('deals').insert(batch);
    if (error) throw error;
  }

  return { newCount: newDeals.length, updatedCount: updates.length, notesCount: notesToInsert.length };
}

async function handleNotesUpload(
  result: Extract<CsvParseResult, { type: 'notes' }>,
  userId: string,
) {
  const notes = result.notes;

  // Fetch all user deals for matching
  const { data: allUserDeals, error } = await supabase
    .from('deals')
    .select('id, external_id, first_name, last_name, uploads!inner(user_id)')
    .eq('uploads.user_id', userId);

  if (error) throw error;

  const byExternalId = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const deal of (allUserDeals || [])) {
    if (deal.external_id) byExternalId.set(deal.external_id, deal.id);
    const name = `${(deal.first_name || '').toLowerCase()} ${(deal.last_name || '').toLowerCase()}`.trim();
    if (name) byName.set(name, deal.id);
  }

  const notesToInsert: { deal_id: string; content: string; author: string; note_type: string; created_at?: string }[] = [];
  let unmatched = 0;

  for (const note of notes) {
    const dealId =
      (note.contact_id && byExternalId.get(note.contact_id)) ||
      byName.get(note.contact_name.toLowerCase().trim());

    if (dealId) {
      notesToInsert.push({
        deal_id: dealId,
        content: note.content,
        author: note.author || 'CSV Import',
        note_type: 'note',
        ...(note.created_at ? { created_at: note.created_at } : {}),
      });
    } else {
      unmatched++;
    }
  }

  const BATCH = 100;
  for (let i = 0; i < notesToInsert.length; i += BATCH) {
    const batch = notesToInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('deal_notes').insert(batch);
    if (error) console.error('Insert notes error:', error);
  }

  return { matched: notesToInsert.length, unmatched };
}

export function CsvUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [weekLabel, setWeekLabel] = useState(() => {
    const d = new Date();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toISOString().split('T')[0];
  });
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleUpload = useCallback(async () => {
    if (!file || !user) return;
    setUploading(true);
    setDone(false);

    try {
      const result = await parseCsvFile(file);

      if (result.type === 'people') {
        const { newCount, updatedCount, notesCount } = await handlePeopleUpload(result, user.id, weekLabel, file.name);
        queryClient.invalidateQueries({ queryKey: ['uploads'] });
        queryClient.invalidateQueries({ queryKey: ['deals'] });
        queryClient.invalidateQueries({ queryKey: ['all-deals'] });
        setDone(true);
        toast({ title: 'People CSV uploaded', description: `${newCount} new, ${updatedCount} updated, ${notesCount} notes added` });
      } else {
        const { matched, unmatched } = await handleNotesUpload(result, user.id);
        queryClient.invalidateQueries({ queryKey: ['deal_notes'] });
        setDone(true);
        toast({ title: 'Notes CSV uploaded', description: `${matched} notes matched to deals${unmatched ? `, ${unmatched} unmatched` : ''}` });
      }
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [file, user, weekLabel, queryClient, toast]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Week starting</label>
        <Input
          type="date"
          value={weekLabel}
          onChange={(e) => setWeekLabel(e.target.value)}
          className="bg-secondary/50"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">CSV File (People or Notes)</label>
        <div className="relative">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setDone(false); }}
            className="block w-full cursor-pointer rounded-md border border-input bg-secondary/50 px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
          />
        </div>
      </div>
      <Button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full font-semibold"
      >
        {uploading ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Processing…
          </span>
        ) : done ? (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Uploaded!
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload & Process
          </span>
        )}
      </Button>
    </div>
  );
}
