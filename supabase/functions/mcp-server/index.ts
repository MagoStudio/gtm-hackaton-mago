import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = new Hono();

// Auth middleware — supports legacy MCP_AUTH_TOKEN AND agent API keys
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const bearerValue = authHeader.replace("Bearer ", "");
  const legacyToken = Deno.env.get("MCP_AUTH_TOKEN");

  // Try legacy shared token first
  if (legacyToken && bearerValue === legacyToken) {
    c.set("actorType" as never, "human" as never);
    c.set("actorLabel" as never, "MCP (legacy)" as never);
    c.set("actorId" as never, "" as never);
    await next();
    return;
  }

  // Try agent API key
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(bearerValue));
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sb = getSupabase();
  const { data: keyData } = await sb
    .from("agent_api_keys")
    .select("id, user_id, agent_name, scopes, is_active")
    .eq("key_hash", keyHash)
    .single();

  if (keyData && keyData.is_active) {
    c.set("actorType" as never, "agent" as never);
    c.set("actorLabel" as never, keyData.agent_name as never);
    c.set("actorId" as never, keyData.id as never);
    // Update last_used_at
    sb.from("agent_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id).then(() => {});
    await next();
    return;
  }

  return c.json({ error: "Unauthorized" }, 401);
});

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

const mcpServer = new McpServer({
  name: "mago-pipeline",
  version: "1.0.0",
});

// Tool 1: Pipeline Summary
mcpServer.tool("get_pipeline_summary", {
  description:
    "Get an overview of the pipeline: deal counts by status, total value, stale deal count, and deals grouped by owner.",
  inputSchema: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    const sb = getSupabase();
    const { data: deals, error } = await sb
      .from("deals")
      .select("id, company, status, deal_value, prospect_owner, last_interaction");

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    const now = new Date();
    const statusCounts: Record<string, number> = {};
    const statusValues: Record<string, number> = {};
    const ownerCounts: Record<string, number> = {};
    let totalValue = 0;
    let staleDealCount = 0;

    for (const d of deals || []) {
      const status = d.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      statusValues[status] = (statusValues[status] || 0) + (d.deal_value || 0);
      totalValue += d.deal_value || 0;

      const owner = d.prospect_owner || "Unassigned";
      ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;

      if (d.last_interaction) {
        const daysSince = Math.floor(
          (now.getTime() - new Date(d.last_interaction).getTime()) / 86400000
        );
        if (daysSince >= 7) staleDealCount++;
      } else {
        staleDealCount++;
      }
    }

    const summary = {
      total_deals: (deals || []).length,
      total_value_eur: totalValue,
      stale_deals_7_plus_days: staleDealCount,
      by_status: Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        value_eur: statusValues[status] || 0,
      })),
      by_owner: Object.entries(ownerCounts).map(([owner, count]) => ({
        owner,
        count,
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  },
});

