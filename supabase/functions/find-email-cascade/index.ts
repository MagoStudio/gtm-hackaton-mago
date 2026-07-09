// Email enrichment cascade. Tries providers in order, stops at first verified hit.
// Currently wired: Apollo.io (people/match). Hunter/Findymail are stubbed and skip when no key.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrichResult {
  email: string | null;
  source: string | null;
  confidence: number | null;
  tried: { provider: string; ok: boolean; reason?: string }[];
}

function domainFromCompany(company: string | null, linkedin?: string | null): string | null {
  if (!company) return null;
  // crude fallback: strip common suffixes, lowercase, add .com
  const cleaned = company
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|gmbh|corp|co|studios?|production|productions|media|entertainment|pictures|films?)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
  return cleaned ? `${cleaned}.com` : null;
}

async function tryApollo(c: {
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  linkedin_url?: string | null;
  domain?: string | null;
}): Promise<{ email: string | null; confidence: number | null; reason?: string }> {
  const key = Deno.env.get("APOLLO_API_KEY");
  if (!key) return { email: null, confidence: null, reason: "no_key" };

  const body: Record<string, unknown> = {
    reveal_personal_emails: true,
  };
  if (c.first_name) body.first_name = c.first_name;
  if (c.last_name) body.last_name = c.last_name;
  if (c.company) body.organization_name = c.company;
  if (c.domain) body.domain = c.domain;
  if (c.linkedin_url) body.linkedin_url = c.linkedin_url;

  const res = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { email: null, confidence: null, reason: `http_${res.status}: ${txt.slice(0, 120)}` };
  }
  const json = await res.json();
  const person = json.person;
  const email: string | null = person?.email ?? null;
  if (!email || email === "email_not_unlocked@domain.com") {
    return { email: null, confidence: null, reason: "no_email_in_response" };
  }
  // Apollo gives email_status: verified|guessed|...
  const status = person?.email_status as string | undefined;
  const confidence = status === "verified" ? 0.95 : status === "likely" ? 0.7 : 0.5;
  return { email, confidence };
}

async function tryHunter(c: {
  first_name?: string | null;
  last_name?: string | null;
  domain?: string | null;
}): Promise<{ email: string | null; confidence: number | null; reason?: string }> {
  const key = Deno.env.get("HUNTER_API_KEY");
  if (!key) return { email: null, confidence: null, reason: "no_key" };
  if (!c.domain || !c.first_name || !c.last_name) {
    return { email: null, confidence: null, reason: "missing_inputs" };
  }
  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(c.domain)}&first_name=${encodeURIComponent(c.first_name)}&last_name=${encodeURIComponent(c.last_name)}&api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return { email: null, confidence: null, reason: `http_${res.status}` };
  const json = await res.json();
  const email = json?.data?.email ?? null;
  const score = json?.data?.score ?? null;
  if (!email) return { email: null, confidence: null, reason: "no_email" };
  return { email, confidence: score ? score / 100 : 0.5 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contactId, contactIds, dealId, dealIds } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dealIdList: string[] = Array.isArray(dealIds)
      ? dealIds
      : dealId
      ? [dealId]
      : [];

    // Resolve contact list
    let ids: string[] = [];
    if (contactId) ids = [contactId];
    else if (Array.isArray(contactIds)) ids = contactIds;
    else if (dealIdList.length > 0) {
      const { data } = await supabase
        .from("deal_contacts")
        .select("id")
        .in("deal_id", dealIdList)
        .is("email", null);
      ids = (data ?? []).map((r: { id: string }) => r.id);
    }

    // Also enrich the lead on the deal itself (deals.email) when dealIds provided
    const leadResults: Array<{ dealId: string; result: EnrichResult }> = [];
    if (dealIdList.length > 0) {
      const { data: leadRows } = await supabase
        .from("deals")
        .select("id, first_name, last_name, company, linkedin_url, email")
        .in("id", dealIdList)
        .is("email", null);
      for (const d of leadRows ?? []) {
        const domain = domainFromCompany(d.company, d.linkedin_url);
        const tried: EnrichResult["tried"] = [];
        let final: EnrichResult = { email: null, source: null, confidence: null, tried };
        const providers = [
          { name: "apollo", fn: () => tryApollo({ first_name: d.first_name, last_name: d.last_name, company: d.company, linkedin_url: d.linkedin_url, domain }) },
          { name: "hunter", fn: () => tryHunter({ first_name: d.first_name, last_name: d.last_name, domain }) },
        ];
        for (const p of providers) {
          try {
            const r = await p.fn();
            tried.push({ provider: p.name, ok: !!r.email, reason: r.reason });
            if (r.email) { final = { email: r.email, source: p.name, confidence: r.confidence, tried }; break; }
          } catch (e) {
            tried.push({ provider: p.name, ok: false, reason: String(e).slice(0, 100) });
          }
        }
        if (final.email) {
          await supabase.from("deals").update({ email: final.email }).eq("id", d.id);
        }
        leadResults.push({ dealId: d.id, result: final });
      }
    }

    if (ids.length === 0 && leadResults.length === 0) {
      return new Response(JSON.stringify({ results: [], leads: [], message: "no contacts to enrich" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ contactId: string; result: EnrichResult }> = [];

    if (ids.length > 0) {
      const { data: contacts, error } = await supabase
        .from("deal_contacts")
        .select("id, first_name, last_name, company, linkedin_url, email")
        .in("id", ids);
      if (error) throw error;

      for (const c of contacts ?? []) {
        if (c.email) {
          results.push({
            contactId: c.id,
            result: { email: c.email, source: "existing", confidence: 1, tried: [] },
          });
          continue;
        }

        const domain = domainFromCompany(c.company, c.linkedin_url);
        const tried: EnrichResult["tried"] = [];
        let final: EnrichResult = { email: null, source: null, confidence: null, tried };

        const providers: Array<{ name: string; fn: () => Promise<{ email: string | null; confidence: number | null; reason?: string }> }> = [
          { name: "apollo", fn: () => tryApollo({ ...c, domain }) },
          { name: "hunter", fn: () => tryHunter({ first_name: c.first_name, last_name: c.last_name, domain }) },
        ];

        for (const p of providers) {
          try {
            const r = await p.fn();
            tried.push({ provider: p.name, ok: !!r.email, reason: r.reason });
            if (r.email) {
              final = { email: r.email, source: p.name, confidence: r.confidence, tried };
              break;
            }
          } catch (e) {
            tried.push({ provider: p.name, ok: false, reason: String(e).slice(0, 100) });
          }
        }

        if (final.email) {
          await supabase
            .from("deal_contacts")
            .update({ email: final.email })
            .eq("id", c.id);
        }

        results.push({ contactId: c.id, result: final });
      }
    }

    const hits = results.filter((r) => r.result.email && r.result.source !== "existing").length;
    const leadHits = leadResults.filter((r) => !!r.result.email).length;

    return new Response(
      JSON.stringify({
        results,
        leads: leadResults,
        summary: { processed: results.length, found: hits, leadsProcessed: leadResults.length, leadsFound: leadHits },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("find-email-cascade error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
