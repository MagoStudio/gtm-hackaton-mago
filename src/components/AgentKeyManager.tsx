import { useState } from 'react';
import { useAgentKeys } from '@/hooks/useAgentKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Bot, Plus, Copy, Trash2, ShieldOff, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_SCOPES = [
  { id: 'read', label: 'Read', description: 'View deals, pipeline, quotes' },
  { id: 'write', label: 'Write', description: 'Update deals, add notes' },
  { id: 'email', label: 'Email', description: 'Draft and send emails' },
];

export function AgentKeyManager() {
  const { keys, loading, createKey, revokeKey, deleteKey } = useAgentKeys();
  const [isCreating, setIsCreating] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read']);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!agentName.trim()) return;
    setSubmitting(true);
    const key = await createKey(agentName.trim(), selectedScopes);
    setSubmitting(false);
    if (key) {
      setNewKey(key);
      setAgentName('');
      setSelectedScopes(['read']);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Agent API Keys</CardTitle>
              <CardDescription>
                Create keys for agents (Claude, n8n, custom scripts) to access your CRM via REST API
              </CardDescription>
            </div>
          </div>
          {!isCreating && !newKey && (
            <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Key
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New key reveal */}
        {newKey && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-medium text-primary">🔑 Save this key — it won't be shown again</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {newKey}
              </code>
              <Button size="icon" variant="ghost" onClick={() => handleCopy(newKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setNewKey(null); setIsCreating(false); }}>
              Done
            </Button>
          </div>
        )}

        {/* Create form */}
        {isCreating && !newKey && (
          <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
            <Input
              placeholder="Agent name (e.g. Claude Desktop, n8n)"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Permissions</p>
              {AVAILABLE_SCOPES.map(scope => (
                <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedScopes.includes(scope.id)}
                    onCheckedChange={() => toggleScope(scope.id)}
                  />
                  <span className="text-sm">{scope.label}</span>
                  <span className="text-xs text-muted-foreground">— {scope.description}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!agentName.trim() || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                Create Key
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Key list */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 && !isCreating ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No API keys yet. Create one to let agents access your CRM.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map(key => (
              <div
                key={key.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  key.is_active ? 'border-border/50 bg-muted/30' : 'border-destructive/20 bg-destructive/5 opacity-60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{key.agent_name}</p>
                    {!key.is_active && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Revoked</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground font-mono">{key.key_prefix}...</code>
                    <span className="text-xs text-muted-foreground">·</span>
                    {(key.scopes || []).map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                    ))}
                  </div>
                  {key.last_used_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Last used {new Date(key.last_used_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  {key.is_active && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => revokeKey(key.id)} title="Revoke">
                      <ShieldOff className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteKey(key.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
