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
import { Loader2, Save, Search, Target } from "lucide-react";
import { emptyIcp, type Icp, TARGET_ENTITY_TYPES, SENIORITY_LEVELS } from "@/lib/icp-schema";

/* ---------- field helpers ---------- */

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

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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

  const incoming = (location.state as { icp?: Partial<Icp>; prompt?: string } | null) || null;
  const [icp, setIcp] = useState<Icp>(() => ({ ...emptyIcp(), ...(incoming?.icp || {}) }));
  const [prompt] = useState(incoming?.prompt || "");
  const [icpKey, setIcpKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loadingRow, setLoadingRow] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from("icps").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) {
        setIcp({ ...emptyIcp(), ...(data.definition as unknown as Partial<Icp>) });
        setIcpKey(data.icp_key);
        setVersion(data.version);
      }
      setLoadingRow(false);
    });
  }, [id, user]);

  const set = useCallback(<K extends keyof Icp>(field: K, value: Icp[K]) => {
    setIcp((prev) => ({ ...prev, [field]: value }));
  }, []);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const key = icpKey || crypto.randomUUID();
      const { data, error } = await supabase.from("icps").insert({
        user_id: user.id,
        icp_key: key,
        version: version + 1,
        name: icp.icp_name || "Untitled ICP",
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
    const query = icp.exa_query || icp.one_line_definition || prompt;
    navigate("/agents/lead-gen", { state: { query } });
  };

  if (loading || loadingRow) {
    return <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl w-full px-6 py-8 space-y-5">
            <div className="flex items-center gap-2.5">
              <Target className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">{icp.icp_name || "New ICP"}</h1>
              {version > 0 && <span className="text-xs font-normal text-muted-foreground">v{version}</span>}
            </div>

            <Section title="Definition">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">ICP name</label>
                <Input value={icp.icp_name} onChange={(e) => set("icp_name", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">One-line definition</label>
                <Input value={icp.one_line_definition} onChange={(e) => set("one_line_definition", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Target</label>
                <select value={icp.target_entity_type} onChange={(e) => set("target_entity_type", e.target.value as Icp["target_entity_type"])}
                  className="h-8 text-xs w-40 rounded-md border border-border/60 bg-background px-2">
                  {TARGET_ENTITY_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </Section>

            <Section title="Exa search query" subtitle="The natural-language query used to discover leads. This is what powers the search.">
              <Textarea value={icp.exa_query} onChange={(e) => set("exa_query", e.target.value)}
                className="text-xs min-h-[80px]" placeholder="e.g. Vertical drama studios producing short-form 9:16 episodes, similar to ReelShort and DramaBox" />
            </Section>

            <Section title="Targeting">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TagInput label="Industries" values={icp.industries} onChange={(v) => set("industries", v)} placeholder="SaaS, Media…" />
                <TagInput label="Geographies" values={icp.geographies} onChange={(v) => set("geographies", v)} placeholder="France, US…" />
                <TagInput label="Reference companies" values={icp.reference_companies} onChange={(v) => set("reference_companies", v)} placeholder="ReelShort, DramaBox…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Min employees</label>
                  <Input type="number" value={icp.company_size.min_employees ?? ""} className="h-8 text-xs"
                    onChange={(e) => set("company_size", { ...icp.company_size, min_employees: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Max employees</label>
                  <Input type="number" value={icp.company_size.max_employees ?? ""} className="h-8 text-xs"
                    onChange={(e) => set("company_size", { ...icp.company_size, max_employees: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
            </Section>

            <Section title="Criteria">
              <TagInput label="Must-have (hard filters)" values={icp.must_have_criteria} onChange={(v) => set("must_have_criteria", v)} />
              <TagInput label="Nice-to-have (soft signals)" values={icp.nice_to_have_criteria} onChange={(v) => set("nice_to_have_criteria", v)} />
              <TagInput label="Exclusions" values={icp.exclusions} onChange={(v) => set("exclusions", v)} />
              <TagInput label="Search keywords" values={icp.search_keywords} onChange={(v) => set("search_keywords", v)} />
            </Section>

            <Section title="People" subtitle="Who to target inside matched companies.">
              <TagInput label="Target titles" values={icp.target_titles} onChange={(v) => set("target_titles", v)} placeholder="Head of Production, CEO…" />
              <TagInput label="Seniority levels" values={icp.seniority_levels} onChange={(v) => set("seniority_levels", v)} placeholder={SENIORITY_LEVELS.join(", ")} />
            </Section>
          </div>
        </div>

        <div className="border-t border-border/40 bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl w-full px-6 py-3 flex justify-between">
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
