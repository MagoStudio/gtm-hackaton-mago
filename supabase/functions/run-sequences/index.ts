// Sequencer tick: advance due sequence enrollments one step.
// Auth: a user JWT (processes that user's due enrollments) OR the x-cron-secret
// header matching CRON_SECRET (processes ALL users' due enrollments).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Step {
  channel: string;
  delay_hours?: number;
  subject?: string;
  body?: string;
}

function fill(template: string, deal: Record<string, any>): string {
  return (template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => {
    const v = deal[k];
    return v == null ? "" : String(v);
  });
}

// Personalize an email with Claude from the step template + deal context.
// Falls back to plain placeholder substitution if the AI call fails.
async function personalize(
  apiKey: string | undefined,
  step: Step,
  deal: Record<string, any>,
): Promise<{ subject: string; body: string }> {
  const subjectFallback = fill(step.subject || "Quick note", deal);
  const bodyFallback = fill(step.body || "", deal);
  if (!apiKey) return { subject: subjectFallback, body: bodyFallback };

  const context = `RECIPIENT: ${deal.first_name || ""} ${deal.last_name || ""} — ${deal.job_title || ""} at ${deal.company || ""}
SUMMARY: ${deal.description || deal.summary || "n/a"}

SUBJECT TEMPLATE: ${step.subject || ""}
BODY TEMPLATE / INTENT: ${step.body || ""}

Rewrite this as a concise, personalized cold outreach email (under 130 words, no "I hope this finds you well", technical-peer tone). Fill any {{placeholders}} using the recipient data. Return the final subject and body only.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: context }],
        tools: [{
          name: "emit_email",
          description: "Return the finished email",
          input_schema: {
            type: "object",
            properties: { subject: { type: "string" }, body: { type: "string" } },
            required: ["subject", "body"],
          },
        }],
        tool_choice: { type: "tool", name: "emit_email" },
      }),
    });
    if (!res.ok) return { subject: subjectFallback, body: bodyFallback };
    const data = await res.json();
    const tool = (data.content || []).find((b: any) => b.type === "tool_use");
    if (tool?.input?.subject && tool?.input?.body) return tool.input;
  } catch { /* fall through */ }
  return { subject: subjectFallback, body: bodyFallback };
}

async function getGmailToken(sb: any, userId: string) {
  const { data: token } = await sb.from("gmail_tokens").select("*").eq("user_id", userId).limit(1).maybeSingle();
  if (!token) return null;
  if (new Date(token.expires_at) > new Date()) return { accessToken: token.access_token, email: token.email };
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token.refresh_token, grant_type: "refresh_token" }),
  });
  const r = await res.json();
  if (!r.access_token) return null;
  await sb.from("gmail_tokens").update({ access_token: r.access_token, expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", token.id);
  return { accessToken: r.access_token, email: token.email };
}

async function gmailSend(accessToken: string, from: string, to: string, subject: string, body: string) {
  const mime = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    // Resolve scope: a single user (manual UI trigger) or all (cron).
    let scopeUserId: string | null = null;
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    if (cronSecret && cronSecret === Deno.env.get("CRON_SECRET")) {
      scopeUserId = null; // all users
    } else if (authHeader) {
      const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      scopeUserId = user.id;
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let q = sb.from("sequence_enrollments").select("*").eq("status", "active").lte("next_action_at", new Date().toISOString()).limit(50);
    if (scopeUserId) q = q.eq("user_id", scopeUserId);
    const { data: due } = await q;

    const summary = { processed: 0, sent: 0, drafted: 0, completed: 0, errors: 0 };

    for (const enr of due ?? []) {
      try {
        const [{ data: seq }, { data: deal }] = await Promise.all([
          sb.from("sequences").select("*").eq("id", enr.sequence_id).single(),
          sb.from("deals").select("*").eq("id", enr.deal_id).single(),
        ]);
        const steps: Step[] = (seq?.steps as Step[]) || [];
        const step = steps[enr.current_step];

        // No more steps → complete.
        if (!step) {
          await sb.from("sequence_enrollments").update({ status: "completed", last_step_at: new Date().toISOString() }).eq("id", enr.id);
          summary.completed++; summary.processed++;
          continue;
        }

        if (step.channel !== "email") {
          // Non-email channels aren't wired yet — skip the step to keep moving.
          await advance(sb, enr, steps);
          summary.processed++;
          continue;
        }

        const to = deal?.email;
        if (!to) {
          await sb.from("sequence_enrollments").update({ last_error: "no recipient email on deal", next_action_at: new Date(Date.now() + 6 * 3600_000).toISOString() }).eq("id", enr.id);
          summary.errors++; summary.processed++;
          continue;
        }

        const email = await personalize(ANTHROPIC_API_KEY, step, deal);
        const gmail = await getGmailToken(sb, enr.user_id);

        let status = "draft";
        if (gmail) {
          try {
            await gmailSend(gmail.accessToken, gmail.email, to, email.subject, email.body);
            status = "sent";
            summary.sent++;
          } catch (e) {
            console.error("send failed, saving draft:", e);
            summary.drafted++;
          }
        } else {
          summary.drafted++; // Gmail not connected → draft mode
        }

        await sb.from("outreach_emails").insert({
          user_id: enr.user_id,
          deal_id: enr.deal_id,
          recipient_email: to,
          recipient_name: `${deal.first_name || ""} ${deal.last_name || ""}`.trim() || null,
          subject: email.subject,
          body: email.body,
          status,
          sequence_step: enr.current_step,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        });

        await advance(sb, enr, steps);
        summary.processed++;
      } catch (e) {
        console.error("enrollment error", enr.id, e);
        await sb.from("sequence_enrollments").update({ status: "error", last_error: String(e).slice(0, 300) }).eq("id", enr.id);
        summary.errors++;
      }
    }

    return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("run-sequences error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Move to the next step, or complete if none. Schedule by the NEXT step's delay.
async function advance(sb: any, enr: any, steps: Step[]) {
  const nextIdx = enr.current_step + 1;
  const nextStep = steps[nextIdx];
  if (!nextStep) {
    await sb.from("sequence_enrollments").update({ status: "completed", current_step: nextIdx, last_step_at: new Date().toISOString(), last_error: null }).eq("id", enr.id);
    return;
  }
  const delayMs = (nextStep.delay_hours ?? 24) * 3600_000;
  await sb.from("sequence_enrollments").update({
    current_step: nextIdx,
    last_step_at: new Date().toISOString(),
    next_action_at: new Date(Date.now() + delayMs).toISOString(),
    last_error: null,
  }).eq("id", enr.id);
}
