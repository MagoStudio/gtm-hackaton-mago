import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Built-in tools the bot always has access to
const BUILTIN_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_deal_details",
      description: "Get full details for a specific deal including all notes, contacts, and interactions. ALWAYS call this when asked about a specific deal.",
      parameters: {
        type: "object",
        properties: { deal_id: { type: "string", description: "UUID of the deal" } },
        required: ["deal_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_deals",
      description: "Search deals by company name, contact name, or status. Use when the user mentions a company or person and you need to find the deal ID.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (company name, person name, etc.)" },
          status: { type: "string", description: "Optional status filter" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_pipeline",
      description: "Get pipeline statistics: total deals, deals by status, total value, deals at risk (no interaction in 14+ days).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description: "Add a note to a deal",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string" },
          content: { type: "string" },
          note_type: { type: "string", enum: ["note", "action", "insight"], description: "Type of note" },
        },
        required: ["deal_id", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_deal",
      description: "Update fields on a deal (status, next_steps, prospect_owner, deal_value, etc.)",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string" },
          updates: {
            type: "object",
            description: "Key-value pairs of fields to update. Allowed fields: status, next_steps, prospect_owner, deal_value, description, lost_reason",
          },
        },
        required: ["deal_id", "updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_email",
      description: "Draft an outreach email for a deal contact",
      parameters: {
        type: "object",
        properties: {
          deal_id: { type: "string" },
          recipient_name: { type: "string" },
          recipient_email: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["subject", "body"],
      },
    },
  },
];

const ALLOWED_UPDATE_FIELDS = new Set([
  "status", "next_steps", "prospect_owner", "deal_value",
  "description", "lost_reason",
]);

