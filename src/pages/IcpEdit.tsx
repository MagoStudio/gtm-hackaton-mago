import { useEffect, useState, useCallback } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Search, Target } from "lucide-react";
import {
  emptyIcp,
  type Icp,
  SILLAGE_SIGNAL_TYPES,
  TARGET_ENTITY_TYPES,
  EXA_ENTITY_TYPES,
  EXA_SEARCH_MODES,
  EXA_FRESHNESS,
  SIGNAL_PRIORITIES,
  type SillageSelectedSignal,
} from "@/lib/icp-schema";

/* ---------- small field helpers ---------- */

function TagInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) { onChange(Array.from(new Set([...values, ...parts]))); setDraft(""); }
  };
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-destructive/15"
              onClick={() => onChange(values.filter((x) => x !== v))}>
              {v}<span className="text-muted-foreground">×</span>
            </Badge>
          ))}
        </div>
      )}
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="h-8 text-xs"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); } }}
        onBlur={() => draft.trim() && add(draft)} />
    </div>
  );
}

function TextField({ label, value, onChange, textarea }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      {textarea
        ? <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="text-xs min-h-[56px]" />
        : <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs w-full rounded-md border border-border/60 bg-background px-2">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">{children}</CardContent>
    </Card>
  );
}

/* ---------- page ---------- */

