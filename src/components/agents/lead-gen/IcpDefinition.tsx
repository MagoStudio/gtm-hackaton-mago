import { useEffect, useState } from "react";
import { Target, Loader2, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Sillage's accepted headcount buckets (from GET /persona)
const HEADCOUNT_OPTIONS = [
  "1-10", "11-50", "51-200", "201-500",
  "501-1,000", "1,001-5,000", "5,001-10,000", "10,001+",
];

export interface SillagePersona {
  job_title: string[];
  exclude_job_title: string[];
  location: string[];
  headcount: string[];
  industry: string[];
  seniority: string[];
  additional_info: string | null;
}

const EMPTY: SillagePersona = {
  job_title: [],
  exclude_job_title: [],
  location: [],
  headcount: [],
  industry: [],
  seniority: [],
  additional_info: "",
};

/** Comma/enter-driven tag input backed by a string[]. */
function TagField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...values, ...parts]));
    onChange(next);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="text-xs gap-1 cursor-pointer hover:bg-destructive/15"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              {v}
              <span className="text-muted-foreground">×</span>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
    </div>
  );
}

/**
 * Structured ICP editor backed by Sillage's persona endpoint.
 * Loads the current workspace persona on mount and lets the user
 * refine + sync it back to Sillage.
 */
export function IcpDefinition() {
  const [persona, setPersona] = useState<SillagePersona>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sillage-persona", {
        body: { action: "get" },
      });
      if (error) throw error;
      const p = data?.persona;
      if (p) {
        setPersona({
          job_title: p.job_title ?? [],
          exclude_job_title: p.exclude_job_title ?? [],
          location: p.location ?? [],
          headcount: p.headcount ?? [],
          industry: p.industry ?? [],
          seniority: p.seniority ?? [],
          additional_info: p.additional_info ?? "",
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load ICP from Sillage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("sillage-persona", {
        body: { action: "update", persona },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.detail?.message || data.error);
      toast.success("ICP synced to Sillage");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e: any) {
      toast.error(e.message || "Failed to sync ICP");
    } finally {
      setSaving(false);
    }
  };

  const toggleHeadcount = (h: string) => {
    setPersona((p) => ({
      ...p,
      headcount: p.headcount.includes(h)
        ? p.headcount.filter((x) => x !== h)
        : [...p.headcount, h],
    }));
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          ICP Definition
          <span className="text-[10px] font-normal text-muted-foreground">via Sillage</span>
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={load} disabled={loading || saving}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagField
                label="Job titles"
                values={persona.job_title}
                onChange={(v) => setPersona((p) => ({ ...p, job_title: v }))}
                placeholder="CMO, Head of RevOps…"
              />
              <TagField
                label="Exclude titles"
                values={persona.exclude_job_title}
                onChange={(v) => setPersona((p) => ({ ...p, exclude_job_title: v }))}
                placeholder="Intern, Assistant…"
              />
              <TagField
                label="Location"
                values={persona.location}
                onChange={(v) => setPersona((p) => ({ ...p, location: v }))}
                placeholder="France, Germany…"
              />
              <TagField
                label="Industry"
                values={persona.industry}
                onChange={(v) => setPersona((p) => ({ ...p, industry: v }))}
                placeholder="SaaS, Fintech…"
              />
              <TagField
                label="Seniority"
                values={persona.seniority}
                onChange={(v) => setPersona((p) => ({ ...p, seniority: v }))}
                placeholder="C-Level, VP, Director…"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Headcount</label>
              <div className="flex flex-wrap gap-1.5">
                {HEADCOUNT_OPTIONS.map((h) => {
                  const on = persona.headcount.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleHeadcount(h)}
                      className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Additional context</label>
              <Textarea
                value={persona.additional_info ?? ""}
                onChange={(e) => setPersona((p) => ({ ...p, additional_info: e.target.value }))}
                placeholder="Free-form notes to steer targeting (e.g. buying triggers, disqualifiers)…"
                className="text-xs min-h-[64px]"
              />
            </div>

            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : justSaved ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Target className="h-3.5 w-3.5" />
                )}
                {justSaved ? "Synced" : "Sync to Sillage"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
