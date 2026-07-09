import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const ENRICHMENT_SYSTEM_PROMPT = `You are a B2B lead intelligence analyst. You will be given research data about a company. Analyze it and produce a structured fit assessment.

Scoring criteria (1-10):
- Hot (9-10): Strong fit, active buying signals, identifiable decision-makers, recent relevant activity
- Warm (6-8): Reasonable fit, some signals, plausible decision-makers
- Cool (3-5): Weak fit, limited signals
- Cold (1-2): Not a relevant target

Stay neutral about industry — infer fit from the research data, not from any preset vertical.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!EXA_API_KEY) throw new Error("EXA_API_KEY is not configured");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { leadId, leadIds } = await req.json();
    const ids: string[] = leadIds || (leadId ? [leadId] : []);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "leadId or leadIds required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch leads
    const { data: leads, error: fetchErr } = await supabase
      .from("lead_candidates")
      .select("*")
      .in("id", ids)
      .eq("user_id", user.id);

    if (fetchErr || !leads?.length) {
      return new Response(JSON.stringify({ error: "Leads not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process leads in parallel to avoid timing out on bulk enrichment.
    const results = await Promise.all(leads.map(async (lead) => {
      try {
        const companyName = lead.company || "Unknown";
        const website = lead.website || "";

        // Run all 3 Exa searches in parallel
        const [companySearch, peopleSearch, newsSearch] = await Promise.all([
          exaSearch(EXA_API_KEY, `${companyName} company overview`, "company"),
          exaSearch(EXA_API_KEY, `${companyName} leadership team executives`, "linkedin profile"),
          exaSearch(EXA_API_KEY, `${companyName} news 2024 2025`, "news"),
        ]);

        const researchContext = `
COMPANY: ${companyName}
WEBSITE: ${website}
EXISTING SUMMARY: ${lead.summary || "None"}

COMPANY RESEARCH:
${formatResults(companySearch)}

PEOPLE FOUND:
${formatResults(peopleSearch)}

