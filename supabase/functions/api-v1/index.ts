import { Hono } from "hono";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Auth middleware: validate agent API key ---
async function authenticateAgent(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const plainKey = authHeader.replace("Bearer ", "");
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(plainKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sb = getServiceSupabase();
  const { data } = await sb
    .from("agent_api_keys")
    .select("id, user_id, agent_name, scopes, is_active")
    .eq("key_hash", keyHash)
    .single();

  if (!data || !data.is_active) return null;

  // Update last_used_at
  sb.from("agent_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});

  return data as {
    id: string;
    user_id: string;
    agent_name: string;
    scopes: string[];
    is_active: boolean;
  };
}

function getServiceSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required);
}

async function logAudit(
  sb: ReturnType<typeof getServiceSupabase>,
  agent: { id: string; agent_name: string },
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
) {
  await sb.from("audit_log").insert({
    actor_type: "agent",
    actor_id: agent.id,
    actor_label: agent.agent_name,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: metadata || {},
  });
}

// --- CORS preflight ---
app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// --- Auth middleware ---
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();

  const agent = await authenticateAgent(c.req.raw);
  if (!agent) {
    return c.json({ error: "Unauthorized — invalid or revoked API key" }, 401);
  }
  c.set("agent" as never, agent as never);
  await next();
});

// Helper to get agent from context
function getAgent(c: { get: (key: string) => unknown }) {
  return c.get("agent") as {
    id: string;
    user_id: string;
    agent_name: string;
    scopes: string[];
  };
}

function jsonRes(c: { json: (data: unknown, status?: number) => Response }, data: unknown, status = 200) {
  return c.json(data, status);
}

// --- GET /deals ---
app.get("/deals", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "read")) return jsonRes(c, { error: "Scope 'read' required" }, 403);

  const sb = getServiceSupabase();
  const url = new URL(c.req.url);
  let query = sb.from("deals").select(
    "id, company, first_name, last_name, status, deal_value, prospect_owner, company_vertical, last_interaction, next_steps, email"
  );
  const company = url.searchParams.get("company");
  const owner = url.searchParams.get("owner");
  const status = url.searchParams.get("status");
  if (company) query = query.ilike("company", `%${company}%`);
  if (owner) query = query.ilike("prospect_owner", `%${owner}%`);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.limit(100);
  if (error) return jsonRes(c, { error: error.message }, 500);

  await logAudit(sb, agent, "deal.list", "deal", undefined, { count: (data || []).length });
  return jsonRes(c, { count: (data || []).length, deals: data });
});

// --- GET /deals/:id ---
app.get("/deals/:id", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "read")) return jsonRes(c, { error: "Scope 'read' required" }, 403);

  const sb = getServiceSupabase();
  const dealId = c.req.param("id");

  const [dealRes, contactsRes, notesRes, interactionsRes] = await Promise.all([
    sb.from("deals").select("*").eq("id", dealId).single(),
    sb.from("deal_contacts").select("*").eq("deal_id", dealId),
    sb.from("deal_notes").select("*").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(10),
    sb.from("deal_interactions").select("*").eq("deal_id", dealId).order("occurred_at", { ascending: false }).limit(20),
  ]);

  if (dealRes.error) return jsonRes(c, { error: "Deal not found" }, 404);

  await logAudit(sb, agent, "deal.view", "deal", dealId, { company: dealRes.data.company });
  return jsonRes(c, { deal: dealRes.data, contacts: contactsRes.data, notes: notesRes.data, interactions: interactionsRes.data });
});

