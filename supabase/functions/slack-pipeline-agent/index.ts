import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanSlackText, parseSendDraftRequest } from "../_shared/slack-agent-utils.ts";

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 4;
const SLACK_CONTEXT_AGENT_TYPE = "slack-pipeline-agent";

const tools = [
  {
    name: "get_pipeline_summary",
    description: "Get high-level pipeline health: total deals, total value, stale deals, and counts by status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_stale_deals",
    description: "List deals with no interaction for N days, sorted by deal value. Use for 'what needs action' questions.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days without interaction. Default 7." },
      },
    },
  },
  {
    name: "search_deals",
    description: "Search deals by company, owner, or status before fetching details.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string" },
        owner: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "get_deal_details",
    description: "Get a deal with contacts, notes, and interactions. Use this before summarizing a specific company.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Exact deal UUID." },
        company: { type: "string", description: "Company name if the ID is not known." },
      },
    },
  },
  {
    name: "add_deal_note",
    description: "Add a note to a deal only when the Slack user explicitly asks for it. Requires confirmed=true.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        content: { type: "string" },
        confirmed: { type: "boolean", description: "True only if the user explicitly asked to add/save the note." },
      },
      required: ["deal_id", "content", "confirmed"],
    },
  },
  {
    name: "update_deal_status",
    description: "Update deal status only when the Slack user explicitly asks for it. Requires confirmed=true.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        new_status: { type: "string" },
        lost_reason: { type: "string" },
        confirmed: { type: "boolean", description: "True only if the user explicitly asked to update/move the deal." },
      },
      required: ["deal_id", "new_status", "confirmed"],
    },
  },
  {
    name: "log_interaction",
    description: "Log a call, email, meeting, or other interaction only when the Slack user explicitly asks for it. Requires confirmed=true.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        interaction_type: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        contact_email: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["deal_id", "interaction_type", "confirmed"],
    },
  },
  {
    name: "draft_email",
    description: "Create and save an email draft in the user's connected Gmail account. This tool is available in Slack. Use it when the user asks to draft, prepare, or save an email. Requires confirmed=true.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Optional deal UUID to attach the draft to." },
        recipient_email: { type: "string" },
        recipient_name: { type: "string" },
        subject: { type: "string" },
        email_body: { type: "string" },
        confirmed: { type: "boolean", description: "True only if the user explicitly asked to create/save a draft." },
      },
      required: ["recipient_email", "subject", "email_body", "confirmed"],
    },
  },
  {
    name: "send_email",
    description: "Send an email through the connected Gmail account. This tool is available in Slack, but it requires Gmail to be connected for the agent user. Use only when the Slack user explicitly asks to send now. Requires confirmed=true.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "Optional deal UUID to attach the sent email interaction to." },
        to: { type: "string", description: "Recipient email address." },
        subject: { type: "string" },
        email_body: { type: "string" },
        confirmed: { type: "boolean", description: "True only if the user explicitly asked to send the email." },
      },
      required: ["to", "subject", "email_body", "confirmed"],
    },
  },
  {
    name: "send_gmail_draft",
    description: "Send an existing Gmail draft by draft_id or by matching the latest draft for a recipient. Use when the user says to send the draft / queued draft / email in draft. Requires confirmed=true.",
    input_schema: {
      type: "object",
      properties: {
        draft_id: { type: "string", description: "Optional Gmail draft ID if known." },
        to: { type: "string", description: "Recipient email address to match the latest Gmail draft." },
        recipient_query: { type: "string", description: "Recipient name or partial email, for example Malin." },
        deal_id: { type: "string", description: "Optional deal UUID to log the sent interaction." },
        confirmed: { type: "boolean", description: "True only if the user explicitly asked to send the existing draft." },
      },
      required: ["confirmed"],
    },
  },
];

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (payload.type === "url_verification") {
    return new Response(payload.challenge, { headers: { "Content-Type": "text/plain" } });
  }

  const signatureOk = await verifySlackRequest(req, rawBody);
  if (!signatureOk) return json({ error: "Invalid Slack signature" }, 401);

  if (payload.type !== "event_callback") return json({ ok: true });

  const event = payload.event;
  if (!event || event.bot_id || event.subtype === "bot_message") return json({ ok: true });

  const isMention = event.type === "app_mention";
  const isDirectMessage = event.type === "message" && event.channel_type === "im";
  if (!isMention && !isDirectMessage) return json({ ok: true });

  const promise = handleSlackEvent(event).catch((error) => {
    console.error("slack-pipeline-agent background error:", error);
  });

  const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil(promise);
  } else {
    await promise;
  }

  return json({ ok: true });
});

