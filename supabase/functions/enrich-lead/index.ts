import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ENRICH_MODEL = "claude-haiku-4-5";

const ENRICHMENT_SYSTEM_PROMPT = `You are a B2B lead intelligence analyst. You will be given research data about a company. Analyze it and produce a structured fit assessment.

Scoring criteria (1-10):
- Hot (9-10): Strong fit, active buying signals, identifiable decision-makers, recent relevant activity
- Warm (6-8): Reasonable fit, some signals, plausible decision-makers
- Cool (3-5): Weak fit, limited signals
- Cold (1-2): Not a relevant target

Stay neutral about industry — infer fit from the research data, not from any preset vertical.`;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!EXA_API_KEY) throw new Error("EXA_API_KEY is not configured");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
    const model = Deno.env.get("ANTHROPIC_ENRICH_MODEL") || Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_ENRICH_MODEL;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
          exaSearch(EXA_API_KEY, `${companyName} leadership team executives`, "people"),
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

        const aiResponse = await fetchWithTimeout(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
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
        }, 25_000);

        if (!aiResponse.ok) {
          const txt = await aiResponse.text();
          console.error(`Anthropic error for ${lead.id}: ${aiResponse.status} ${txt}`);
          return { id: lead.id, error: `Anthropic ${aiResponse.status}: ${txt.slice(0, 200)}` };
        }

        const aiData = await aiResponse.json();
        const toolUse = (aiData.content || []).find((b: { type: string }) => b.type === "tool_use");
        if (!toolUse) {
          console.error(`No tool use in AI response for ${lead.id}`);
          return { id: lead.id, error: "Anthropic returned no enrichment tool result" };
        }

        const enrichment = toolUse.input;

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
          return { id: lead.id, error: `Database update failed: ${updateErr.message}` };
        }
        return { id: lead.id, ...enrichment };
      } catch (e) {
        console.error(`Enrichment failed for lead ${lead.id}:`, e);
        return { id: lead.id, error: e instanceof Error ? e.message : "Unknown enrichment error" };
      }
    }));

    const enriched = results.filter((r) => r && !("error" in r));
    const errors = results.filter((r) => r && "error" in r);

    return new Response(JSON.stringify({ enriched, errors, total: enriched.length }), {
      status: enriched.length > 0 || errors.length === 0 ? 200 : 502,
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

    const res = await fetchWithTimeout("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 8_000);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Exa search failed ${res.status}: ${text.slice(0, 200)}`);
      return [];
    }
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