// Execute a tool call against the database
async function executeTool(
  supabase: any,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  switch (toolName) {
    case "get_deal_details": {
      const { deal_id } = args;
      const [dealRes, notesRes, contactsRes, interactionsRes] = await Promise.all([
        supabase.from("deals").select("*").eq("id", deal_id).single(),
        supabase.from("deal_notes").select("*").eq("deal_id", deal_id).order("created_at"),
        supabase.from("deal_contacts").select("*").eq("deal_id", deal_id),
        supabase.from("deal_interactions").select("*").eq("deal_id", deal_id).order("occurred_at", { ascending: false }),
      ]);
      if (dealRes.error) return JSON.stringify({ error: dealRes.error.message });
      return JSON.stringify({
        deal: dealRes.data,
        notes: notesRes.data || [],
        contacts: contactsRes.data || [],
        interactions: interactionsRes.data || [],
      });
    }

    case "search_deals": {
      const { query, status } = args;
      let q = supabase
        .from("deals")
        .select("id, company, first_name, last_name, status, deal_value, prospect_owner, next_steps, upload_id")
        .or(`company.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
      if (status) q = q.eq("status", status);
      const { data, error } = await q.limit(10);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ results: data || [] });
    }

    case "query_pipeline": {
      // Get all deals for this user
      const { data: deals, error } = await supabase
        .from("deals")
        .select("id, status, deal_value, last_interaction, company, first_name, last_name, upload_id");
      if (error) return JSON.stringify({ error: error.message });

      const allDeals = deals || [];
      const byStatus: Record<string, number> = {};
      let totalValue = 0;
      const atRisk: any[] = [];
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      for (const d of allDeals) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
        totalValue += Number(d.deal_value) || 0;
        if (d.last_interaction && new Date(d.last_interaction) < fourteenDaysAgo) {
          atRisk.push({ id: d.id, company: d.company, name: `${d.first_name || ""} ${d.last_name || ""}`.trim(), days_silent: Math.floor((now.getTime() - new Date(d.last_interaction).getTime()) / (1000 * 60 * 60 * 24)) });
        }
      }

      return JSON.stringify({ total_deals: allDeals.length, by_status: byStatus, total_value: totalValue, at_risk: atRisk });
    }

    case "add_note": {
      const { deal_id, content, note_type } = args;
      const { error } = await supabase.from("deal_notes").insert({
        deal_id,
        content,
        note_type: note_type || "note",
        author: "ClawBot",
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: "Note added" });
    }

    case "update_deal": {
      const { deal_id, updates } = args;
      const safeUpdates: Record<string, any> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (ALLOWED_UPDATE_FIELDS.has(k)) safeUpdates[k] = v;
      }
      if (Object.keys(safeUpdates).length === 0) {
        return JSON.stringify({ error: "No valid fields to update" });
      }
      const { error } = await supabase.from("deals").update(safeUpdates).eq("id", deal_id);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, updated_fields: Object.keys(safeUpdates) });
    }

    case "draft_email": {
      const { deal_id, recipient_name, recipient_email, subject, body } = args;
      const { error } = await supabase.from("outreach_emails").insert({
        user_id: userId,
        deal_id: deal_id || null,
        recipient_name: recipient_name || null,
        recipient_email: recipient_email || null,
        subject,
        body,
        status: "draft",
      });
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true, message: "Email draft saved" });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, botConfigId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Invalid token");
    const userId = user.id;

    // Load bot config (use provided ID or find user's default)
    let botConfig: any = null;
    if (botConfigId) {
      const { data } = await supabase
        .from("bot_configs")
        .select("*")
        .eq("id", botConfigId)
        .eq("user_id", userId)
        .single();
      botConfig = data;
    } else {
      const { data } = await supabase
        .from("bot_configs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
        .limit(1)
        .single();
      botConfig = data;
    }

    // Load enabled skills for this bot
    let skills: any[] = [];
    if (botConfig) {
      const { data } = await supabase
        .from("bot_skills")
        .select("*")
        .eq("bot_id", botConfig.id)
        .eq("enabled", true);
      skills = data || [];
    }

    // Load compact pipeline summary
    const { data: deals } = await supabase
      .from("deals")
      .select("id, company, status, deal_value, prospect_owner, next_steps, nb_interactions, last_interaction, first_name, last_name, email, job_title");

    const pipelineSummary = (deals || []).map((d: any) =>
      `• ${d.company || "Unknown"} (${d.first_name || ""} ${d.last_name || ""}) — ${d.status} — $${d.deal_value || 0} — Owner: ${d.prospect_owner || "unassigned"} — Next: ${d.next_steps || "none"} — ID: ${d.id}`
    ).join("\n");

    // Load user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    // Build system prompt
    const identity = botConfig?.identity || { emoji: "🤖", vibe: "professional" };
    const botName = botConfig?.name || "ClawBot";

    let systemPrompt = `You are ${botName} ${identity.emoji || "🤖"}, a sales AI assistant.

## Soul
${botConfig?.soul || "You are a direct, helpful sales AI. You speak concisely and always back up insights with data from the pipeline. You proactively identify risks and opportunities."}

## Identity
Name: ${botName}
Vibe: ${identity.vibe || "professional"}

## Instructions
${botConfig?.instructions || "Help the user manage their sales pipeline. When asked about any specific deal, ALWAYS call get_deal_details first to get the full picture. When asked about pipeline health or stats, call query_pipeline. When the user mentions a company or person by name but you don't have the deal ID, call search_deals first."}

## User Profile
Name: ${profile?.display_name || "User"}
${botConfig?.user_profile || ""}

## Tool Usage Notes
${botConfig?.tools_notes || "Always prefer fetching real data over making assumptions. If you're unsure which deal the user means, search first."}
`;

    // Inject skills into system prompt
    if (skills.length > 0) {
      systemPrompt += "\n## Skills\n";
      for (const skill of skills) {
        systemPrompt += `\n### ${skill.name}\n${skill.description}\n${skill.instructions}\n`;
      }
    }

    // Inject pipeline context
    systemPrompt += `\n## Current Pipeline (${(deals || []).length} deals)\n${pipelineSummary || "No deals in pipeline yet."}\n`;

    // Merge built-in tools with skill-defined tools
    const allTools = [...BUILTIN_TOOLS];
    for (const skill of skills) {
      if (Array.isArray(skill.tool_definitions)) {
        for (const td of skill.tool_definitions) {
          if (td.type === "function" && td.function) {
            allTools.push(td);
          }
        }
      }
    }

    // Model preference
    const model = botConfig?.model_preference || "google/gemini-2.5-flash";

    // Tool execution loop
    let conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const MAX_TOOL_ROUNDS = 5;
    let round = 0;

    while (round < MAX_TOOL_ROUNDS) {
      round++;

      // Non-streaming call for tool rounds
      const aiResp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: conversationMessages,
          tools: allTools,
          stream: false,
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await aiResp.text();
        console.error("AI error:", status, t);
        return new Response(JSON.stringify({ error: "AI error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await aiResp.json();
      const choice = result.choices?.[0];

      if (!choice) {
        return new Response(JSON.stringify({ error: "No response from AI" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If no tool calls, this is the final response — stream it
      if (choice.finish_reason !== "tool_calls" || !choice.message?.tool_calls?.length) {
        // Final answer — do a streaming call without tools to get the streamed response
        // Use the accumulated conversation including tool results
        const finalMessages = [...conversationMessages];
        if (choice.message?.content) {
          // The model already gave us a final answer in non-streaming mode
          // Convert it to SSE format
          const content = choice.message.content;
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              // Send content as a single SSE chunk
              const chunk = JSON.stringify({
                choices: [{ delta: { content }, finish_reason: null }],
              });
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });

          return new Response(stream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }

        // Fallback: do a streaming call for the final response
        const streamResp = await fetch(AI_GATEWAY, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: finalMessages,
            stream: true,
          }),
        });

        return new Response(streamResp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // Execute tool calls
      const assistantMsg = choice.message;
      conversationMessages.push(assistantMsg);

      for (const tc of assistantMsg.tool_calls) {
        let toolArgs: Record<string, any> = {};
        try {
          toolArgs = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;
        } catch {
          toolArgs = {};
        }

        console.log(`Tool call: ${tc.function.name}`, toolArgs);
        const toolResult = await executeTool(supabase, userId, tc.function.name, toolArgs);

        conversationMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult,
        });
      }
    }

    // If we exhausted tool rounds, do a final streaming call
    const finalResp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [...conversationMessages, { role: "user", content: "Please provide your final answer based on the tool results above." }],
        stream: true,
      }),
    });

    return new Response(finalResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("openclaw-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