export default function IcpEdit() {
  const { user, loading } = useAuth();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const incoming = (location.state as { icp?: Icp; prompt?: string } | null) || null;
  const [icp, setIcp] = useState<Icp>(() => ({ ...emptyIcp(), ...(incoming?.icp || {}) }) as Icp);
  const [prompt] = useState(incoming?.prompt || "");
  const [icpKey, setIcpKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loadingRow, setLoadingRow] = useState(!!id);
  const [saving, setSaving] = useState(false);

  // Load an existing ICP (latest version for its icp_key) when editing by id.
  useEffect(() => {
    if (!id || !user) return;
    supabase.from("icps").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) {
        setIcp({ ...emptyIcp(), ...(data.definition as unknown as Icp) });
        setIcpKey(data.icp_key);
        setVersion(data.version);
      }
      setLoadingRow(false);
    });
  }, [id, user]);

  // section update helper
  const patch = useCallback(<K extends keyof Icp>(section: K, partial: Partial<Icp[K]>) => {
    setIcp((prev) => ({ ...prev, [section]: { ...prev[section], ...partial } }));
  }, []);

  const toggleSignal = (type: (typeof SILLAGE_SIGNAL_TYPES)[number]) => {
    setIcp((prev) => {
      const existing = prev.sillage_signal_config.selected_signals.find((s) => s.signal_type === type);
      let next: SillageSelectedSignal[];
      if (existing) {
        next = prev.sillage_signal_config.selected_signals.map((s) =>
          s.signal_type === type ? { ...s, enabled: !s.enabled } : s);
      } else {
        next = [...prev.sillage_signal_config.selected_signals, {
          signal_type: type, enabled: true, priority: "medium", keywords: [], example_matches: [], reason_for_relevance: "",
        }];
      }
      return { ...prev, sillage_signal_config: { selected_signals: next } };
    });
  };

  const updateSignal = (type: string, partial: Partial<SillageSelectedSignal>) => {
    setIcp((prev) => ({
      ...prev,
      sillage_signal_config: {
        selected_signals: prev.sillage_signal_config.selected_signals.map((s) =>
          s.signal_type === type ? { ...s, ...partial } : s),
      },
    }));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const key = icpKey || crypto.randomUUID();
      const { data, error } = await supabase.from("icps").insert({
        user_id: user.id,
        icp_key: key,
        version: version + 1,
        name: icp.icp_summary.icp_name || "Untitled ICP",
        prompt: prompt || null,
        definition: icp as any,
      }).select("id, icp_key, version").single();
      if (error) throw error;
      setIcpKey(data.icp_key);
      setVersion(data.version);
      toast.success(`ICP saved (v${data.version})`);
      navigate(`/icp/${data.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Failed to save ICP");
    } finally {
      setSaving(false);
    }
  };

  const runSearch = () => {
    // Hand the Exa-ready criteria to Lead Gen. Prefer explicit criteria, else the summary.
    const query = icp.exa_config.exa_criteria.join(". ") || icp.icp_summary.one_line_definition || prompt;
    navigate("/agents/lead-gen", { state: { query } });
  };

  if (loading || loadingRow) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const S = icp.icp_summary, A = icp.target_account_criteria, O = icp.operational_criteria,
    P = icp.pain_hypotheses, B = icp.buyer_personas, X = icp.exclusions, K = icp.search_keywords, E = icp.exa_config;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl w-full px-6 py-8 space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
                <Target className="h-6 w-6 text-primary" />
                {S.icp_name || "New ICP"}
                {version > 0 && <span className="text-xs font-normal text-muted-foreground">v{version}</span>}
              </h1>
            </div>

            {/* 1. Summary */}
            <Section title="ICP Summary">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="ICP name" value={S.icp_name} onChange={(v) => patch("icp_summary", { icp_name: v })} />
                <TextField label="One-line definition" value={S.one_line_definition} onChange={(v) => patch("icp_summary", { one_line_definition: v })} />
                <SelectField label="Target entity type" value={S.target_entity_type} options={TARGET_ENTITY_TYPES} onChange={(v) => patch("icp_summary", { target_entity_type: v as any })} />
              </div>
              <TextField label="Primary goal" value={S.primary_goal} onChange={(v) => patch("icp_summary", { primary_goal: v })} textarea />
              <TextField label="Offer summary" value={S.offer_summary} onChange={(v) => patch("icp_summary", { offer_summary: v })} textarea />
              <TagInput label="Assumptions to validate" values={S.assumptions_to_validate} onChange={(v) => patch("icp_summary", { assumptions_to_validate: v })} />
            </Section>

            {/* 2. Target accounts */}
            <Section title="Target Accounts">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagInput label="Company types" values={A.company_types} onChange={(v) => patch("target_account_criteria", { company_types: v })} />
                <TagInput label="Industries" values={A.industries} onChange={(v) => patch("target_account_criteria", { industries: v })} />
                <TagInput label="Business models" values={A.business_models} onChange={(v) => patch("target_account_criteria", { business_models: v })} />
                <TagInput label="Geographies" values={A.geographies} onChange={(v) => patch("target_account_criteria", { geographies: v })} />
                <TagInput label="Reference companies" values={A.reference_companies} onChange={(v) => patch("target_account_criteria", { reference_companies: v })} />
                <TagInput label="Technology keywords" values={A.technology_keywords} onChange={(v) => patch("target_account_criteria", { technology_keywords: v })} />
                <TagInput label="Funding stage" values={A.funding_stage} onChange={(v) => patch("target_account_criteria", { funding_stage: v })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Min employees</label>
                  <Input type="number" value={A.company_size.min_employees ?? ""} className="h-8 text-xs"
                    onChange={(e) => patch("target_account_criteria", { company_size: { ...A.company_size, min_employees: e.target.value ? Number(e.target.value) : null } })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Max employees</label>
                  <Input type="number" value={A.company_size.max_employees ?? ""} className="h-8 text-xs"
                    onChange={(e) => patch("target_account_criteria", { company_size: { ...A.company_size, max_employees: e.target.value ? Number(e.target.value) : null } })} />
                </div>
              </div>
              <TagInput label="Must-have criteria (hard filters)" values={A.must_have_criteria} onChange={(v) => patch("target_account_criteria", { must_have_criteria: v })} />
              <TagInput label="Nice-to-have criteria (soft filters)" values={A.nice_to_have_criteria} onChange={(v) => patch("target_account_criteria", { nice_to_have_criteria: v })} />
            </Section>

            {/* 3. Use case & ops */}
            <Section title="Use Case & Operations">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagInput label="What they do" values={O.what_they_do} onChange={(v) => patch("operational_criteria", { what_they_do: v })} />
                <TagInput label="Volume / scale signals" values={O.volume_or_scale_signals} onChange={(v) => patch("operational_criteria", { volume_or_scale_signals: v })} />
                <TagInput label="Use cases" values={O.use_cases} onChange={(v) => patch("operational_criteria", { use_cases: v })} />
              </div>
            </Section>

            {/* 4. Pain */}
            <Section title="Pain & Trigger Events">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagInput label="Known pains" values={P.known_pains} onChange={(v) => patch("pain_hypotheses", { known_pains: v })} />
                <TagInput label="Trigger events" values={P.trigger_events} onChange={(v) => patch("pain_hypotheses", { trigger_events: v })} />
              </div>
              <TagInput label="Pain validation questions" values={P.pain_validation_questions} onChange={(v) => patch("pain_hypotheses", { pain_validation_questions: v })} />
            </Section>

            {/* 5. Personas */}
            <Section title="Buyer Personas">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagInput label="Target titles" values={B.target_titles} onChange={(v) => patch("buyer_personas", { target_titles: v })} />
                <TagInput label="Departments" values={B.target_departments} onChange={(v) => patch("buyer_personas", { target_departments: v })} />
                <TagInput label="Seniority levels" values={B.seniority_levels} onChange={(v) => patch("buyer_personas", { seniority_levels: v })} />
                <TagInput label="Persona priority" values={B.persona_priority} onChange={(v) => patch("buyer_personas", { persona_priority: v })} />
              </div>
              <TagInput label="Excluded titles" values={B.excluded_titles} onChange={(v) => patch("buyer_personas", { excluded_titles: v })} />
            </Section>

            {/* 6. Exclusions */}
            <Section title="Exclusions">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagInput label="Excluded company types" values={X.excluded_company_types} onChange={(v) => patch("exclusions", { excluded_company_types: v })} />
                <TagInput label="Excluded industries" values={X.excluded_industries} onChange={(v) => patch("exclusions", { excluded_industries: v })} />
                <TagInput label="Excluded keywords" values={X.excluded_keywords} onChange={(v) => patch("exclusions", { excluded_keywords: v })} />
                <TagInput label="Bad-fit examples" values={X.bad_fit_examples} onChange={(v) => patch("exclusions", { bad_fit_examples: v })} />
              </div>
              <TagInput label="Disqualification rules" values={X.disqualification_rules} onChange={(v) => patch("exclusions", { disqualification_rules: v })} />
            </Section>

            {/* 7. Keywords */}
            <Section title="Search Keywords">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagInput label="Must-include keywords" values={K.must_include_keywords} onChange={(v) => patch("search_keywords", { must_include_keywords: v })} />
                <TagInput label="Semantic keywords" values={K.semantic_keywords} onChange={(v) => patch("search_keywords", { semantic_keywords: v })} />
                <TagInput label="Related terms" values={K.related_terms} onChange={(v) => patch("search_keywords", { related_terms: v })} />
                <TagInput label="Competitor / alternative keywords" values={K.competitor_or_alternative_keywords} onChange={(v) => patch("search_keywords", { competitor_or_alternative_keywords: v })} />
              </div>
              <TagInput label="Exclude keywords" values={K.exclude_keywords} onChange={(v) => patch("search_keywords", { exclude_keywords: v })} />
            </Section>

            {/* 8. Sillage signals */}
            <Section title="Sillage Signals">
              {(() => {
                const enabledSignals = icp.sillage_signal_config.selected_signals.filter((s) => s.enabled);
                const enabledTypes = new Set(enabledSignals.map((s) => s.signal_type));
                const remainingTypes = SILLAGE_SIGNAL_TYPES.filter((t) => !enabledTypes.has(t));
                return (
                  <div className="space-y-5">
                    {enabledSignals.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Auto-selected</p>
                        <div className="space-y-2">
                          {enabledSignals.map((sig) => (
                            <div key={sig.signal_type} className="rounded-lg border border-primary/50 bg-primary/[0.03] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium capitalize">{sig.signal_type.replace(/_/g, " ")}</span>
                                  {sig.reason_for_relevance && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{sig.reason_for_relevance}</p>
                                  )}
                                </div>
                                <Switch checked={true} onCheckedChange={() => toggleSignal(sig.signal_type)} />
                              </div>
                              <div className="mt-3 space-y-2">
                                <SelectField label="Priority" value={sig.priority} options={SIGNAL_PRIORITIES} onChange={(v) => updateSignal(sig.signal_type, { priority: v as any })} />
                                <TagInput label="Keywords" values={sig.keywords} onChange={(v) => updateSignal(sig.signal_type, { keywords: v })} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {enabledSignals.length > 0 ? "Add more signals" : "Signals"}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {remainingTypes.map((type) => (
                          <div key={type} className="rounded-lg border border-border/50 p-3 flex items-center justify-between">
                            <span className="text-xs font-medium capitalize">{type.replace(/_/g, " ")}</span>
                            <Switch checked={false} onCheckedChange={() => toggleSignal(type)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Section>

            {/* 9. Exa config */}
            <Section title="Exa Configuration">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField label="Entity type" value={E.exa_entity_type} options={EXA_ENTITY_TYPES} onChange={(v) => patch("exa_config", { exa_entity_type: v as any })} />
                <SelectField label="Search mode" value={E.exa_search_mode} options={EXA_SEARCH_MODES} onChange={(v) => patch("exa_config", { exa_search_mode: v as any })} />
                <SelectField label="Freshness" value={E.exa_freshness} options={EXA_FRESHNESS} onChange={(v) => patch("exa_config", { exa_freshness: v as any })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Result count</label>
                <Input type="number" value={E.exa_result_count} className="h-8 text-xs w-32"
                  onChange={(e) => patch("exa_config", { exa_result_count: Number(e.target.value) || 50 })} />
              </div>
              <TagInput label="Exa criteria (natural-language filters)" values={E.exa_criteria} onChange={(v) => patch("exa_config", { exa_criteria: v })} />
              <TagInput label="Output fields" values={E.exa_output_fields} onChange={(v) => patch("exa_config", { exa_output_fields: v })} />
              {E.exa_enrichments.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Enrichments</label>
                  <div className="space-y-1">
                    {E.exa_enrichments.map((en, i) => (
                      <div key={i} className="text-xs rounded-md bg-muted/40 px-2 py-1.5">
                        <span className="font-medium">{en.name}</span>
                        <span className="text-muted-foreground"> · {en.format} — {en.prompt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* 10. Learning loop (read-only) */}
            <Section title="ICP Learning Loop">
              <p className="text-xs text-muted-foreground">
                Accepted: {icp.learning_loop.accepted_leads.length} · Rejected: {icp.learning_loop.rejected_leads.length}. The ICP tightens as you accept/reject leads.
              </p>
              {icp.learning_loop.next_questions_to_improve_icp.length > 0 && (
                <TagInput label="Next questions to improve ICP" values={icp.learning_loop.next_questions_to_improve_icp}
                  onChange={(v) => patch("learning_loop", { next_questions_to_improve_icp: v })} />
              )}
            </Section>
          </div>
        </div>

        {/* action bar */}
        <div className="border-t border-border/40 bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-4xl w-full px-6 py-3 flex justify-between">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/")}>← Back to ICPs</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={runSearch}>
                <Search className="h-3.5 w-3.5" /> Run lead search
              </Button>
              <Button size="sm" className="h-9 text-xs gap-1.5" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save ICP
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
