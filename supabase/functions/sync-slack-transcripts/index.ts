import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) throw new Error("SLACK_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get channel_id and optional user_id from request body or use defaults
    let channelId: string | null = null;
    let userId: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        channelId = body.channel_id || null;
        userId = body.user_id || null;
      } catch {
        // empty body is fine for cron calls
      }
    }

    // Auth check - if called from frontend, verify JWT
    const authHeader = req.headers.get("Authorization");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (authHeader?.startsWith("Bearer ") && !userId) {
      const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (!claimsError && claimsData?.claims?.sub) {
        userId = claimsData.claims.sub as string;
      }
    }

    // If no channel_id provided, try to get it from agent_settings
    if (!channelId && userId) {
      const { data: settings } = await supabaseAdmin
        .from("agent_settings")
        .select("settings")
        .eq("user_id", userId)
        .eq("agent_type", "slack-transcript-sync")
        .maybeSingle();

      if (settings?.settings) {
        const s = settings.settings as Record<string, unknown>;
        channelId = (s.channel_id as string) || null;
      }
    }

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: "No channel_id configured. Please set a Slack channel for transcript sync." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get last synced timestamp
    let lastSyncedTs = "0";
    if (userId) {
      const { data: settings } = await supabaseAdmin
        .from("agent_settings")
        .select("settings")
        .eq("user_id", userId)
        .eq("agent_type", "slack-transcript-sync")
        .maybeSingle();

      if (settings?.settings) {
        const s = settings.settings as Record<string, unknown>;
        lastSyncedTs = (s.last_synced_ts as string) || "0";
      }
    }

    // Fetch messages from Slack channel
    const slackParams = new URLSearchParams({
      channel: channelId,
      oldest: lastSyncedTs,
      limit: "50",
    });

    const slackResp = await fetch(`${GATEWAY_URL}/conversations.history?${slackParams}`, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
    });

    const slackData = await slackResp.json();
    if (!slackResp.ok || !slackData.ok) {
      throw new Error(`Slack API error [${slackResp.status}]: ${JSON.stringify(slackData)}`);
    }

    const messages = slackData.messages || [];
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No new messages" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all deals for matching
    const { data: deals, error: dealsError } = await supabaseAdmin
      .from("deals")
      .select("id, company, first_name, last_name, email");

    if (dealsError) throw new Error(`Failed to fetch deals: ${dealsError.message}`);

    // Get existing granola_meeting_ids to avoid duplicates
    const { data: existingNotes } = await supabaseAdmin
      .from("deal_notes")
      .select("granola_meeting_id")
      .eq("note_type", "transcript")
      .not("granola_meeting_id", "is", null);

    const existingIds = new Set((existingNotes || []).map((n) => n.granola_meeting_id));

    let processed = 0;
    let matched = 0;
    
    let latestTs = lastSyncedTs;

    for (const msg of messages) {
      const msgTs = msg.ts as string;
      const msgText = msg.text as string;

      // Skip if already processed (dedup by Slack message ts)
      if (existingIds.has(msgTs)) continue;
      if (!msgText || msgText.trim().length < 50) continue; // Skip very short messages

      // Track latest timestamp
      if (msgTs > latestTs) latestTs = msgTs;

      // Use AI to extract structured data from transcript
      const extractionResp = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                "Extract structured meeting data from the following Slack message that contains a meeting transcript. Return a JSON object with tool calling.",
            },
            { role: "user", content: msgText },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_meeting_data",
                description: "Extract meeting metadata from a transcript",
                parameters: {
                  type: "object",
                  properties: {
                    company: { type: "string", description: "Company name discussed in the meeting" },
                    attendees: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          email: { type: "string" },
                        },
                        required: ["name"],
                        additionalProperties: false,
                      },
                      description: "People who attended the meeting",
                    },
                    meeting_title: { type: "string", description: "Title or subject of the meeting" },
                    summary: { type: "string", description: "Brief summary of key points discussed" },
                  },
                  required: ["company", "attendees", "meeting_title", "summary"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extract_meeting_data" } },
        }),
      });

      if (!extractionResp.ok) {
        console.error(`AI extraction failed for msg ${msgTs}: ${extractionResp.status}`);
        continue;
      }

      const extractionData = await extractionResp.json();
      let extracted: { company: string; attendees: { name: string; email?: string }[]; meeting_title: string; summary: string };

      try {
        const toolCall = extractionData.choices?.[0]?.message?.tool_calls?.[0];
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error(`Failed to parse AI extraction for msg ${msgTs}`);
        continue;
      }

      // Match against deals - priority order
      let matchedDealId: string | null = null;

      if (deals && deals.length > 0) {
        const extractedCompany = (extracted.company || "").toLowerCase().trim();
        const attendeeNames = extracted.attendees.map((a) => a.name.toLowerCase().trim());
        const attendeeEmails = extracted.attendees
          .filter((a) => a.email)
          .map((a) => a.email!.toLowerCase().trim());

        // 1. Exact company name match
        for (const deal of deals) {
          if (deal.company && deal.company.toLowerCase().trim() === extractedCompany) {
            matchedDealId = deal.id;
            break;
          }
        }

        // 2. Fuzzy company name match (contains)
        if (!matchedDealId && extractedCompany.length > 2) {
          for (const deal of deals) {
            const dc = (deal.company || "").toLowerCase().trim();
            if (dc && (dc.includes(extractedCompany) || extractedCompany.includes(dc))) {
              matchedDealId = deal.id;
              break;
            }
          }
        }

        // 3. Contact name match
        if (!matchedDealId) {
          for (const deal of deals) {
            const dealFirst = (deal.first_name || "").toLowerCase().trim();
            const dealLast = (deal.last_name || "").toLowerCase().trim();
            const dealFull = `${dealFirst} ${dealLast}`.trim();

            for (const attendeeName of attendeeNames) {
              if (dealFull && attendeeName.includes(dealFull)) {
                matchedDealId = deal.id;
                break;
              }
              if (dealLast && dealLast.length > 2 && attendeeName.includes(dealLast)) {
                matchedDealId = deal.id;
                break;
              }
            }
            if (matchedDealId) break;
          }
        }

        // 4. Contact email match
        if (!matchedDealId) {
          for (const deal of deals) {
            const dealEmail = (deal.email || "").toLowerCase().trim();
            if (dealEmail && attendeeEmails.includes(dealEmail)) {
              matchedDealId = deal.id;
              break;
            }
          }
        }
      }

      if (matchedDealId) {
        // Insert as deal_note
        const noteContent = `## ${extracted.meeting_title}\n\n${extracted.summary}\n\n---\n\n${msgText.substring(0, 5000)}`;

        const { error: insertError } = await supabaseAdmin.from("deal_notes").insert({
          deal_id: matchedDealId,
          content: noteContent,
          author: "Granola (via Slack)",
          note_type: "transcript",
          granola_meeting_id: msgTs,
        });

        if (insertError) {
          console.error(`Failed to insert note for deal ${matchedDealId}: ${insertError.message}`);
        } else {
          matched++;
        }
      }

      processed++;
    }

    // Update last synced timestamp
    if (userId && latestTs > lastSyncedTs) {
      const { data: existing } = await supabaseAdmin
        .from("agent_settings")
        .select("id, settings")
        .eq("user_id", userId)
        .eq("agent_type", "slack-transcript-sync")
        .maybeSingle();

      const newSettings = {
        ...((existing?.settings as Record<string, unknown>) || {}),
        channel_id: channelId,
        last_synced_ts: latestTs,
      };

      if (existing) {
        await supabaseAdmin
          .from("agent_settings")
          .update({ settings: newSettings, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("agent_settings").insert({
          user_id: userId,
          agent_type: "slack-transcript-sync",
          settings: newSettings,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, matched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-slack-transcripts error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
