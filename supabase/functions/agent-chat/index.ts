import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  "lead-gen": `You are a Lead Generation AI agent for a sales team. Your role is to:
- Help identify and qualify potential leads based on the user's Ideal Customer Profile (ICP)
- Suggest companies and contacts that match the ICP
- Research and provide insights about potential leads
- When suggesting leads, always structure them with: company name, contact name, job title, email (if findable), LinkedIn URL, company size, and vertical
- Ask clarifying questions about the ICP if needed
- Remember the user's preferences from previous conversations

When you identify leads, call the suggest_leads tool with structured data.`,

  pipeline: `You are a Pipeline Manager AI agent. Your role is to:
- Analyze the user's current deal pipeline and provide insights
- Identify deals that need attention (stale, at risk, ready to close)
- Suggest next actions for specific deals
- Generate pipeline reports and summaries
- Help prioritize deals based on value, stage, and activity

When you identify actions needed, call the suggest_actions tool with structured data.`,

  crm: `You are a CRM & Outreach AI agent. Your role is to:
- Draft personalized outreach emails for specific deals/contacts
- Create email sequences for nurturing leads
- Suggest follow-up strategies based on deal context
- Help craft compelling subject lines and messaging
- Adapt tone based on the deal stage and relationship

When drafting emails, call the draft_email tool with structured data.`,

  social: `You are a Social Media Content AI agent. Your role is to:
- Help create engaging social media content for LinkedIn and other platforms
- Generate post ideas based on industry trends and company news
- Create multiple variants of content for A/B testing
- Suggest posting strategies and timing
- Help maintain a consistent brand voice

When creating content, call the create_content tool with structured data.`,
};

const TOOLS: Record<string, any[]> = {
  "lead-gen": [
    {
      type: "function",
      function: {
        name: "suggest_leads",
        description: "Suggest potential leads to add to the pipeline",
        parameters: {
          type: "object",
          properties: {
            leads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company: { type: "string" },
                  contact_name: { type: "string" },
                  job_title: { type: "string" },
                  email: { type: "string" },
                  linkedin_url: { type: "string" },
                  company_size: { type: "string" },
                  vertical: { type: "string" },
                  source: { type: "string" },
                },
                required: ["company", "contact_name"],
              },
            },
          },
          required: ["leads"],
        },
      },
    },
  ],
  pipeline: [
    {
      type: "function",
      function: {
        name: "suggest_actions",
        description: "Suggest actions for deals in the pipeline",
        parameters: {
          type: "object",
          properties: {
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  deal_id: { type: "string" },
                  action_type: { type: "string" },
                  summary: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["action_type", "summary", "priority"],
              },
            },
          },
          required: ["actions"],
        },
      },
    },
  ],
  crm: [
    {
      type: "function",
      function: {
        name: "draft_email",
        description: "Draft an outreach email",
        parameters: {
          type: "object",
          properties: {
            recipient_name: { type: "string" },
            recipient_email: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: ["subject", "body"],
        },
      },
    },
  ],
  social: [
    {
      type: "function",
      function: {
        name: "create_content",
        description: "Create social media content",
        parameters: {
          type: "object",
          properties: {
            platform: { type: "string", enum: ["linkedin", "twitter", "instagram"] },
            post_text: { type: "string" },
            variant_group: { type: "string" },
          },
          required: ["platform", "post_text"],
        },
      },
    },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { agentType, messages, context } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get auth token for memory retrieval
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    // Build system prompt with memory context
    let systemPrompt = SYSTEM_PROMPTS[agentType] || "You are a helpful AI assistant.";

    // Add context if provided (e.g., deal data, pipeline stats)
    if (context) {
      systemPrompt += `\n\nCurrent context:\n${JSON.stringify(context, null, 2)}`;
    }

    // Build request body
    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    };

    // Add tools for the agent type
    if (TOOLS[agentType]) {
      body.tools = TOOLS[agentType];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