// Tool 2: Stale Deals
mcpServer.tool("get_stale_deals", {
  description:
    "List deals with no interaction in N days (default 7), sorted by deal value descending. Useful for identifying urgent follow-ups.",
  inputSchema: {
    type: "object",
    properties: {
      days_threshold: {
        type: "number",
        description: "Number of days without interaction to consider stale (default 7)",
      },
    },
  },
  handler: async ({ days_threshold }) => {
    const threshold = days_threshold ?? 7;
    const sb = getSupabase();
    const { data: deals, error } = await sb
      .from("deals")
      .select(
        "id, company, first_name, last_name, status, deal_value, prospect_owner, last_interaction, next_steps"
      );

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    const now = new Date();
    const stale = (deals || [])
      .map((d) => {
        const daysSince = d.last_interaction
          ? Math.floor(
              (now.getTime() - new Date(d.last_interaction).getTime()) / 86400000
            )
          : null;
        return { ...d, days_since_interaction: daysSince };
      })
      .filter(
        (d) =>
          d.days_since_interaction === null || d.days_since_interaction >= threshold
      )
      .sort((a, b) => (b.deal_value || 0) - (a.deal_value || 0));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              threshold_days: threshold,
              count: stale.length,
              deals: stale.map((d) => ({
                company: d.company,
                contact: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
                status: d.status,
                deal_value_eur: d.deal_value,
                owner: d.prospect_owner,
                days_since_interaction: d.days_since_interaction ?? "never",
                next_steps: d.next_steps,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  },
});

// Tool 3: Deal Details
mcpServer.tool("get_deal_details", {
  description:
    "Get full context for a specific deal by company name or deal ID: contacts, notes, and recent interactions.",
  inputSchema: {
    type: "object",
    properties: {
      company_name: {
        type: "string",
        description: "Company name to search for (partial match)",
      },
      deal_id: {
        type: "string",
        description: "Exact deal UUID",
      },
    },
  },
  handler: async ({ company_name, deal_id }) => {
    const sb = getSupabase();
    let deal;

    if (deal_id) {
      const { data } = await sb.from("deals").select("*").eq("id", deal_id).single();
      deal = data;
    } else if (company_name) {
      const { data } = await sb
        .from("deals")
        .select("*")
        .ilike("company", `%${company_name}%`)
        .limit(1)
        .single();
      deal = data;
    } else {
      return {
        content: [
          { type: "text", text: "Please provide either company_name or deal_id." },
        ],
      };
    }

    if (!deal) {
      return { content: [{ type: "text", text: "Deal not found." }] };
    }

    // Fetch contacts, notes, interactions in parallel
    const [contactsRes, notesRes, interactionsRes] = await Promise.all([
      sb.from("deal_contacts").select("*").eq("deal_id", deal.id),
      sb
        .from("deal_notes")
        .select("*")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false })
        .limit(10),
      sb
        .from("deal_interactions")
        .select("*")
        .eq("deal_id", deal.id)
        .order("occurred_at", { ascending: false })
        .limit(20),
    ]);

    const result = {
      deal: {
        id: deal.id,
        company: deal.company,
        contact: `${deal.first_name || ""} ${deal.last_name || ""}`.trim(),
        email: deal.email,
        status: deal.status,
        deal_value_eur: deal.deal_value,
        actual_acv_eur: deal.actual_acv,
        owner: deal.prospect_owner,
        vertical: deal.company_vertical,
        company_size: deal.company_size,
        last_interaction: deal.last_interaction,
        next_steps: deal.next_steps,
        lost_reason: deal.lost_reason,
        strongest_connection: deal.strongest_connection,
        description: deal.description,
      },
      contacts: (contactsRes.data || []).map((c) => ({
        name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        job_title: c.job_title,
        email: c.email,
        is_champion: c.is_champion,
        notes: c.notes,
        linkedin: c.linkedin_url,
      })),
      recent_notes: (notesRes.data || []).map((n) => ({
        type: n.note_type,
        content: n.content,
        author: n.author,
        date: n.created_at,
      })),
      recent_interactions: (interactionsRes.data || []).map((i) => ({
        type: i.interaction_type,
        source: i.source,
        subject: i.subject,
        contact: i.contact_email,
        date: i.occurred_at,
        body_preview: i.body?.substring(0, 200),
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
});

// Tool 4: Suggest Next Actions
mcpServer.tool("suggest_next_actions", {
  description:
    "Get a prioritized list of deals needing follow-up, ranked by urgency (staleness × deal value). Returns reasoning for each.",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Max number of actions to return (default 10)",
      },
    },
  },
  handler: async ({ limit }) => {
    const maxActions = limit ?? 10;
    const sb = getSupabase();
    const { data: deals, error } = await sb
      .from("deals")
      .select(
        "id, company, first_name, last_name, status, deal_value, prospect_owner, last_interaction, next_steps, strongest_connection"
      )
      .not("status", "in", '("Closed Won","Closed Lost","Lost")');

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    const now = new Date();
    const scored = (deals || [])
      .map((d) => {
        const daysSince = d.last_interaction
          ? Math.floor(
              (now.getTime() - new Date(d.last_interaction).getTime()) / 86400000
            )
          : 999;
        const urgencyScore = daysSince * (d.deal_value || 1);

        let reason = "";
        if (daysSince >= 14)
          reason = `Critical: No interaction in ${daysSince} days`;
        else if (daysSince >= 7)
          reason = `Stale: No interaction in ${daysSince} days`;
        else if (daysSince === 999) reason = "No recorded interaction ever";
        else reason = `${daysSince} days since last interaction`;

        if (d.deal_value && d.deal_value >= 50000) reason += ` — high-value deal (€${d.deal_value.toLocaleString()})`;

        return {
          company: d.company,
          contact: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
          status: d.status,
          deal_value_eur: d.deal_value,
          owner: d.prospect_owner,
          days_since_interaction: daysSince === 999 ? "never" : daysSince,
          next_steps: d.next_steps,
          strongest_connection: d.strongest_connection,
          urgency_score: urgencyScore,
          reason,
        };
      })
      .sort((a, b) => b.urgency_score - a.urgency_score)
      .slice(0, maxActions);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { actions: scored.map(({ urgency_score, ...rest }) => rest) },
            null,
            2
          ),
        },
      ],
    };
  },
});