async function handleSlackEvent(event: any) {
  const channel = event.channel;
  const threadTs = event.thread_ts || event.ts;
  const threadKey = `${channel}:${threadTs}`;
  const text = cleanSlackText(event.text || "");

  if (!text.trim()) {
    await postSlackMessage(channel, "Ask me about the pipeline, for example: `what deals need action today?`", threadTs);
    return;
  }

  await postSlackMessage(channel, "Checking the pipeline...", threadTs);

  const threadContext = await loadThreadContext(threadKey);
  const draftSendRequest = parseSendDraftRequest(text);
  if (draftSendRequest) {
    const latestDraft = threadContext?.latestDraft || {};
    const result = await executePipelineTool("send_gmail_draft", {
      draft_id: latestDraft.draft_id,
      deal_id: latestDraft.deal_id,
      to: latestDraft.to,
      recipient_query: latestDraft.recipient_query,
      ...draftSendRequest,
      confirmed: true,
    });
    if (result?.success) {
      await postSlackMessage(
        channel,
        `Sent the Gmail draft${result.to ? ` to ${result.to}` : ""}${result.subject ? ` with subject "${result.subject}"` : ""}.`,
        threadTs,
      );
    } else {
      await postSlackMessage(channel, `Could not send the Gmail draft: ${result?.error || "unknown error"}`, threadTs);
    }
    return;
  }

  const answer = await runClaudePipelineAgent(text, threadKey, threadContext);
  await postSlackMessage(channel, answer, threadTs);
}

