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

const MOCK_ICP = {
  icp_summary: {
    icp_name: "Post Supervisors — Vertical Drama",
    one_line_definition: "Freelance and studio post supervisors managing episodic pipelines for vertical drama productions processing 20+ episodes per season",
    target_entity_type: "person",
    primary_goal: "Get post supervisors to adopt Mago for batch AI stylization across full seasons of vertical drama",
    offer_summary: "Mago AI video transformation — batch stylization at scale for 9:16 episodic content",
    confidence_level: "high",
    assumptions_to_validate: ["They manage multi-episode seasons (20+)", "They control or influence tooling decisions", "They work across multiple productions per year"],
  },
  target_account_criteria: {
    company_types: ["Streaming Platform", "Production Studio", "Post House", "Freelance"],
    industries: ["Vertical Drama", "Short-form Video", "Streaming Entertainment", "Post Production"],
    business_models: ["Platform", "Freelance", "Studio"],
    company_size: { min_employees: 1, max_employees: 500 },
    geographies: ["Los Angeles", "London", "Istanbul", "Madrid", "Kyiv", "Paris"],
    reference_companies: ["BluTV", "Brut Media", "Wattpad Studios", "Fremantle UK", "WEBTOON Entertainment", "Gain TV"],
    similar_to_reference_companies: true,
    funding_stage: [],
    technology_keywords: ["DaVinci Resolve", "Premiere Pro", "After Effects", "vertical format", "9:16"],
    must_have_criteria: ["Works on vertical drama productions", "Manages post pipeline for episodic content"],
    nice_to_have_criteria: ["Manages team of editors or colorists", "Has evaluated or used AI post tools"],
  },
  buyer_personas: {
    target_titles: ["Post Production Supervisor", "Post Supervisor", "Head of Post", "Supervisora de Post Producción"],
    target_departments: ["Post Production", "Delivery", "Operations"],
    seniority_levels: ["head", "director", "manager"],
    persona_priority: ["Post Production Supervisor", "Head of Post"],
    excluded_titles: ["Intern", "Assistant Editor", "Runner"],
  },
  exclusions: {
    excluded_company_types: ["Advertising Agency", "Corporate Video", "Wedding Video"],
    excluded_industries: ["Horizontal video only", "Traditional broadcast only"],
    excluded_keywords: ["horizontal format", "16:9 only", "broadcast television"],
    excluded_titles: [],
    bad_fit_examples: ["Traditional TV post houses with no vertical drama output"],
    disqualification_rules: ["Works exclusively on horizontal format content", "No episodic vertical drama in portfolio"],
  },
  search_keywords: {
    must_include_keywords: ["vertical drama", "post production", "9:16", "episodic"],
    semantic_keywords: ["micro drama", "short-form series", "social drama", "vertical series"],
    related_terms: ["TikTok drama", "Instagram Reels series", "YouTube Shorts drama", "vertical storytelling"],
    competitor_or_alternative_keywords: ["Runway ML", "Topaz Video AI", "DaVinci Resolve AI", "Adobe Sensei"],
    exclude_keywords: ["horizontal", "16:9", "broadcast", "corporate video"],
  },
  exa_config: {
    exa_entity_type: "person",
    exa_search_mode: "websets",
    exa_criteria: ["Post supervisor working on vertical drama series", "Works with episodic 9:16 content", "Based in LA, London, Istanbul, Madrid, Kyiv, or Paris"],
    exa_enrichments: [],
    exa_result_count: 50,
    exa_freshness: "last_90_days",
    exa_output_fields: ["name", "title", "company", "linkedin_url", "location"],
  },
  sillage_signal_config: {
    selected_signals: [
      {
        signal_type: "hiring_signal",
        enabled: true,
        priority: "high",
        keywords: ["SDR", "BDR", "Account Executive", "sales ops", "revenue operations"],
        example_matches: [],
        reason_for_relevance: "Companies actively hiring sales roles are building or scaling outbound motion — a strong indicator they need GTM tooling.",
      },
      {
        signal_type: "funding_signal",
        enabled: true,
        priority: "high",
        keywords: ["Series A", "Series B", "raised", "funding round", "investment"],
        example_matches: [],
        reason_for_relevance: "Freshly funded SaaS companies have budget to invest in growth infrastructure and are under pressure to hit revenue targets quickly.",
      },
      {
        signal_type: "pain_keyword_signal",
        enabled: true,
        priority: "medium",
        keywords: ["manual prospecting", "lead quality", "data enrichment", "pipeline visibility", "missed quota"],
        example_matches: [],
        reason_for_relevance: "Content mentioning these terms suggests the team is already feeling the pain your product addresses.",
      },
      {
        signal_type: "technology_adoption_signal",
        enabled: true,
        priority: "medium",
        keywords: ["Salesforce", "HubSpot", "Apollo", "Outreach", "Salesloft", "ZoomInfo"],
        example_matches: [],
        reason_for_relevance: "Using established sales tools signals maturity in the sales stack and receptivity to complementary GTM solutions.",
      },
    ],
  },
  learning_loop: {
    accepted_leads: [],
    rejected_leads: [],
    rejection_reasons: [],
    positive_patterns_to_learn: [],
    negative_patterns_to_avoid: [],
    updated_criteria_suggestions: [],
    next_questions_to_improve_icp: ["What is their average deal size?"],
  },
  pain_hypotheses: {
    known_pains: ["Slow lead qualification", "Poor data quality"],
    pain_hypotheses: ["Reps spend too much time on manual research"],
    pain_confidence: "medium",
    pain_validation_questions: ["How do you currently find leads?"],
    trigger_events: ["New sales hire", "Missed quota"],
  },
  operational_criteria: {
    what_they_do: ["Sell software to businesses"],
    workflows: ["Outbound prospecting", "Inbound qualification"],
    volume_or_scale_signals: ["Growing headcount", "New funding"],
    use_cases: ["Lead generation", "Pipeline management"],
    current_tools_or_alternatives: ["Apollo", "ZoomInfo"],
    maturity_level: "scaling",
  },
};

