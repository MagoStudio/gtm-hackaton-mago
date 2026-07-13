# Slack Pipeline Agent

The Slack bot entrypoint lives at:

`supabase/functions/slack-pipeline-agent/index.ts`

It listens for Slack `app_mention` events, calls Claude through the Anthropic Messages API, and lets Claude use the existing `api-v1` pipeline endpoints through a scoped agent API key.

## Required Supabase secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5
supabase secrets set SLACK_BOT_TOKEN=xoxb-...
supabase secrets set SLACK_SIGNING_SECRET=...
supabase secrets set SLACK_AGENT_API_KEY=...
```

`SLACK_AGENT_API_KEY` should be generated in the product's Agent API Key manager. Give it:

- `read` for summaries, stale deals, search, and deal details.
- `write` only if Slack should add notes, log interactions, or move deal statuses.
- `email` if Slack should create Gmail drafts or send emails through the existing email endpoints.

Optional override:

```bash
supabase secrets set PIPELINE_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1/api-v1
```

If omitted, the function builds this from `SUPABASE_URL`.

## Slack app setup

1. Create a Slack app with a bot user.
2. Add bot scopes:
   - `app_mentions:read`
   - `chat:write`
3. Enable Event Subscriptions.
4. Set the Request URL:

```text
https://<project-ref>.supabase.co/functions/v1/slack-pipeline-agent
```

5. Subscribe to bot event:
   - `app_mention`
6. Install the app into the workspace.
7. Invite the bot to the pipeline channel.

## Example prompts

```text
@Mago what deals need action today?
@Mago summarize SerialSpark
@Mago show me stale deals older than 14 days
@Mago add a note to SerialSpark: Alyssa wants a production partner intro
@Mago move SerialSpark to Qualified
@Mago draft a follow-up email to Alyssa at SerialSpark
@Mago send the follow-up email to alyssa.monroe@serialspark.studio
@Mago send the draft to Alyssa
```

Write tools only run when the Slack user explicitly asks for the write. The actual write still goes through `api-v1`, so scopes and audit logging remain centralized.
Email drafting and sending require a connected Gmail account for the agent key's user.