RECENT NEWS:
${formatResults(newsSearch)}
`;

        const aiResponse = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 2000,
            system: ENRICHMENT_SYSTEM_PROMPT,
            messages: [{ role: "user", content: researchContext }],
            tools: [
              {
                name: "enrich_lead",
                description: "Return structured enrichment data for the lead",
                input_schema: {
                  type: "object",
                  properties: {
                    summary: { type: "string", description: "2-3 sentence company summary" },
                    company_type: { type: "string", description: "Short label for the type of company (free-form)" },
                    fit_score: { type: "integer", description: "1-10 fit score" },
                    fit_reason: { type: "string", description: "Why this score" },
                    pain_points: { type: "array", items: { type: "string" }, description: "Identified pain points" },
                    tech_stack: { type: "array", items: { type: "string" }, description: "Known tools and technologies" },
                    product_hooks: { type: "array", items: { type: "string" }, description: "Angles to pitch the product" },
                    champions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          title: { type: "string" },
                          linkedin_url: { type: "string" },
                        },
                        required: ["name", "title"],
                      },
                      description: "Key decision-makers",
                    },
                    recent_signals: { type: "array", items: { type: "string" }, description: "Recent news, projects, funding" },
                    region: { type: "string", description: "Geographic region (US, EU, UK, etc.)" },
                    employee_count: { type: "string", description: "Estimated headcount range" },
                    funding_stage: { type: "string", description: "Funding stage if known" },
                    location: { type: "string", description: "City, Country" },
                  },
                  required: ["summary", "company_type", "fit_score", "fit_reason", "pain_points", "tech_stack", "product_hooks", "champions", "region"],
                },
              },
            ],
            tool_choice: { type: "tool", name: "enrich_lead" },
          }),
        });

        if (!aiResponse.ok) {
          const txt = await aiResponse.text();
          console.error(`Anthropic error for ${lead.id}: ${aiResponse.status} ${txt}`);
          return null;
        }

        const aiData = await aiResponse.json();
        const toolUse = (aiData.content || []).find((b: { type: string }) => b.type === "tool_use");
        if (!toolUse) {
          console.error(`No tool use in AI response for ${lead.id}`);
          return null;
        }

        const enrichment = toolUse.input;

        // Best-effort Sillage augmentation: power-map contacts + buying signals.
        // Never breaks the core Exa+Claude enrichment if Sillage is slow/empty.
        try {
          const sillage = await sillageAugment(lead.website, lead.linkedin_url);
          if (sillage.champions.length) {
            enrichment.champions = [...(enrichment.champions || []), ...sillage.champions];
          }
          if (sillage.signals.length) {
            enrichment.recent_signals = [...(enrichment.recent_signals || []), ...sillage.signals];
          }
        } catch (e) {
          console.error(`Sillage augment failed for ${lead.id}:`, e);
        }

        const { error: updateErr } = await supabase
          .from("lead_candidates")
          .update({
            summary: enrichment.summary,
            studio_type: enrichment.company_type,
            fit_score: enrichment.fit_score,
            fit_reason: enrichment.fit_reason,
            pain_points: enrichment.pain_points || [],
            tech_stack: enrichment.tech_stack || [],
            product_hooks: enrichment.product_hooks || [],
            champions: enrichment.champions || [],
            recent_signals: enrichment.recent_signals || [],
            region: enrichment.region,
            employee_count: enrichment.employee_count,
            funding_stage: enrichment.funding_stage,
            location: enrichment.location,
            research_depth: "enriched",
            last_enriched_at: new Date().toISOString(),
          })
          .eq("id", lead.id);

        if (updateErr) {
          console.error("Update error:", updateErr);
          return null;
        }
        return { id: lead.id, ...enrichment };
      } catch (e) {
        console.error(`Enrichment failed for lead ${lead.id}:`, e);
        return null;
      }
    }));

    const enriched = results.filter((r): r is NonNullable<typeof r> => r !== null);

    return new Response(JSON.stringify({ enriched, total: enriched.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-lead error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function exaSearch(apiKey: string, query: string, category?: string): Promise<any[]> {
  try {
    const body: any = {
      query,
      type: "auto",
      numResults: 5,
      contents: { highlights: { maxCharacters: 2000 } },
    };
    if (category) body.category = category;

    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

function formatResults(results: any[]): string {
  if (!results.length) return "No results found.";
  return results
    .map((r: any) => `- ${r.title || "Untitled"} (${r.url || "no url"})\n  ${(r.highlights || []).slice(0, 2).join(" ").slice(0, 300)}`)
    .join("\n");
}

const SILLAGE_BASE = "https://api.getsillage.com/api/v2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function domainFrom(website?: string | null): string | null {
  if (!website) return null;
  const m = website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return m && m.includes(".") ? m : null;
}

// Best-effort Sillage enrichment: kicks off a company mapping, polls briefly for
// the ICP-matched power-map (profiles), and pulls recent buying signals.
// Returns empty arrays on any failure / no key / not ready — never throws.
async function sillageAugment(
  website?: string | null,
  linkedinUrl?: string | null,
): Promise<{ champions: { name: string; title: string; linkedin_url?: string }[]; signals: string[] }> {
  const empty = { champions: [], signals: [] };
  const key = Deno.env.get("SILLAGE_API_KEY");
  if (!key) return empty;
  const domain = domainFrom(website);
  if (!domain && !linkedinUrl) return empty;

  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  // Kick off enrichment (async). Ignore 402/409/4xx — existing mappings may still resolve.
  try {
    await fetch(`${SILLAGE_BASE}/enrich-company-mapping`, {
      method: "POST",
      headers,
      body: JSON.stringify(domain ? { domain } : { linkedin_url: linkedinUrl }),
    });
  } catch { /* ignore */ }

  const champions: { name: string; title: string; linkedin_url?: string }[] = [];

  // Poll company-mappings for a completed match (~16s budget).
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(4000);
    try {
      const res = await fetch(`${SILLAGE_BASE}/company-mappings?page_size=25`, { headers });
      if (!res.ok) continue;
      const list = await res.json();
      const match = (list.data || []).find((m: any) =>
        m.status === "complete" && domain && m.company?.domain?.toLowerCase() === domain);
      if (!match) continue;
      const detailRes = await fetch(`${SILLAGE_BASE}/company-mappings/${match.id}`, { headers });
      if (!detailRes.ok) break;
      const detail = await detailRes.json();
      for (const p of detail.profiles || []) {
        const name = p.name || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
        if (!name) continue;
        champions.push({ name, title: p.title || p.job_title || "", linkedin_url: p.linkedin_url || undefined });
      }
      break;
    } catch { /* keep polling */ }
  }

  // Recent buying signals (best-effort).
  const signals: string[] = [];
  try {
    const sigRes = await fetch(`${SILLAGE_BASE}/contents/query`, {
      method: "POST", headers, body: JSON.stringify({ page_size: 5 }),
    });
    if (sigRes.ok) {
      const sig = await sigRes.json();
      for (const item of sig.data || []) {
        const text = item.title || item.summary || item.text || item.type;
        if (text) signals.push(String(text).slice(0, 200));
      }
    }
  } catch { /* ignore */ }

  return { champions, signals };
}