interface IcpRow {
  id: string;
  icp_key: string;
  version: number;
  name: string;
  tier: string | null;
  definition: { icp_summary?: { one_line_definition?: string } };
  created_at: string;
}

const T = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const MOCK_ICP_ROWS: IcpRow[] = [
  { id: 'mock-icp-1', icp_key: 'post-supervisors-vertical', version: 2, name: 'Post Supervisors — Vertical Drama', tier: 'tier-1', definition: { icp_summary: { one_line_definition: 'Post production supervisors managing episodic pipelines for vertical drama studios processing 20+ episodes per season' } }, created_at: T(7) },
  { id: 'mock-icp-2', icp_key: 'colorists-vertical-drama', version: 1, name: 'Colorists — Vertical Drama', tier: 'tier-1', definition: { icp_summary: { one_line_definition: 'Freelance colorists grading 9:16 episodic content across streaming platforms in LA, London, Istanbul & Paris' } }, created_at: T(2) },
  { id: 'mock-icp-3', icp_key: 'vfx-micro-drama', version: 1, name: 'VFX Freelancers — Micro Drama', tier: 'tier-1', definition: { icp_summary: { one_line_definition: 'VFX compositors and artists specializing in vertical-format episodic drama for TikTok and Reels' } }, created_at: T(3) },
  { id: 'mock-icp-4', icp_key: 'lead-editors-vertical', version: 1, name: 'Lead Editors — Vertical Drama', tier: 'tier-2', definition: { icp_summary: { one_line_definition: 'Lead editors cutting 60–90 s episodes for TikTok, YouTube Shorts, and Instagram Reels drama series' } }, created_at: T(5) },
  { id: 'mock-icp-5', icp_key: 'directors-vertical-drama', version: 1, name: 'Directors & DPs — Vertical Drama', tier: 'tier-2', definition: { icp_summary: { one_line_definition: 'Directors and cinematographers shooting vertical format drama across LA, London, Istanbul, Madrid, Kyiv, and Paris' } }, created_at: T(10) },
];

export default function Icp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [icps, setIcps] = useState<IcpRow[]>([]);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Load the latest version of each ICP (highest version per icp_key).
  const load = useCallback(async () => {
    if (!user) return;
    if (import.meta.env.DEV) {
      setIcps(MOCK_ICP_ROWS);
      return;
    }
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
      if (import.meta.env.DEV) {
        await new Promise((r) => setTimeout(r, 800));
        navigate("/icp/new", { state: { icp: MOCK_ICP, prompt: q } });
        return;
      }
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
                Each ICP is a persona you generate and score leads for. Pick one to continue, or describe a new one below.
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
                      {icp.definition?.icp_summary?.one_line_definition || "—"}
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
                placeholder="Describe the companies or people you want to target — what they do, who they are, examples, geography, size, buying triggers, exclusions, and why they need your product."
                className="min-h-[72px] max-h-48 resize-none border-0 bg-transparent text-sm focus-visible:ring-0 pr-32"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitPrompt(); } }} />
              <Button onClick={submitPrompt} disabled={!prompt.trim() || generating}
                className={cn("absolute right-3 bottom-3 h-9 px-4 rounded-xl font-semibold text-xs gap-1.5",
                  "bg-gradient-to-r from-[#3542FF] to-[#2233DD]",
                  "hover:from-[#2535EE] hover:to-[#1828CC] text-white disabled:opacity-50")}>
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
