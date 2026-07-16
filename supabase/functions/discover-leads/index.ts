import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Icp {
  target_entity_type?: "company" | "person";
  exa_query?: string;
  industries?: string[];
  geographies?: string[];
  company_size?: { min_employees?: number | null; max_employees?: number | null };
  reference_companies?: string[];
  must_have_criteria?: string[];
  search_keywords?: string[];
  exclusions?: string[];
}

// Fold the structured ICP into a single rich Exa query.
function buildQuery(icp: Icp, fallback: string): string {
  const parts: string[] = [icp.exa_query || fallback];
  if (icp.industries?.length) parts.push(icp.industries.join(", "));
  if (icp.geographies?.length) parts.push(`based in ${icp.geographies.join(" or ")}`);
  if (icp.reference_companies?.length) parts.push(`similar to ${icp.reference_companies.join(", ")}`);
  if (icp.must_have_criteria?.length) parts.push(icp.must_have_criteria.join("; "));
  if (icp.search_keywords?.length) parts.push(icp.search_keywords.join(", "));
  const size = icp.company_size;
  if (size?.min_employees || size?.max_employees) {
    parts.push(`company size ${size?.min_employees ?? "?"}-${size?.max_employees ?? "?"} employees`);
  }
  return parts.filter(Boolean).join(". ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
    if (!EXA_API_KEY) throw new Error("EXA_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { query, icpKey } = await req.json();

    // Load the ICP (latest version) when a key is provided, so discovery
    // respects the full criteria — not just the free-text query.
    let icp: Icp = {};
    if (icpKey) {
      const { data: rows } = await supabase
        .from("icps").select("definition, version").eq("user_id", user.id).eq("icp_key", icpKey).order("version", { ascending: false }).limit(1);
      if (rows?.[0]?.definition) icp = rows[0].definition as Icp;
    }

    const entityType = icp.target_entity_type === "person" ? "person" : "company";
    const category = entityType === "person" ? "linkedin profile" : "company";
    const searchQuery = (icpKey ? buildQuery(icp, query || "") : query) || "";
    if (!searchQuery) {
      return new Response(JSON.stringify({ error: "query or icpKey required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allResults: any[] = [];
    try {
      const exaRes = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "x-api-key": EXA_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, type: "auto", category, numResults: 50, contents: { highlights: { maxCharacters: 2000 } } }),
      });
      if (exaRes.ok) {
        const data = await exaRes.json();
        if (data.results) allResults.push(...data.results);
      } else {
        console.error("Exa error", exaRes.status, (await exaRes.text()).slice(0, 200));
      }
    } catch (e) {
      console.error(`Exa search failed for: ${searchQuery}`, e);
    }

    // Dedup by URL.
    const seen = new Set<string>();
    let filtered = allResults.filter((r) => {
      const key = (r.url || "").replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Exclusion post-filter: drop results whose text matches any exclusion term.
    const excludeTerms = (icp.exclusions || []).map((e) => e.toLowerCase()).filter(Boolean);
    if (excludeTerms.length) {
      filtered = filtered.filter((r) => {
        const hay = `${r.title || ""} ${r.url || ""} ${(r.highlights || []).join(" ")}`.toLowerCase();
        return !excludeTerms.some((t) => hay.includes(t));
      });
    }

    // Dedup against existing leads.
    const { data: existing } = await supabase.from("lead_candidates").select("website, company, contact_name").eq("user_id", user.id);
    const existingWebsites = new Set((existing || []).map((e: any) => (e.website || "").toLowerCase().replace(/\/$/, "")));
    const existingNames = new Set((existing || []).map((e: any) => (e.company || e.contact_name || "").toLowerCase()));

    const inserts = filtered
      .filter((r) => {
        const url = (r.url || "").toLowerCase().replace(/\/$/, "");
        const title = (r.title || "").toLowerCase();
        return !existingWebsites.has(url) && !existingNames.has(title);
      })
      .map((r) => ({
        user_id: user.id,
        // People search: the title is a person; company search keeps it as the company.
        company: entityType === "person" ? null : (r.title || "Unknown"),
        contact_name: entityType === "person" ? (r.title || null) : null,
        entity_type: entityType,
        website: r.url || null,
        source: "exa_discovery",
        status: "pending",
        research_depth: "basic",
        summary: (r.highlights || []).slice(0, 2).join(" ").slice(0, 500) || null,
      }));

    let insertedLeads: any[] = [];
    if (inserts.length > 0) {
      const { data: inserted, error: insertError } = await supabase.from("lead_candidates").insert(inserts).select("*");
      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to insert leads" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      insertedLeads = inserted || [];
    }

    return new Response(JSON.stringify({ leads: insertedLeads, inserted: insertedLeads.length, entityType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("discover-leads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
