import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AgentApiKey {
  id: string;
  agent_name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export function useAgentKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<AgentApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('agent_api_keys')
      .select('id, agent_name, key_prefix, scopes, is_active, last_used_at, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load API keys');
      return;
    }
    setKeys((data || []).map(k => ({ ...k, scopes: k.scopes as string[] })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async (agentName: string, scopes: string[]) => {
    if (!user) return null;

    // Generate a random key: roxy_<32 hex chars>
    const rawBytes = new Uint8Array(16);
    crypto.getRandomValues(rawBytes);
    const hex = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const plainKey = `roxy_${hex}`;
    const keyPrefix = plainKey.substring(0, 12);

    // Hash it with SHA-256
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(plainKey));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { error } = await supabase.from('agent_api_keys').insert({
      user_id: user.id,
      agent_name: agentName,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
    });

    if (error) {
      toast.error('Failed to create API key');
      return null;
    }

    toast.success('API key created');
    await fetchKeys();
    return plainKey; // Only time the full key is visible
  };

  const revokeKey = async (keyId: string) => {
    const { error } = await supabase
      .from('agent_api_keys')
      .update({ is_active: false })
      .eq('id', keyId);
    if (error) {
      toast.error('Failed to revoke key');
      return;
    }
    toast.success('Key revoked');
    await fetchKeys();
  };

  const deleteKey = async (keyId: string) => {
    const { error } = await supabase
      .from('agent_api_keys')
      .delete()
      .eq('id', keyId);
    if (error) {
      toast.error('Failed to delete key');
      return;
    }
    toast.success('Key deleted');
    await fetchKeys();
  };

  return { keys, loading, createKey, revokeKey, deleteKey };
}