// --- POST /deals/:id/status ---
app.post("/deals/:id/status", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "write")) return jsonRes(c, { error: "Scope 'write' required" }, 403);

  const sb = getServiceSupabase();
  const dealId = c.req.param("id");
  const body = await c.req.json();
  const { new_status, lost_reason } = body;
  if (!new_status) return jsonRes(c, { error: "new_status required" }, 400);

  const updates: Record<string, unknown> = { status: new_status };
  if (lost_reason) updates.lost_reason = lost_reason;

  const { error } = await sb.from("deals").update(updates).eq("id", dealId);
  if (error) return jsonRes(c, { error: error.message }, 500);

  await logAudit(sb, agent, "deal.status_update", "deal", dealId, { new_status, lost_reason });
  return jsonRes(c, { success: true, new_status });
});

// --- POST /deals/:id/notes ---
app.post("/deals/:id/notes", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "write")) return jsonRes(c, { error: "Scope 'write' required" }, 403);

  const sb = getServiceSupabase();
  const dealId = c.req.param("id");
  const body = await c.req.json();
  const { content, author } = body;
  if (!content) return jsonRes(c, { error: "content required" }, 400);

  const { error } = await sb.from("deal_notes").insert({
    deal_id: dealId,
    content,
    author: author || agent.agent_name,
  });
  if (error) return jsonRes(c, { error: error.message }, 500);

  await logAudit(sb, agent, "deal.note_added", "deal", dealId, { preview: content.substring(0, 100) });
  return jsonRes(c, { success: true });
});

// --- POST /deals/:id/interactions ---
app.post("/deals/:id/interactions", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "write")) return jsonRes(c, { error: "Scope 'write' required" }, 403);

  const sb = getServiceSupabase();
  const dealId = c.req.param("id");
  const body = await c.req.json();
  const { interaction_type, subject, body: interactionBody, contact_email } = body;
  if (!interaction_type) return jsonRes(c, { error: "interaction_type required" }, 400);

  const { error } = await sb.from("deal_interactions").insert({
    deal_id: dealId,
    user_id: agent.user_id,
    interaction_type,
    source: "api",
    subject,
    body: interactionBody,
    contact_email,
  });
  if (error) return jsonRes(c, { error: error.message }, 500);

  await logAudit(sb, agent, "deal.interaction_added", "deal", dealId, { interaction_type });
  return jsonRes(c, { success: true });
});

// --- GET /pipeline/summary ---
app.get("/pipeline/summary", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "read")) return jsonRes(c, { error: "Scope 'read' required" }, 403);

  const sb = getServiceSupabase();
  const { data: deals, error } = await sb
    .from("deals")
    .select("id, status, deal_value, prospect_owner, last_interaction");

  if (error) return jsonRes(c, { error: error.message }, 500);

  const now = new Date();
  const statusCounts: Record<string, number> = {};
  const statusValues: Record<string, number> = {};
  let totalValue = 0;
  let staleCount = 0;

  for (const d of deals || []) {
    const s = d.status || "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    statusValues[s] = (statusValues[s] || 0) + (d.deal_value || 0);
    totalValue += d.deal_value || 0;
    const daysSince = d.last_interaction
      ? Math.floor((now.getTime() - new Date(d.last_interaction).getTime()) / 86400000)
      : 999;
    if (daysSince >= 7) staleCount++;
  }

  await logAudit(sb, agent, "pipeline.summary_viewed", "pipeline");
  return jsonRes(c, {
    total_deals: (deals || []).length,
    total_value_eur: totalValue,
    stale_deals_7_plus_days: staleCount,
    by_status: Object.entries(statusCounts).map(([status, count]) => ({ status, count, value_eur: statusValues[status] || 0 })),
  });
});

