import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const OUTREACH_SYSTEM_PROMPT = `You are an expert B2B sales copywriter.

Write a personalized cold outreach email that:
- References specific pain points and recent signals from the research
- Mentions the recipient's tech stack or notable recent activity when available
- Is concise (under 150 words), conversational, and non-salesy
- Has a clear, low-friction CTA (e.g., "Would a 15-min call be worth exploring?")
- Never uses generic phrases like "I hope this finds you well"

Tone: Technical peer, not sales rep.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const { leadId } = await req.json();
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: fetchErr } = await supabase
      .from("lead_candidates")
      .select("*")
      .eq("id", leadId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const champion = Array.isArray(lead.champions) && lead.champions.length > 0
      ? lead.champions[0] as { name?: string; title?: string }
      : null;

    const recipientName = champion?.name || lead.contact_name || "there";
    const recipientTitle = champion?.title || lead.job_title || "";

    const context = `
RECIPIENT: ${recipientName}, ${recipientTitle} at ${lead.company || "the company"}
SUMMARY: ${lead.summary || "No summary available"}
PAIN POINTS: ${(lead.pain_points || []).join(", ") || "Unknown"}
TECH STACK: ${(lead.tech_stack || []).join(", ") || "Unknown"}
PRODUCT HOOKS: ${(lead.product_hooks || []).join(", ") || "General"}
RECENT SIGNALS: ${(lead.recent_signals || []).join(", ") || "None"}
REGION: ${lead.region || "Unknown"}

Generate a subject line and email body.`;

    const aiResponse = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: OUTREACH_SYSTEM_PROMPT },
          { role: "user", content: context },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email",
              description: "Return the outreach email",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Email body text" },
                },
                required: ["subject", "body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_email" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error [${status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const email = JSON.parse(toolCall.function.arguments);

    // Save draft
    const { data: savedEmail, error: saveErr } = await supabase
      .from("outreach_emails")
      .insert({
        user_id: user.id,
        recipient_name: recipientName,
        recipient_email: lead.email || champion?.name || null,
        subject: email.subject,
        body: email.body,
        status: "draft",
      })
      .select()
      .single();

    if (saveErr) console.error("Save email error:", saveErr);

    return new Response(JSON.stringify({ email: { subject: email.subject, body: email.body }, savedId: savedEmail?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outreach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
