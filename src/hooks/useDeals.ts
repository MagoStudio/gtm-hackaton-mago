import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UploadRecord {
  id: string;
  week_label: string;
  upload_date: string;
  file_name: string | null;
  record_count: number | null;
  created_at: string;
}

export function useUploads() {
  return useQuery({
    queryKey: ['uploads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .order('upload_date', { ascending: false });
      if (error) throw error;
      return data as UploadRecord[];
    },
  });
}

export function useAllDeals() {
  return useQuery({
    queryKey: ['all-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, uploads!inner(user_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Strip the nested uploads object from each row
      return data.map(({ uploads, ...deal }) => deal);
    },
  });
}

export function useDealsForUpload(uploadId: string | null) {
  return useQuery({
    queryKey: ['deals', uploadId],
    queryFn: async () => {
      if (!uploadId) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('upload_id', uploadId);
      if (error) throw error;
      return data;
    },
    enabled: !!uploadId,
  });
}

export function usePipelineSnapshot(uploadDate: string | null) {
  return useQuery({
    queryKey: ['pipeline-snapshot', uploadDate],
    queryFn: async () => {
      if (!uploadDate) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('*, uploads!inner(user_id)')
        .lte('created_at', uploadDate)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(({ uploads, ...deal }) => deal);
    },
    enabled: !!uploadDate,
  });
}

export interface DealNote {
  id: string;
  deal_id: string;
  author: string | null;
  content: string;
  created_at: string;
  note_type: string;
  granola_meeting_id: string | null;
}

export function useNotesForDeal(dealId: string | null) {
  return useQuery({
    queryKey: ['deal_notes', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('deal_notes')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DealNote[];
    },
    enabled: !!dealId,
  });
}

export function useAddNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, content, author }: { dealId: string; content: string; author?: string }) => {
      const { data, error } = await supabase
        .from('deal_notes')
        .insert({ deal_id: dealId, content, author: author || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal_notes', variables.dealId] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, updates }: { dealId: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('deals')
        .update(updates as any)
        .eq('id', dealId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['all-deals'] });
    },
  });
}

export function useDistinctOwners(uploadId: string | null) {
  return useQuery({
    queryKey: ['distinct_owners', uploadId],
    queryFn: async () => {
      if (!uploadId) return [];
      const { data, error } = await supabase
        .from('deals')
        .select('prospect_owner')
        .eq('upload_id', uploadId);
      if (error) throw error;
      // Split comma-separated owners and deduplicate
      const all = (data || [])
        .flatMap((d) => (d.prospect_owner || '').split(',').map((s: string) => s.trim()))
        .filter((s) => s.length > 0);
      return [...new Set(all)].sort();
    },
    enabled: !!uploadId,
  });
}