async function runClaudePipelineAgent(userText: string, threadKey: string, threadContext: Record<string, any> | null) {
  const contextPrefix = threadContext?.latestDraft
    ? `Thread context: latest Gmail draft id=${threadContext.latestDraft.draft_id || "unknown"}, to=${threadContext.latestDraft.to || "unknown"}, subject=${threadContext.latestDraft.subject || "unknown"}, deal_id=${threadContext.latestDraft.deal_id || "unknown"}.\n\n`
    : "";
  const messages: ClaudeMessage[] = [{ role: "user", content: `${contextPrefix}${userText}` }];
  const system = [
    "You are Mago, a concise GTM pipeline copilot inside Slack.",
    "Use tools to answer questions about real pipeline state. Do not invent deal facts.",
    "For 'what needs action', call get_stale_deals and summarize the top priorities with next steps.",
    "For a named company, search first if you do not have an exact deal_id, then get deal details.",
    "For writes such as status updates, notes, or interactions, only call the write tool when the user explicitly asked you to perform that write.",
    "You have email tools in Slack: draft_email and send_email.",
    "When the user asks you to draft, prepare, write, or save an email, call draft_email. The draft_email tool creates a real Gmail draft in the connected Gmail account.",
    "When the user clearly says to send now, call send_email. If Gmail is not connected, the tool will return that error; do not claim you lack the tool.",
    "When the user says to send an existing draft, send the draft, or send the email in draft, call send_gmail_draft. Do not ask for subject/body for an existing draft. Use to if an email is known; otherwise use recipient_query with the name the user provided.",
    "If an email recipient is missing, get deal details first and use the best matching contact email. If no email exists, ask for the recipient email.",
    "Never say you do not have draft/send tools. If a tool call fails, report the exact tool error and suggest the next setup step.",
    "Keep Slack replies short, scannable, and action-oriented. Use bullets. Include company names and owners when available.",
  ].join("\n");

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": requiredEnv("ANTHROPIC_API_KEY"),
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL,
        max_tokens: 1400,
        system,
        messages,
        tools,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Anthropic error:", response.status, body);
      return `Claude API error (${response.status}). Check ANTHROPIC_API_KEY and ANTHROPIC_MODEL.`;
    }

    const result = await response.json();
    const content = result.content || [];
    const toolUses = content.filter((part: any) => part.type === "tool_use");

    if (toolUses.length === 0) {
      return slackLimit(content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n").trim() || "No answer returned.");
    }

    messages.push({ role: "assistant", content });
    const toolResults = [];
    for (const toolUse of toolUses) {
      console.log("Slack pipeline tool call:", toolUse.name, toolUse.input || {});
      const toolResult = await executePipelineTool(toolUse.name, toolUse.input || {});
      console.log("Slack pipeline tool result:", toolUse.name, toolResult);
      if (toolUse.name === "draft_email" && toolResult?.success) {
        await saveLatestDraftContext(threadKey, {
          draft_id: toolResult.draft_id,
          to: toolUse.input?.recipient_email,
          recipient_query: toolUse.input?.recipient_name || toolUse.input?.recipient_email,
          subject: toolUse.input?.subject,
          deal_id: toolUse.input?.deal_id,
          created_at: new Date().toISOString(),
        });
      }
      if (toolUse.name === "send_gmail_draft" && toolResult?.success) {
        await clearLatestDraftContext(threadKey);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "I hit the tool-call limit before finishing. Try asking for one deal or one pipeline report at a time.";
}

async function executePipelineTool(name: string, input: Record<string, any>) {
  switch (name) {
    case "get_pipeline_summary":
      return await apiGet("/pipeline/summary");
    case "get_stale_deals":
      return await apiGet(`/pipeline/stale?days=${encodeURIComponent(String(input.days || 7))}`);
    case "search_deals": {
      const params = new URLSearchParams();
      if (input.company) params.set("company", input.company);
      if (input.owner) params.set("owner", input.owner);
      if (input.status) params.set("status", input.status);
      return await apiGet(`/deals?${params.toString()}`);
    }
    case "get_deal_details": {
      const dealId = input.deal_id || await resolveDealId(input.company);
      if (!dealId) return { error: "Deal not found", company: input.company };
      return await apiGet(`/deals/${encodeURIComponent(dealId)}`);
    }
    case "add_deal_note":
      if (!input.confirmed) return { error: "Not confirmed. Ask the user to confirm adding this note." };
      return await apiPost(`/deals/${encodeURIComponent(input.deal_id)}/notes`, {
        content: input.content,
        author: "Mago Slack Bot",
      });
    case "update_deal_status":
      if (!input.confirmed) return { error: "Not confirmed. Ask the user to confirm updating the status." };
      return await apiPost(`/deals/${encodeURIComponent(input.deal_id)}/status`, {
        new_status: input.new_status,
        lost_reason: input.lost_reason,
      });
    case "log_interaction":
      if (!input.confirmed) return { error: "Not confirmed. Ask the user to confirm logging this interaction." };
      return await apiPost(`/deals/${encodeURIComponent(input.deal_id)}/interactions`, {
        interaction_type: input.interaction_type,
        subject: input.subject,
        body: input.body,
        contact_email: input.contact_email,
      });
    case "draft_email":
      if (!input.confirmed) return { error: "Not confirmed. Ask the user to confirm creating this Gmail draft." };
      return await apiPost("/email/gmail-draft", {
        deal_id: input.deal_id,
        to: input.recipient_email,
        subject: input.subject,
        email_body: input.email_body,
      });
    case "send_email":
      if (!input.confirmed) return { error: "Not confirmed. Ask the user to confirm sending this email." };
      return await apiPost("/email/send", {
        deal_id: input.deal_id,
        to: input.to,
        subject: input.subject,
        email_body: input.email_body,
      });
    case "send_gmail_draft":
      if (!input.confirmed) return { error: "Not confirmed. Ask the user to confirm sending this Gmail draft." };
      return await apiPost("/email/send-draft", {
        deal_id: input.deal_id,
        draft_id: input.draft_id,
        to: input.to,
        recipient_query: input.recipient_query,
      });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function resolveDealId(company?: string) {
  if (!company) return null;
  const result = await apiGet(`/deals?company=${encodeURIComponent(company)}`);
  return result?.deals?.[0]?.id || null;
}

function getSupabase() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

async function getSlackAgentUserId() {
  const keyHash = await sha256Hex(requiredEnv("SLACK_AGENT_API_KEY"));
  const { data, error } = await getSupabase()
    .from("agent_api_keys")
    .select("user_id")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();
  if (error || !data?.user_id) {
    console.error("Failed to resolve Slack agent user:", error);
    return null;
  }
  return data.user_id as string;
}

async function loadThreadContext(threadKey: string) {
  const userId = await getSlackAgentUserId();
  if (!userId) return null;
  const { data, error } = await getSupabase()
    .from("agent_settings")
    .select("settings")
    .eq("user_id", userId)
    .eq("agent_type", SLACK_CONTEXT_AGENT_TYPE)
    .maybeSingle();
  if (error) {
    console.error("Failed to load Slack context:", error);
    return null;
  }
  return (data?.settings as any)?.threads?.[threadKey] || null;
}

async function saveLatestDraftContext(threadKey: string, draft: Record<string, unknown>) {
  const userId = await getSlackAgentUserId();
  if (!userId) return;
  const sb = getSupabase();
  const { data } = await sb
    .from("agent_settings")
    .select("settings")
    .eq("user_id", userId)
    .eq("agent_type", SLACK_CONTEXT_AGENT_TYPE)
    .maybeSingle();
  const settings = (data?.settings as any) || {};
  const threads = { ...(settings.threads || {}) };
  threads[threadKey] = { ...(threads[threadKey] || {}), latestDraft: draft, updated_at: new Date().toISOString() };
  await sb.from("agent_settings").upsert({
    user_id: userId,
    agent_type: SLACK_CONTEXT_AGENT_TYPE,
    settings: { ...settings, threads },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,agent_type" });
}

async function clearLatestDraftContext(threadKey: string) {
  const userId = await getSlackAgentUserId();
  if (!userId) return;
  const sb = getSupabase();
  const { data } = await sb
    .from("agent_settings")
    .select("settings")
    .eq("user_id", userId)
    .eq("agent_type", SLACK_CONTEXT_AGENT_TYPE)
    .maybeSingle();
  const settings = (data?.settings as any) || {};
  const threads = { ...(settings.threads || {}) };
  if (threads[threadKey]) {
    delete threads[threadKey].latestDraft;
    threads[threadKey].updated_at = new Date().toISOString();
  }
  await sb.from("agent_settings").upsert({
    user_id: userId,
    agent_type: SLACK_CONTEXT_AGENT_TYPE,
    settings: { ...settings, threads },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,agent_type" });
}

async function sha256Hex(value: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function apiGet(path: string) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${requiredEnv("SLACK_AGENT_API_KEY")}` },
  });
  return await parseApiResponse(response);
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("SLACK_AGENT_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return await parseApiResponse(response);
}

async function parseApiResponse(response: Response) {
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep plain text.
  }
  if (!response.ok) return { error: `API error ${response.status}`, detail: body };
  return body;
}

function apiBaseUrl() {
  const explicit = Deno.env.get("PIPELINE_API_BASE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  return `${requiredEnv("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/api-v1`;
}

async function postSlackMessage(channel: string, text: string, threadTs?: string) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("SLACK_BOT_TOKEN")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text: slackLimit(text),
      thread_ts: threadTs,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) console.error("Slack postMessage error:", response.status, body);
}

async function verifySlackRequest(req: Request, rawBody: string) {
  const secret = Deno.env.get("SLACK_SIGNING_SECRET");
  if (!secret) throw new Error("SLACK_SIGNING_SECRET is not configured");

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  const expected = `v0=${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function slackLimit(text: string) {
  return text.length > 3500 ? `${text.slice(0, 3450)}\n\n...truncated` : text;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