// Tool 5: Search Deals
mcpServer.tool("search_deals", {
  description:
    "Search deals by company name, owner, status, or vertical. Returns matching deals with key fields.",
  inputSchema: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description: "Company name (partial match)",
      },
      owner: {
        type: "string",
        description: "Prospect owner name (partial match)",
      },
      status: {
        type: "string",
        description: "Exact status filter",
      },
      vertical: {
        type: "string",
        description: "Company vertical (partial match)",
      },
    },
  },
  handler: async ({ company, owner, status, vertical }) => {
    const sb = getSupabase();
    let query = sb
      .from("deals")
      .select(
        "id, company, first_name, last_name, status, deal_value, prospect_owner, company_vertical, last_interaction, next_steps"
      );

    if (company) query = query.ilike("company", `%${company}%`);
    if (owner) query = query.ilike("prospect_owner", `%${owner}%`);
    if (status) query = query.eq("status", status);
    if (vertical) query = query.ilike("company_vertical", `%${vertical}%`);

    const { data, error } = await query.limit(50);

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }

    const results = (data || []).map((d) => ({
      id: d.id,
      company: d.company,
      contact: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
      status: d.status,
      deal_value_eur: d.deal_value,
      owner: d.prospect_owner,
      vertical: d.company_vertical,
      last_interaction: d.last_interaction,
      next_steps: d.next_steps,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: results.length, deals: results }, null, 2),
        },
      ],
    };
  },
});

// Shared helper: resolve deal by ID or company name
async function resolveDeal(sb: ReturnType<typeof getSupabase>, { deal_id, company_name }: { deal_id?: string; company_name?: string }) {
  if (deal_id) {
    const { data, error } = await sb.from("deals").select("*").eq("id", deal_id).single();
    if (error) return { deal: null, error: error.message };
    return { deal: data, error: null };
  }
  if (company_name) {
    const { data, error } = await sb.from("deals").select("*").ilike("company", `%${company_name}%`).limit(1).single();
    if (error) return { deal: null, error: error.message };
    return { deal: data, error: null };
  }
  return { deal: null, error: "Please provide either deal_id or company_name." };
}

// Tool 6: Update Deal Status
mcpServer.tool("update_deal_status", {
  description: "Update a deal's status (e.g. move to Negotiation, Closed Won, Closed Lost). Provide deal_id or company_name.",
  inputSchema: {
    type: "object",
    properties: {
      deal_id: { type: "string", description: "Exact deal UUID" },
      company_name: { type: "string", description: "Company name (partial match)" },
      new_status: { type: "string", description: "New status value" },
      lost_reason: { type: "string", description: "Reason if closing as lost" },
    },
    required: ["new_status"],
  },
  handler: async ({ deal_id, company_name, new_status, lost_reason }) => {
    const sb = getSupabase();
    const { deal, error } = await resolveDeal(sb, { deal_id, company_name });
    if (!deal) return { content: [{ type: "text", text: error || "Deal not found." }] };

    const oldStatus = deal.status;
    const updates: Record<string, unknown> = { status: new_status };
    if (lost_reason) updates.lost_reason = lost_reason;

    const { error: updateError } = await sb.from("deals").update(updates).eq("id", deal.id);
    if (updateError) return { content: [{ type: "text", text: `Error: ${updateError.message}` }] };

    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, company: deal.company, old_status: oldStatus, new_status }, null, 2) }],
    };
  },
});

// Tool 7: Add Deal Note
mcpServer.tool("add_deal_note", {
  description: "Add a note to a deal. Provide deal_id or company_name.",
  inputSchema: {
    type: "object",
    properties: {
      deal_id: { type: "string", description: "Exact deal UUID" },
      company_name: { type: "string", description: "Company name (partial match)" },
      content: { type: "string", description: "Note content" },
      author: { type: "string", description: "Author name (optional)" },
    },
    required: ["content"],
  },
  handler: async ({ deal_id, company_name, content, author }) => {
    const sb = getSupabase();
    const { deal, error } = await resolveDeal(sb, { deal_id, company_name });
    if (!deal) return { content: [{ type: "text", text: error || "Deal not found." }] };

    const { error: insertError } = await sb.from("deal_notes").insert({
      deal_id: deal.id,
      content,
      author: author || "MCP",
    });
    if (insertError) return { content: [{ type: "text", text: `Error: ${insertError.message}` }] };

    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, company: deal.company, note_preview: content.substring(0, 100) }, null, 2) }],
    };
  },
});

