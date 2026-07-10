// Generate a lean, Exa-focused ICP object from a free-text prompt via Claude.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ICP_SYSTEM_PROMPT = `You turn a rough targeting description into a lean, precise ICP for lead discovery with Exa (a neural web search engine).

Return ONLY valid JSON — no markdown, no prose outside the JSON.

Rules:
- Preserve the user's intent; don't make the ICP too broad.
- Treat the user's examples as reference_companies, not the full target list.
- exa_query is the most important field: a single natural-language search query describing the companies/people to find, phrased the way they'd be described on the web. Make it specific and self-contained.
- Separate must_have_criteria (hard filters every result must satisfy) from nice_to_have_criteria (soft signals).
- Always include exclusions to cut noise.
- Be concise: at most 6 items per array, short phrases (not sentences). Use empty arrays / null when unknown. Do not pad.

Required JSON schema:
{
  "icp_name": string,
  "one_line_definition": string,
  "target_entity_type": "company" | "person",
  "exa_query": string,
  "industries": string[],
  "geographies": string[],
  "company_size": { "min_employees": number | null, "max_employees": number | null },
  "reference_companies": string[],
  "must_have_criteria": string[],
  "nice_to_have_criteria": string[],
  "exclusions": string[],
  "search_keywords": string[],
  "target_titles": string[],
  "seniority_levels": string[]
}

Generate the best possible ICP from the user's prompt.`;

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1) return text.slice(first, last + 1);
  return text.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream so the connection stays alive; accumulate text deltas, then parse.
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        stream: true,
        system: ICP_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok || !aiRes.body) {
      const errText = await aiRes.text().catch(() => "");
      console.error("Anthropic error", aiRes.status, errText);
      return new Response(JSON.stringify({ error: `AI error ${aiRes.status}`, detail: errText.slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            fullText += evt.delta.text;
          }
        } catch { /* ignore keep-alive / partial lines */ }
      }
    }

    if (!fullText.trim()) throw new Error("No text in AI response");

    let icp: unknown;
    try {
      icp = JSON.parse(extractJson(fullText));
    } catch (e) {
      console.error("Failed to parse ICP JSON:", e, fullText.slice(0, 300));
      return new Response(JSON.stringify({ error: "Failed to parse ICP from AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ icp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-icp error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
