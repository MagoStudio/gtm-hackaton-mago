// Contact enrichment via FullEnrich waterfall (email + phone).
// Collects the people to enrich (deal leads + deal contacts), submits one
// bulk FullEnrich job, polls until finished, then writes email/phone back.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FULLENRICH_BULK = "https://app.fullenrich.com/api/v1/contact/enrich/bulk";

interface EnrichResult {
  email: string | null;
  phone: string | null;
  source: string | null;
  confidence: number | null;
  tried: { provider: string; ok: boolean; reason?: string }[];
}

interface Person {
  firstname: string;
  lastname: string;
  company_name?: string;
  linkedin_url?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Submit a bulk job and poll until FINISHED. Returns results aligned by index
// to the input `people` array; entries with insufficient input are null.
async function fullenrichWaterfall(
  key: string,
  people: (Person | null)[],
): Promise<({ email: string | null; phone: string | null } | null)[]> {
  const out: ({ email: string | null; phone: string | null } | null)[] = people.map(() => null);
  const submitIdx: number[] = [];
  const datas = people
    .map((p, i) => {
      if (!p || !p.firstname || !p.lastname || (!p.company_name && !p.linkedin_url)) return null;
      submitIdx.push(i);
      return {
        firstname: p.firstname,
        lastname: p.lastname,
        ...(p.company_name ? { company_name: p.company_name } : {}),
        ...(p.linkedin_url ? { linkedin_url: p.linkedin_url } : {}),
        enrich_fields: ["contact.emails", "contact.phones"],
      };
    })
    .filter(Boolean);

  if (datas.length === 0) return out;

  const submitRes = await fetch(FULLENRICH_BULK, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "GTM enrichment", providers: ["fullenrich"], datas }),
  });
  if (!submitRes.ok) {
    const txt = await submitRes.text().catch(() => "");
    throw new Error(`FullEnrich submit ${submitRes.status}: ${txt.slice(0, 200)}`);
  }
  const { enrichment_id } = await submitRes.json();
  if (!enrichment_id) throw new Error("FullEnrich returned no enrichment_id");

  // Poll up to ~100s.
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(5000);
    const pollRes = await fetch(`${FULLENRICH_BULK}/${enrichment_id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!pollRes.ok) continue;
    const job = await pollRes.json();
    if (job.status === "FINISHED") {
      const rows = job.datas || [];
      rows.forEach((row: { contact?: { most_probable_email?: string; most_probable_phone?: string } }, j: number) => {
        const originalIdx = submitIdx[j];
        if (originalIdx === undefined) return;
        out[originalIdx] = {
          email: row.contact?.most_probable_email ?? null,
          phone: row.contact?.most_probable_phone ?? null,
        };
      });
      return out;
    }
    if (["CANCELED", "CREDITS_INSUFFICIENT", "RATE_LIMIT", "UNKNOWN"].includes(job.status)) {
      throw new Error(`FullEnrich job ${job.status}`);
    }
  }
  // Timed out — return whatever we have (all null); caller reports no hits.
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const FULLENRICH_API_KEY = Deno.env.get("FULLENRICH_API_KEY");
    if (!FULLENRICH_API_KEY) throw new Error("FULLENRICH_API_KEY is not configured");

    const { contactId, contactIds, dealId, dealIds } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dealIdList: string[] = Array.isArray(dealIds) ? dealIds : dealId ? [dealId] : [];

    let ids: string[] = [];
    if (contactId) ids = [contactId];
    else if (Array.isArray(contactIds)) ids = contactIds;
    else if (dealIdList.length > 0) {
      const { data } = await supabase.from("deal_contacts").select("id").in("deal_id", dealIdList).is("email", null);
      ids = (data ?? []).map((r: { id: string }) => r.id);
    }

    // Gather deal leads that still need an email.
    const { data: leadRows } = dealIdList.length > 0
      ? await supabase.from("deals").select("id, first_name, last_name, company, linkedin_url, email").in("id", dealIdList).is("email", null)
      : { data: [] };

    // Gather contacts.
    const { data: contactRows } = ids.length > 0
      ? await supabase.from("deal_contacts").select("id, first_name, last_name, company, linkedin_url, email").in("id", ids)
      : { data: [] };

    const already = (contactRows ?? []).filter((c) => c.email);
    const contactsToEnrich = (contactRows ?? []).filter((c) => !c.email);

    if ((leadRows ?? []).length === 0 && contactsToEnrich.length === 0 && already.length === 0) {
      return new Response(JSON.stringify({ results: [], leads: [], message: "no contacts to enrich" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build one combined FullEnrich batch: leads first, then contacts.
    const people: (Person | null)[] = [
      ...(leadRows ?? []).map((d) => ({
        firstname: d.first_name || "", lastname: d.last_name || "",
        company_name: d.company || undefined, linkedin_url: d.linkedin_url || undefined,
      })),
      ...contactsToEnrich.map((c) => ({
        firstname: c.first_name || "", lastname: c.last_name || "",
        company_name: c.company || undefined, linkedin_url: c.linkedin_url || undefined,
      })),
    ];

    const enriched = people.length > 0 ? await fullenrichWaterfall(FULLENRICH_API_KEY, people) : [];

    const leadResults: Array<{ dealId: string; result: EnrichResult }> = [];
    let cursor = 0;
    for (const d of leadRows ?? []) {
      const r = enriched[cursor++];
      const tried = [{ provider: "fullenrich", ok: !!r?.email, reason: r?.email ? undefined : "no_hit" }];
      if (r?.email || r?.phone) {
        await supabase.from("deals").update({
          ...(r.email ? { email: r.email } : {}),
          ...(r.phone ? { phone: r.phone } : {}),
        }).eq("id", d.id);
      }
      leadResults.push({ dealId: d.id, result: { email: r?.email ?? null, phone: r?.phone ?? null, source: r?.email ? "fullenrich" : null, confidence: r?.email ? 0.9 : null, tried } });
    }

    const results: Array<{ contactId: string; result: EnrichResult }> = [];
    for (const c of already) {
      results.push({ contactId: c.id, result: { email: c.email, phone: null, source: "existing", confidence: 1, tried: [] } });
    }
    for (const c of contactsToEnrich) {
      const r = enriched[cursor++];
      const tried = [{ provider: "fullenrich", ok: !!r?.email, reason: r?.email ? undefined : "no_hit" }];
      if (r?.email || r?.phone) {
        await supabase.from("deal_contacts").update({
          ...(r.email ? { email: r.email } : {}),
          ...(r.phone ? { phone: r.phone } : {}),
        }).eq("id", c.id);
      }
      results.push({ contactId: c.id, result: { email: r?.email ?? null, phone: r?.phone ?? null, source: r?.email ? "fullenrich" : null, confidence: r?.email ? 0.9 : null, tried } });
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