// Tool 8: Add Interaction
mcpServer.tool("add_interaction", {
  description: "Log an interaction (email, call, meeting) on a deal. Provide deal_id or company_name.",
  inputSchema: {
    type: "object",
    properties: {
      deal_id: { type: "string", description: "Exact deal UUID" },
      company_name: { type: "string", description: "Company name (partial match)" },
      interaction_type: { type: "string", description: "Type: email, call, meeting, or other" },
      subject: { type: "string", description: "Subject line" },
      body: { type: "string", description: "Body / details (optional)" },
      contact_email: { type: "string", description: "Contact email (optional)" },
      occurred_at: { type: "string", description: "ISO date when it happened (default: now)" },
      user_id: { type: "string", description: "User UUID to attribute (optional, fetches first profile if omitted)" },
    },
    required: ["interaction_type", "subject"],
  },
  handler: async ({ deal_id, company_name, interaction_type, subject, body, contact_email, occurred_at, user_id }) => {
    const sb = getSupabase();
    const { deal, error } = await resolveDeal(sb, { deal_id, company_name });
    if (!deal) return { content: [{ type: "text", text: error || "Deal not found." }] };

    let resolvedUserId = user_id;
    if (!resolvedUserId) {
      const { data: profile } = await sb.from("profiles").select("user_id").limit(1).single();
      resolvedUserId = profile?.user_id;
    }
    if (!resolvedUserId) return { content: [{ type: "text", text: "Could not resolve a user_id. Please provide one." }] };

    const { error: insertError } = await sb.from("deal_interactions").insert({
      deal_id: deal.id,
      user_id: resolvedUserId,
      interaction_type,
      subject,
      body: body || null,
      contact_email: contact_email || null,
      occurred_at: occurred_at || new Date().toISOString(),
      source: "mcp",
    });
    if (insertError) return { content: [{ type: "text", text: `Error: ${insertError.message}` }] };

    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, company: deal.company, interaction_type, subject }, null, 2) }],
    };
  },
});

// Tool 9: Get Deal Quotes
mcpServer.tool("get_deal_quotes", {
  description: "Get all quotes attached to a deal. Provide deal_id or company_name.",
  inputSchema: {
    type: "object",
    properties: {
      deal_id: { type: "string", description: "Exact deal UUID" },
      company_name: { type: "string", description: "Company name (partial match)" },
    },
  },
  handler: async ({ deal_id, company_name }) => {
    const sb = getSupabase();
    const { deal, error } = await resolveDeal(sb, { deal_id, company_name });
    if (!deal) return { content: [{ type: "text", text: error || "Deal not found." }] };

    const { data: quotes, error: qError } = await sb
      .from("quotes")
      .select("id, quote_number, quote_name, quote_type, status, total_arr, total_onetime, total_year1, valid_until, line_items, created_at")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false });

    if (qError) return { content: [{ type: "text", text: `Error: ${qError.message}` }] };

    const result = {
      company: deal.company,
      quote_count: (quotes || []).length,
      quotes: (quotes || []).map((q) => ({
        quote_number: q.quote_number,
        name: q.quote_name,
        type: q.quote_type,
        status: q.status,
        total_arr_eur: q.total_arr,
        total_onetime_eur: q.total_onetime,
        total_year1_eur: q.total_year1,
        valid_until: q.valid_until,
        created_at: q.created_at,
        line_items_count: Array.isArray(q.line_items) ? q.line_items.length : 0,
      })),
    };

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
});

