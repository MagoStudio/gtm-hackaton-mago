import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
    if (!EXA_API_KEY) throw new Error("EXA_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search Exa with the user's query only
    const allResults: any[] = [];
    try {
      const exaRes = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": EXA_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          type: "auto",
          category: "company",
          numResults: 50,
          contents: {
            highlights: { maxCharacters: 2000 },
          },
        }),
      });

      if (exaRes.ok) {
        const data = await exaRes.json();
        if (data.results) allResults.push(...data.results);
      }
    } catch (e) {
      console.error(`Exa search failed for query: ${query}`, e);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const filtered = allResults.filter((r) => {
      const key = (r.url || "").replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Get existing leads for dedup
    const { data: existing } = await supabase
      .from("lead_candidates")
      .select("website, company")
      .eq("user_id", user.id);

    const existingWebsites = new Set((existing || []).map((e: any) => (e.website || "").toLowerCase().replace(/\/$/, "")));
    const existingCompanies = new Set((existing || []).map((e: any) => (e.company || "").toLowerCase()));

    // Build inserts
    const inserts = filtered
      .filter((r) => {
        const url = (r.url || "").toLowerCase().replace(/\/$/, "");
        const title = (r.title || "").toLowerCase();
        return !existingWebsites.has(url) && !existingCompanies.has(title);
      })
      .map((r) => ({
        user_id: user.id,
        company: r.title || "Unknown",
        website: r.url || null,
        source: "exa_discovery",
        status: "pending",
        research_depth: "basic",
        summary: (r.highlights || []).slice(0, 2).join(" ").slice(0, 500) || null,
      }));

    let insertedLeads: any[] = [];
    if (inserts.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("lead_candidates")
        .insert(inserts)
        .select("*");
      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to insert leads" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      insertedLeads = inserted || [];
    }

    // Return ONLY the leads discovered in this search — never mix in
    // older pending rows from previous (possibly unrelated) queries.
    return new Response(JSON.stringify({ leads: insertedLeads, inserted: insertedLeads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("discover-leads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
