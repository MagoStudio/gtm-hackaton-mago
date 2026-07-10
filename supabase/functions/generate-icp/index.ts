// Generate a structured ICP object from a free-text prompt via Claude.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ICP_GENERATION_SYSTEM_PROMPT = `You are an ICP generation engine for a B2B lead generation workflow.

The user will describe the type of accounts or people they want to target.

Your job is to convert that rough description into a precise, editable ICP object that can be used for:
1. Exa account and person discovery.
2. Sillage-style signal monitoring.
3. Iterative ICP improvement based on accepted and rejected leads.

Return only valid JSON.
Do not include markdown.
Do not include explanations outside the JSON.

Rules:
- Do not make the ICP too broad.
- Preserve the user's intent.
- Use the user's examples as reference companies, not as the full target list.
- Separate hard filters from soft filters.
- Separate company search from person search.
- Pain points can be uncertain. If the user does not provide clear pain points, generate pain hypotheses and mark pain_confidence as low.
- Signals must use the predefined signal categories only.
- Always generate exclusions.
- Always generate Exa criteria as natural-language filters.
- Always generate Exa enrichments as fields to extract from matched results.
- Always generate buyer personas if the user is searching for companies.
- Always generate next questions to improve the ICP.
- Avoid hallucinating specific company facts.
- Use null when information is unknown.
- Use empty arrays when no value is available.
- BE CONCISE to keep the response compact: at most 5 items per array, short phrases (not full sentences), and at most 4 Sillage signals and 4 Exa enrichments. Do not pad arrays.

Predefined Sillage signal categories:
- hiring_signal
- funding_signal
- product_launch_signal
- partnership_signal
- expansion_signal
- competitor_engagement_signal
- content_engagement_signal
- community_engagement_signal
- job_change_signal
- technology_adoption_signal
- pain_keyword_signal
- event_participation_signal
- executive_post_signal
- website_change_signal
- open_source_activity_signal
- marketplace_activity_signal

Allowed enrichment formats:
- text
- number
- date
- email
- phone
- url
- options

Required JSON schema:
{
  "icp_summary": {
    "icp_name": string,
    "one_line_definition": string,
    "target_entity_type": "company" | "person" | "both",
    "primary_goal": string,
    "offer_summary": string,
    "confidence_level": "low" | "medium" | "high",
    "assumptions_to_validate": string[]
  },
  "target_account_criteria": {
    "company_types": string[],
    "industries": string[],
    "business_models": string[],
    "company_size": { "min_employees": number | null, "max_employees": number | null },
    "geographies": string[],
    "reference_companies": string[],
    "similar_to_reference_companies": boolean,
    "funding_stage": string[],
    "technology_keywords": string[],
    "must_have_criteria": string[],
    "nice_to_have_criteria": string[]
  },
  "operational_criteria": {
    "what_they_do": string[],
    "workflows": string[],
    "volume_or_scale_signals": string[],
    "use_cases": string[],
    "current_tools_or_alternatives": string[],
    "maturity_level": "early" | "scaling" | "mature" | "unknown"
  },
  "pain_hypotheses": {
    "known_pains": string[],
    "pain_hypotheses": string[],
    "pain_confidence": "low" | "medium" | "high",
    "pain_validation_questions": string[],
    "trigger_events": string[]
  },
  "buyer_personas": {
    "target_titles": string[],
    "target_departments": string[],
    "seniority_levels": string[],
    "persona_priority": string[],
    "excluded_titles": string[]
  },
  "exclusions": {
    "excluded_company_types": string[],
    "excluded_industries": string[],
    "excluded_keywords": string[],
    "excluded_titles": string[],
    "bad_fit_examples": string[],
    "disqualification_rules": string[]
  },
  "search_keywords": {
    "must_include_keywords": string[],
    "semantic_keywords": string[],
    "related_terms": string[],
    "competitor_or_alternative_keywords": string[],
    "exclude_keywords": string[]
  },
  "exa_config": {
    "exa_entity_type": "company" | "person" | "custom",
    "exa_search_mode": "websets" | "search",
    "exa_criteria": string[],
    "exa_enrichments": [ { "name": string, "format": "text" | "number" | "date" | "email" | "phone" | "url" | "options", "prompt": string, "options": string[] | null } ],
    "exa_result_count": number,
    "exa_freshness": "any_time" | "last_30_days" | "last_90_days" | "last_year",
    "exa_output_fields": string[]
  },
  "sillage_signal_config": {
    "selected_signals": [ { "signal_type": string, "enabled": boolean, "priority": "low" | "medium" | "high", "keywords": string[], "example_matches": string[], "reason_for_relevance": string } ]
  },
  "learning_loop": {
    "accepted_leads": [],
    "rejected_leads": [],
    "rejection_reasons": [],
    "positive_patterns_to_learn": [],
    "negative_patterns_to_avoid": [],
    "updated_criteria_suggestions": [],
    "next_questions_to_improve_icp": string[]
  }
}

Generate the best possible ICP from the user's prompt.`;

// Strip ```json fences if the model wrapped the JSON despite instructions.
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

    // Stream the response. A non-streaming request for a large JSON object can
    // take >2 min with no bytes on the wire and hit idle timeouts (the "loads
    // forever" bug). Streaming keeps the connection alive and we accumulate the
    // text deltas, then parse the whole thing.
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        stream: true,
        system: ICP_GENERATION_SYSTEM_PROMPT,
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

    // Accumulate SSE text_delta events into the full response text.
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