// --- GET /pipeline/stale ---
app.get("/pipeline/stale", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "read")) return jsonRes(c, { error: "Scope 'read' required" }, 403);

  const sb = getServiceSupabase();
  const url = new URL(c.req.url);
  const threshold = parseInt(url.searchParams.get("days") || "7");

  const { data: deals, error } = await sb
    .from("deals")
    .select("id, company, first_name, last_name, status, deal_value, prospect_owner, last_interaction, next_steps");
  if (error) return jsonRes(c, { error: error.message }, 500);

  const now = new Date();
  const stale = (deals || [])
    .map((d) => {
      const daysSince = d.last_interaction
        ? Math.floor((now.getTime() - new Date(d.last_interaction).getTime()) / 86400000)
        : null;
      return { ...d, days_since_interaction: daysSince };
    })
    .filter((d) => d.days_since_interaction === null || d.days_since_interaction >= threshold)
    .sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0));

  await logAudit(sb, agent, "pipeline.stale_viewed", "pipeline", undefined, { threshold, count: stale.length });
  return jsonRes(c, { threshold_days: threshold, count: stale.length, deals: stale });
});

// --- GET /deals/:id/quotes ---
app.get("/deals/:id/quotes", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "read")) return jsonRes(c, { error: "Scope 'read' required" }, 403);

  const sb = getServiceSupabase();
  const dealId = c.req.param("id");

  const { data, error } = await sb
    .from("quotes")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  if (error) return jsonRes(c, { error: error.message }, 500);

  await logAudit(sb, agent, "deal.quotes_viewed", "deal", dealId);
  return jsonRes(c, { count: (data || []).length, quotes: data });
});

// --- POST /email/draft ---
app.post("/email/draft", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "email")) return jsonRes(c, { error: "Scope 'email' required" }, 403);

  const sb = getServiceSupabase();
  const body = await c.req.json();
  const { deal_id, recipient_email, recipient_name, subject, email_body } = body;
  if (!recipient_email || !subject || !email_body) {
    return jsonRes(c, { error: "recipient_email, subject, and email_body required" }, 400);
  }

  const { data, error } = await sb.from("outreach_emails").insert({
    user_id: agent.user_id,
    deal_id: deal_id || null,
    recipient_email,
    recipient_name: recipient_name || null,
    subject,
    body: email_body,
    status: "draft",
  }).select().single();
  if (error) return jsonRes(c, { error: error.message }, 500);

  await logAudit(sb, agent, "email.drafted", "outreach_email", data.id, { recipient_email, subject });
  return jsonRes(c, { success: true, email_id: data.id });
});

// --- POST /email/send ---
app.post("/email/send", async (c) => {
  const agent = getAgent(c);
  if (!hasScope(agent.scopes, "email")) return jsonRes(c, { error: "Scope 'email' required" }, 403);

  const sb = getServiceSupabase();
  const body = await c.req.json();
  const { deal_id, to, subject, email_body } = body;
  if (!to || !subject || !email_body) {
    return jsonRes(c, { error: "to, subject, and email_body required" }, 400);
  }

  // Get user's Gmail token
  const { data: token } = await sb
    .from("gmail_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", agent.user_id)
    .single();

  if (!token) {
    return jsonRes(c, { error: "No Gmail connected for this user. Connect Gmail in Settings first." }, 400);
  }

  // Refresh if expired
  let accessToken = token.access_token;
  if (new Date(token.expires_at) < new Date()) {
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshRes.json();
    if (!refreshData.access_token) {
      return jsonRes(c, { error: "Failed to refresh Gmail token" }, 500);
    }
    accessToken = refreshData.access_token;
    await sb.from("gmail_tokens").update({
      access_token: accessToken,
      expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
    }).eq("user_id", agent.user_id);
  }

  // Send via Gmail API
  const rawEmail = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${email_body}`;
  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    return jsonRes(c, { error: `Gmail send failed: ${err}` }, 500);
  }

  // Log as interaction if deal_id provided
  if (deal_id) {
    await sb.from("deal_interactions").insert({
      deal_id,
      user_id: agent.user_id,
      interaction_type: "email_sent",
      source: "api",
      subject,
      body: email_body,
      contact_email: to,
    });
  }

  await logAudit(sb, agent, "email.sent", "email", undefined, { to, subject, deal_id });
  return jsonRes(c, { success: true });
});

Deno.serve(app.fetch);
