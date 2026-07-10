import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Target, Sparkles, ArrowRight, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IcpRow {
  id: string;
  icp_key: string;
  version: number;
  name: string;
  tier: string | null;
  definition: { one_line_definition?: string; exa_query?: string };
  created_at: string;
}

export default function Icp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [icps, setIcps] = useState<IcpRow[]>([]);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Load the latest version of each ICP (highest version per icp_key).
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("icps")
      .select("id, icp_key, version, name, tier, definition, created_at")
      .eq("user_id", user.id)
      .order("version", { ascending: false });
    const latest = new Map<string, IcpRow>();
    for (const row of (data as IcpRow[]) || []) {
      if (!latest.has(row.icp_key)) latest.set(row.icp_key, row);
    }
    setIcps([...latest.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submitPrompt = useCallback(async () => {
    const q = prompt.trim();
    if (!q || generating) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-icp", { body: { prompt: q } });
      if (error) throw error;
      if (data?.error) throw new Error(data.detail || data.error);
      navigate("/icp/new", { state: { icp: data.icp, prompt: q } });
    } catch (e: any) {
      toast.error(e.message || "Failed to generate ICP");
      setGenerating(false);
    }
  }, [prompt, generating, navigate]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl w-full px-6 py-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
                <Target className="h-6 w-6 text-primary" />
                Ideal Customer Profiles
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Describe who you want to target and we'll turn it into an Exa-ready ICP. Pick an existing one to continue.
              </p>
            </div>

            {icps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
                <Target className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No ICPs yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Describe your first persona below to generate one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {icps.map((icp) => (
                  <button key={icp.id} onClick={() => navigate(`/icp/${icp.id}`)}
                    className={cn("group text-left rounded-xl border border-border/50 bg-card p-4 transition-all",
                      "hover:border-primary/50 hover:shadow-[0_4px_20px_-8px_hsl(262,80%,58%/0.4)]")}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{icp.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                      {icp.definition?.one_line_definition || icp.definition?.exa_query || "—"}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground/70">
                      <Clock className="h-3 w-3" />{new Date(icp.created_at).toLocaleDateString()} · v{icp.version}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* prompt box */}
        <div className="border-t border-border/40 bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl w-full px-6 py-4">
            <div className="relative rounded-2xl border border-border/60 bg-card focus-within:border-primary/50 transition-colors">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={generating}
                placeholder="Describe the companies or people you want to target — what they do, examples, geography, size, and why they need your product."
                className="min-h-[72px] max-h-48 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 pr-32"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitPrompt(); } }} />
              <Button onClick={submitPrompt} disabled={!prompt.trim() || generating}
                className={cn("absolute right-3 bottom-3 h-9 px-4 rounded-xl font-semibold text-xs gap-1.5",
                  "bg-gradient-to-r from-[hsl(262,80%,58%)] to-[hsl(280,80%,60%)]",
                  "hover:from-[hsl(262,80%,52%)] hover:to-[hsl(280,80%,54%)] text-white disabled:opacity-50")}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generating ? "Generating…" : "Generate ICP"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">⌘/Ctrl + Enter to submit</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
