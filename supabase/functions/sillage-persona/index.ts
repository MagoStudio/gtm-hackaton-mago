// Sillage persona (ICP) proxy.
// Reads and writes the workspace ICP via Sillage's /persona endpoint.
// action: "get"    -> returns the current Sillage persona
// action: "update" -> PUTs the provided persona fields to Sillage
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SILLAGE_BASE = "https://api.getsillage.com/api/v2";

// Sillage persona shape. All list fields are optional; missing = leave unset.
interface SillagePersona {
  job_title?: string[];
  exclude_job_title?: string[];
  location?: string[];
  headcount?: string[];
  industry?: string[];
  seniority?: string[];
  additional_info?: string | null;
}

// Only forward keys Sillage accepts, so stray UI fields never reach the API.
const PERSONA_KEYS: (keyof SillagePersona)[] = [
  "job_title",
  "exclude_job_title",
  "location",
  "headcount",
  "industry",
  "seniority",
  "additional_info",
];

function pickPersona(input: Record<string, unknown>): SillagePersona {
  const out: SillagePersona = {};
  for (const k of PERSONA_KEYS) {
    if (input[k] !== undefined) (out as Record<string, unknown>)[k] = input[k];
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SILLAGE_API_KEY = Deno.env.get("SILLAGE_API_KEY");
    if (!SILLAGE_API_KEY) throw new Error("SILLAGE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Require an authenticated user (same pattern as discover-leads/enrich-lead)
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, persona } = await req.json().catch(() => ({ action: "get" }));

    const sillageHeaders = {
      Authorization: `Bearer ${SILLAGE_API_KEY}`,
      "Content-Type": "application/json",
    };

    if (action === "update") {
      const body = pickPersona((persona || {}) as Record<string, unknown>);
      const res = await fetch(`${SILLAGE_BASE}/persona`, {
        method: "PUT",
        headers: sillageHeaders,
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "Sillage rejected the persona", status: res.status, detail: json }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ persona: json?.data ?? json }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // default: get
    const res = await fetch(`${SILLAGE_BASE}/persona`, { headers: sillageHeaders });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch Sillage persona", status: res.status, detail: json }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ persona: json?.data ?? json }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sillage-persona error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