// ── Gmail helper: get a valid access token from gmail_tokens table ──
async function getGmailAccessToken(sb: ReturnType<typeof getSupabase>, userEmail?: string) {
  let query = sb.from("gmail_tokens").select("*");
  if (userEmail) {
    query = query.eq("email", userEmail);
  }
  const { data: token, error } = await query.limit(1).single();
  if (error || !token) throw new Error(userEmail ? `No Gmail token found for ${userEmail}` : "No Gmail token found. Connect Gmail first.");

  // Refresh if expired
  if (new Date(token.expires_at) <= new Date()) {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await res.json();
    if (!refreshData.access_token) throw new Error("Failed to refresh Gmail token");

    const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
    await sb.from("gmail_tokens").update({
      access_token: refreshData.access_token,
      expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    }).eq("id", token.id);

    return { accessToken: refreshData.access_token, email: token.email! };
  }

  return { accessToken: token.access_token, email: token.email! };
}

function buildRfc2822(from: string, to: string, subject: string, bodyHtml: string) {
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    bodyHtml,
  ].join("\r\n");

  // base64url encode
  const encoded = btoa(unescape(encodeURIComponent(msg)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return encoded;
}

// Tool 10: Draft Email
mcpServer.tool("draft_email", {
  description: "Create a Gmail draft for a deal contact. The email will appear in the connected Gmail account's Drafts folder for review before sending. Provide deal_id or company_name.",
  inputSchema: {
    type: "object",
    properties: {
      deal_id: { type: "string", description: "Exact deal UUID" },
      company_name: { type: "string", description: "Company name (partial match)" },
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body (HTML supported)" },
      user_email: { type: "string", description: "Gmail account to send from (optional, uses first connected account if omitted)" },
    },
    required: ["to", "subject", "body"],
  },
  handler: async ({ deal_id, company_name, to, subject, body, user_email }) => {
    const sb = getSupabase();

    // Resolve deal (optional — for logging)
    const { deal } = await resolveDeal(sb, { deal_id, company_name });

    const { accessToken, email: fromEmail } = await getGmailAccessToken(sb, user_email);
    const raw = buildRfc2822(fromEmail, to, subject, body);

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw } }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { content: [{ type: "text", text: `Gmail API error: ${err}` }] };
    }

    const draft = await res.json();

    // Log as interaction if deal found
    if (deal) {
      const { data: profile } = await sb.from("profiles").select("user_id").limit(1).single();
      if (profile?.user_id) {
        await sb.from("deal_interactions").insert({
          deal_id: deal.id,
          user_id: profile.user_id,
          interaction_type: "email_drafted",
          subject,
          body: body.substring(0, 500),
          contact_email: to,
          occurred_at: new Date().toISOString(),
          source: "mcp",
        });
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, draft_id: draft.id, from: fromEmail, to, subject, company: deal?.company || "N/A" }, null, 2) }],
    };
  },
});

// Tool 11: Send Email
mcpServer.tool("send_email", {
  description: "Send an email immediately from the connected Gmail account to a deal contact. Provide deal_id or company_name.",
  inputSchema: {
    type: "object",
    properties: {
      deal_id: { type: "string", description: "Exact deal UUID" },
      company_name: { type: "string", description: "Company name (partial match)" },
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body (HTML supported)" },
      user_email: { type: "string", description: "Gmail account to send from (optional, uses first connected account if omitted)" },
    },
    required: ["to", "subject", "body"],
  },
  handler: async ({ deal_id, company_name, to, subject, body, user_email }) => {
    const sb = getSupabase();

    const { deal } = await resolveDeal(sb, { deal_id, company_name });

    const { accessToken, email: fromEmail } = await getGmailAccessToken(sb, user_email);
    const raw = buildRfc2822(fromEmail, to, subject, body);

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { content: [{ type: "text", text: `Gmail API error: ${err}` }] };
    }

    const message = await res.json();

    // Log as interaction if deal found
    if (deal) {
      const { data: profile } = await sb.from("profiles").select("user_id").limit(1).single();
      if (profile?.user_id) {
        await sb.from("deal_interactions").insert({
          deal_id: deal.id,
          user_id: profile.user_id,
          interaction_type: "email_sent",
          subject,
          body: body.substring(0, 500),
          contact_email: to,
          occurred_at: new Date().toISOString(),
          source: "mcp",
        });
      }
    }

    // Update deal's last_interaction
    if (deal) {
      await sb.from("deals").update({ last_interaction: new Date().toISOString() }).eq("id", deal.id);
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, message_id: message.id, from: fromEmail, to, subject, company: deal?.company || "N/A" }, null, 2) }],
    };
  },
});

// MCP transport — bind returns a fetch handler
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);

app.all("/*", async (c) => {
  return await httpHandler(c.req.raw);
});

Deno.serve(app.fetch);
