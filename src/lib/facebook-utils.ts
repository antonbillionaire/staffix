/**
 * Facebook Messenger Platform API utilities
 * Docs: https://developers.facebook.com/docs/messenger-platform
 */

const FB_API_VERSION = "v19.0";
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

/**
 * Send a text message to a Facebook Messenger user
 */
export async function sendFBMessage(
  pageAccessToken: string,
  recipientId: string,
  text: string
): Promise<boolean> {
  try {
    const chunks = splitMessage(text, 2000); // FB limit 2000 chars
    for (const chunk of chunks) {
      const res = await fetch(`${FB_API_BASE}/me/messages?access_token=${pageAccessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: chunk },
          messaging_type: "RESPONSE",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("FB sendMessage error:", err);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error("FB sendMessage exception:", e);
    return false;
  }
}

/**
 * Send typing indicator to show user that bot is processing
 */
export async function sendFBTyping(
  pageAccessToken: string,
  recipientId: string
): Promise<void> {
  try {
    await fetch(`${FB_API_BASE}/me/messages?access_token=${pageAccessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: "typing_on",
      }),
    });
  } catch {}
}

/**
 * Parse incoming Facebook Messenger webhook payload
 */
export interface FBIncomingMessage {
  senderId: string;    // Facebook PSID (Page-Scoped ID)
  pageId: string;      // which page received this
  text: string;        // message text
  messageId: string;   // FB message ID
}

export function parseFBWebhook(body: Record<string, unknown>): FBIncomingMessage | null {
  try {
    if (body.object !== "page") return null;

    const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
    const messaging = (entry?.messaging as Array<Record<string, unknown>>)?.[0];

    if (!messaging) return null;

    const sender = messaging.sender as Record<string, string>;
    const recipient = messaging.recipient as Record<string, string>;
    const message = messaging.message as Record<string, unknown>;

    // Skip echo messages (bot's own messages)
    if (message?.is_echo) return null;
    // Skip postbacks and other non-text events
    if (!message?.text) return null;

    return {
      senderId: sender?.id,
      pageId: recipient?.id,
      text: String(message.text),
      messageId: String(message.mid || ""),
    };
  } catch {
    return null;
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const splitAt = remaining.lastIndexOf("\n", maxLen);
    const cutAt = splitAt > maxLen / 2 ? splitAt : maxLen;
    parts.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}
