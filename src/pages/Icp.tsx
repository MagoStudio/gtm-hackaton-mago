import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Target, Sparkles, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SavedICP {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

/** Derive a short human name from a free-form ICP prompt. */
function nameFromPrompt(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, " ");
  if (clean.length <= 48) return clean;
  return clean.slice(0, 45).trimEnd() + "…";
}

export default function Icp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [savedICPs, setSavedICPs] = useState<SavedICP[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("agent_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("agent_type", "lead-gen-icps")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.settings) {
          const settings = data.settings as Record<string, unknown>;
          setSavedICPs((settings.icps as SavedICP[]) || []);
          setRecent((settings.recent as any[]) || []);
        }
      });
  }, [user]);

  const persist = useCallback(
    async (icps: SavedICP[]) => {
      if (!user) return;
      await supabase.from("agent_settings").upsert(
        { user_id: user.id, agent_type: "lead-gen-icps", settings: { icps, recent } as any },
        { onConflict: "user_id,agent_type" }
      );
    },
    [user, recent]
  );

  // Open an existing ICP → jump to Lead Gen and run discovery for it.
  const openICP = useCallback(
    (icp: SavedICP) => {
      navigate("/agents/lead-gen", { state: { query: icp.query } });
    },
    [navigate]
  );

  // Submit a new ICP prompt → save it, then search leads for it.
  const submitPrompt = useCallback(() => {
    const q = prompt.trim();
    if (!q) return;
    const icp: SavedICP = {
      id: `icp-${Date.now()}`,
      name: nameFromPrompt(q),
      query: q,
      createdAt: new Date().toISOString(),
    };
    const updated = [icp, ...savedICPs.filter((i) => i.query !== q)];
    setSavedICPs(updated);
    persist(updated);
    navigate("/agents/lead-gen", { state: { query: q } });
  }, [prompt, savedICPs, persist, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        {/* Header + ICP boxes (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl w-full px-6 py-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
                <Target className="h-6 w-6 text-primary" />
                Ideal Customer Profiles
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Each ICP is a persona you generate and score leads for. Pick one to continue, or describe a new one below.
              </p>
            </div>

            {savedICPs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
                <Target className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No ICPs yet.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Describe your first persona in the box below to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedICPs.map((icp) => (
                  <button
                    key={icp.id}
                    onClick={() => openICP(icp)}
                    className={cn(
                      "group text-left rounded-xl border border-border/50 bg-card p-4 transition-all",
                      "hover:border-primary/50 hover:shadow-[0_4px_20px_-8px_hsl(262,80%,58%/0.4)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{icp.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{icp.query}</p>
                    <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground/70">
                      <Clock className="h-3 w-3" />
                      {new Date(icp.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Prompt box pinned at the bottom */}
        <div className="border-t border-border/40 bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl w-full px-6 py-4">
            <div className="relative rounded-2xl border border-border/60 bg-card focus-within:border-primary/50 transition-colors">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the persona you want to find leads for… e.g. “Heads of RevOps at French Series-B SaaS companies with 200–1000 employees”"
                className="min-h-[64px] max-h-40 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 pr-28"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
              />
              <Button
                onClick={submitPrompt}
                disabled={!prompt.trim()}
                className={cn(
                  "absolute right-3 bottom-3 h-9 px-4 rounded-xl font-semibold text-xs gap-1.5",
                  "bg-gradient-to-r from-[hsl(262,80%,58%)] to-[hsl(280,80%,60%)]",
                  "hover:from-[hsl(262,80%,52%)] hover:to-[hsl(280,80%,54%)] text-white",
                  "disabled:opacity-50"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Find leads
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
              ⌘/Ctrl + Enter to submit
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
