import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_PRICING, type PricingConfig } from '@/lib/quote-defaults';

// ─── Quote Settings (shared pricing) ───

export function useQuoteSettings() {
  return useQuery({
    queryKey: ['quote-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // Seed default row
        const { data: inserted, error: insertErr } = await supabase
          .from('quote_settings')
          .insert({ pricing: DEFAULT_PRICING as any })
          .select()
          .single();
        if (insertErr) throw insertErr;
        return inserted;
      }
      return data;
    },
  });
}

export function useUpdateQuoteSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (pricing: PricingConfig) => {
      // Get current settings id
      const { data: current } = await supabase
        .from('quote_settings')
        .select('id')
        .limit(1)
        .single();
      if (!current) throw new Error('No settings row found');
      const { error } = await supabase
        .from('quote_settings')
        .update({ pricing: pricing as any, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq('id', current.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-settings'] }),
  });
}

// ─── Quotes CRUD ───

export function useQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quote', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useQuoteVersions(parentId: string | undefined) {
  return useQuery({
    queryKey: ['quote-versions', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .or(`id.eq.${parentId},parent_quote_id.eq.${parentId}`)
        .order('version', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quote: Record<string, any>) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert(quote as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['deal-quotes'] });
      qc.invalidateQueries({ queryKey: ['deal-quotes-count'] });
    },
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from('quotes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['quote', id] });
      qc.invalidateQueries({ queryKey: ['deal-quotes'] });
      qc.invalidateQueries({ queryKey: ['deal-quotes-count'] });
    },
  });
}

// ─── Profiles for display names ───

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name');
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}
