import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data;
}

async function getMessageDetails(accessToken: string, messageId: string) {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function extractEmail(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : headerValue.toLowerCase().trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth the user
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { dealId } = await req.json();
    if (!dealId) throw new Error("dealId is required");

    const adminClient = createClient(supabaseUrl, serviceRole);

    // Get user's gmail tokens
    const { data: tokenRow, error: tokenErr } = await adminClient
      .from("gmail_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenErr || !tokenRow) throw new Error("Gmail not connected");

    // Refresh token if expired
    let accessToken = tokenRow.access_token;
    if (new Date(tokenRow.expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await adminClient
        .from("gmail_tokens")
        .update({ access_token: accessToken, expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    // Get the deal's contact email
    const { data: deal, error: dealErr } = await adminClient
      .from("deals")
      .select("email, first_name, last_name")
      .eq("id", dealId)
      .single();

    if (dealErr) throw new Error("Deal not found");

    // Also get all deal_contacts emails
    const { data: dealContacts } = await adminClient
      .from("deal_contacts")
      .select("email")
      .eq("deal_id", dealId);

    // Collect all unique emails from deal + deal_contacts
    const allEmails = new Set<string>();
    if (deal?.email) allEmails.add(deal.email.toLowerCase());
    if (dealContacts) {
      for (const c of dealContacts) {
        if (c.email) allEmails.add(c.email.toLowerCase());
      }
    }

    if (allEmails.size === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "No contact emails on deal" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Gmail query for all contact emails
    const emailClauses = [...allEmails].map(e => `from:${e} OR to:${e}`).join(" OR ");
    const query = encodeURIComponent(`{${emailClauses}}`);
    const searchRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      throw new Error(`Gmail search failed: ${JSON.stringify(searchData)}`);
    }

    const messages = searchData.messages || [];
    let synced = 0;

    for (const msg of messages) {
      const externalId = `gmail_${msg.id}`;

      // Check if already synced
      const { data: existing } = await adminClient
        .from("deal_interactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("external_id", externalId)
        .maybeSingle();

      if (existing) continue;

      const details = await getMessageDetails(accessToken, msg.id);
      if (!details) continue;

      const headers = details.payload?.headers || [];
      const subject = getHeader(headers, "Subject");
      const from = getHeader(headers, "From");
      const to = getHeader(headers, "To");
      const dateStr = getHeader(headers, "Date");
      const fromEmail = extractEmail(from);

      // Determine if this is sent or received based on whether from matches any contact
      const isFromContact = allEmails.has(fromEmail);
      const interactionType = isFromContact ? "email_received" : "email_sent";
      
      // Determine the contact email for this interaction
      let contactEmail = fromEmail;
      if (!isFromContact) {
        // It's sent by user — find which contact it was sent to
        const toEmails = to.split(",").map((t: string) => extractEmail(t.trim()));
        contactEmail = toEmails.find((e: string) => allEmails.has(e)) || toEmails[0] || "";
      }

      const occurredAt = dateStr ? new Date(dateStr).toISOString() : new Date(parseInt(details.internalDate)).toISOString();
      const snippet = details.snippet || "";

      await adminClient.from("deal_interactions").insert({
        deal_id: dealId,
        user_id: user.id,
        interaction_type: interactionType,
        subject,
        body: snippet,
        contact_email: contactEmail,
        occurred_at: occurredAt,
        source: "gmail_sync",
        external_id: externalId,
        metadata: { gmail_thread_id: details.threadId, labels: details.labelIds },
      });

      synced++;
    }

    return new Response(JSON.stringify({ synced, total: messages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-gmail error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
