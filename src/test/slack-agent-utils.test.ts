import { describe, expect, it } from "vitest";
import { cleanSlackText, parseSendDraftRequest } from "../../supabase/functions/_shared/slack-agent-utils";

describe("slack-agent-utils", () => {
  it("removes Slack app mention tokens", () => {
    expect(cleanSlackText("<@U123ABC> send the draft to Malin")).toBe("send the draft to Malin");
  });

  it("does not parse non-draft send requests as draft sends", () => {
    expect(parseSendDraftRequest("send an email to malin@mago.studio")).toBeNull();
  });

  it("parses draft send by email", () => {
    expect(parseSendDraftRequest("send the draft to malin@mago.studio")).toEqual({
      to: "malin@mago.studio",
    });
  });

  it("parses draft send by recipient name", () => {
    expect(parseSendDraftRequest("send the draft to Malin.")).toEqual({
      recipient_query: "Malin",
    });
  });

  it("falls back to latest draft when no recipient is specified", () => {
    expect(parseSendDraftRequest("send the draft")).toEqual({
      recipient_query: "latest",
    });
  });
});
