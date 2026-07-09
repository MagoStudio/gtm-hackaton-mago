export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

const BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CHAT_URL = `${BASE_URL}/functions/v1/agent-chat`;
const OPENCLAW_URL = `${BASE_URL}/functions/v1/openclaw-chat`;

export async function streamAgentChat({
  agentType,
  messages,
  context,
  onDelta,
  onToolCall,
  onDone,
  onError,
}: {
  agentType: string;
  messages: ChatMessage[];
  context?: Record<string, unknown>;
  onDelta: (text: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  const isOpenClaw = agentType === "openclaw";
  const url = isOpenClaw ? OPENCLAW_URL : CHAT_URL;
  const payload = isOpenClaw
    ? { messages, botConfigId: context?.botConfigId }
    : { agentType, messages, context };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Unknown error" }));
    onError?.(errorData.error || `Error ${resp.status}`);
    onDone();
    return;
  }

  if (!resp.body) {
    onError?.("No response body");
    onDone();
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let toolCallBuffer: { name: string; args: string } | null = null;
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices?.[0]?.delta;
        
        if (delta?.content) {
          onDelta(delta.content);
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.function?.name) {
              toolCallBuffer = { name: tc.function.name, args: tc.function.arguments || "" };
            } else if (tc.function?.arguments && toolCallBuffer) {
              toolCallBuffer.args += tc.function.arguments;
            }
          }
        }

        // Check for finish reason
        if (parsed.choices?.[0]?.finish_reason === "tool_calls" && toolCallBuffer) {
          try {
            const args = JSON.parse(toolCallBuffer.args);
            onToolCall?.({ name: toolCallBuffer.name, arguments: args });
          } catch {
            // ignore parse errors
          }
          toolCallBuffer = null;
        }
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  // Flush remaining tool call
  if (toolCallBuffer) {
    try {
      const args = JSON.parse(toolCallBuffer.args);
      onToolCall?.({ name: toolCallBuffer.name, arguments: args });
    } catch { /* ignore */ }
  }

  onDone();
}
