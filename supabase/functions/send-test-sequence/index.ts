// Send a test of a sequence: personalize each step against sample data and
// email it (prefixed [TEST]) to the given addresses via the user's Gmail.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Step { channel: string; subject?: string; body?: string }

function fill(t: string, s: Record<string, string>): string {
  return (t || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => s[k] ?? "");
}

async function personalize(apiKey: string | undefined, step: Step, sample: Record<string, string>) {
  const subjectFallback = fill(step.subject || "Quick note", sample);
  const bodyFallback = fill(step.body || "", sample);
  if (!apiKey) return { subject: subjectFallback, body: bodyFallback };
  const ctx = `RECIPIENT (sample): ${sample.first_name} ${sample.last_name} — ${sample.job_title} at ${sample.company}
SUBJECT TEMPLATE: ${step.subject || ""}
BODY TEMPLATE / INTENT: ${step.body || ""}
Rewrite as a concise personalized cold email (<130 words, technical-peer tone). Fill any {{placeholders}}. Return subject + body only.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 600,
        messages: [{ role: "user", content: ctx }],
        tools: [{ name: "emit_email", description: "Return the finished email", input_schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"] } }],
        tool_choice: { type: "tool", name: "emit_email" },
      }),
    });
    if (res.ok) {
      const d = await res.json();
      const t = (d.content || []).find((b: any) => b.type === "tool_use");
      if (t?.input?.subject && t?.input?.body) return t.input;
    }
  } catch { /* fall through */ }
  return { subject: subjectFallback, body: bodyFallback };
}

async function getGmailToken(sb: any, userId: string) {
  const { data: token } = await sb.from("gmail_tokens").select("*").eq("user_id", userId).limit(1).maybeSingle();
  if (!token) return null;
  if (new Date(token.expires_at) > new Date()) return { accessToken: token.access_token, email: token.email };
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID"); const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const r = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token.refresh_token, grant_type: "refresh_token" }) })).json();
  if (!r.access_token) return null;
  await sb.from("gmail_tokens").update({ access_token: r.access_token, expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", token.id);
  return { accessToken: r.access_token, email: token.email };
}

async function gmailSend(accessToken: string, from: string, to: string, subject: string, body: string) {
  const mime = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "", body].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user } } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { steps, emails, sample } = await req.json();
    const stepList: Step[] = (steps || []).filter((s: Step) => s.channel === "email");
    const recipients: string[] = (emails || []).map((e: string) => e.trim()).filter(Boolean);
    if (!stepList.length) return new Response(JSON.stringify({ error: "No email steps to test" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!recipients.length) return new Response(JSON.stringify({ error: "Add at least one test email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const gmail = await getGmailToken(sb, user.id);
    if (!gmail) return new Response(JSON.stringify({ error: "Connect Gmail first (Settings → Connect Gmail) to send test emails." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const s = {
      first_name: sample?.first_name || "there",
      last_name: sample?.last_name || "",
      company: sample?.company || "your company",
      job_title: sample?.job_title || "",
    };

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    let sent = 0;
    for (let i = 0; i < stepList.length; i++) {
      const email = await personalize(ANTHROPIC_API_KEY, stepList[i], s);
      for (const to of recipients) {
        try {
          await gmailSend(gmail.accessToken, gmail.email, to, `[TEST] Step ${i + 1}: ${email.subject}`, email.body);
          sent++;
        } catch (e) { console.error("test send failed", to, e); }
      }
    }
    return new Response(JSON.stringify({ sent, steps: stepList.length, recipients: recipients.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-test-sequence error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
