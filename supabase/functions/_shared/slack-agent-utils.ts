export function cleanSlackText(text: string) {
  return text.replace(/<@[A-Z0-9]+>/g, "").trim();
}

export function parseSendDraftRequest(text: string) {
  const normalized = text.trim();
  if (!/\bsend\b/i.test(normalized) || !/\bdraft\b/i.test(normalized)) return null;

  const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) return { to: email };

  const recipientMatch =
    normalized.match(/\bdraft\s+(?:email\s+)?to\s+(.+)$/i) ||
    normalized.match(/\bdraft\s+(?:for\s+|à\s+)?(.+)$/i) ||
    normalized.match(/\bto\s+(.+)$/i);

  const recipient = recipientMatch?.[1]
    ?.replace(/[.!?]+$/g, "")
    .replace(/^the\s+/i, "")
    .trim();

  return { recipient_query: recipient || "latest" };
}
