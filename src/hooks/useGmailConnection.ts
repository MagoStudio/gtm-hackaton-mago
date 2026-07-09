import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useGmailConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSyncing, setSyncing] = useState(false);

  const { data: gmailToken, isLoading: isCheckingConnection } = useQuery({
    queryKey: ['gmail-token', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('gmail_tokens')
        .select('id, email, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isConnected = !!gmailToken;
  const connectedEmail = gmailToken?.email ?? null;
  const lastSynced = gmailToken?.updated_at ?? null;

  const connectGmail = useCallback(async () => {
    try {
      const redirectUrl = window.location.href;
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { redirectUrl },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to start Gmail auth:', err);
      toast.error('Failed to connect Gmail');
    }
  }, []);

  const syncDealEmails = useCallback(async (dealId: string) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-gmail', {
        body: { dealId },
      });
      if (error) throw error;
      if (data?.synced > 0) {
        toast.success(`Synced ${data.synced} new email${data.synced > 1 ? 's' : ''}`);
      }
      // Invalidate interactions query
      queryClient.invalidateQueries({ queryKey: ['deal-interactions', dealId] });
      return data;
    } catch (err) {
      console.error('Gmail sync error:', err);
      toast.error('Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  }, [queryClient]);

  return {
    isConnected,
    isCheckingConnection,
    connectedEmail,
    lastSynced,
    isSyncing,
    connectGmail,
    syncDealEmails,
  };
}
