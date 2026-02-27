/**
 * Facebook Messenger Platform API utilities
 * Docs: https://developers.facebook.com/docs/messenger-platform
 */

const FB_API_VERSION = "v21.0";
const FB_API_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

// Cache page access tokens (System User token → Page Access Token)
const pageTokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Get a Page Access Token from a System User token.
 * System User tokens can't call /me/messages — need page-specific tokens.
 * Caches the result for 30 minutes.
 */
export async function getPageAccessToken(
  pageId: string,
  systemUserToken: string
): Promise<string> {
  const cacheKey = `${pageId}:${systemUserToken.slice(-10)}`;
  const cached = pageTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  try {
    const res = await fetch(
      `${FB_API_BASE}/${pageId}?fields=access_token&access_token=${systemUserToken}`
    );
    const data = await res.json();
    if (data.access_token) {
      pageTokenCache.set(cacheKey, {
        token: data.access_token,
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 min cache
      });
      return data.access_token;
    }
  } catch (e) {
    console.error("getPageAccessToken error:", e);
  }
  // Fallback: return original token
  return systemUserToken;
}

/**
 * Send a text message to a Facebook Messenger user
 */
export async function sendFBMessage(
  pageAccessToken: string,
  recipientId: string,
  text: string,
  pageId?: string
): Promise<boolean> {
  try {
    const chunks = splitMessage(text, 2000); // FB limit 2000 chars
    // Resolve page access token if we have pageId (System User tokens need this)
    const token = pageId ? await getPageAccessToken(pageId, pageAccessToken) : pageAccessToken;
    const endpoint = pageId ? `${FB_API_BASE}/${pageId}/messages` : `${FB_API_BASE}/me/messages`;
    for (const chunk of chunks) {
      const res = await fetch(`${endpoint}?access_token=${token}`, {
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
  recipientId: string,
  pageId?: string
): Promise<void> {
  try {
    const token = pageId ? await getPageAccessToken(pageId, pageAccessToken) : pageAccessToken;
    const endpoint = pageId ? `${FB_API_BASE}/${pageId}/messages` : `${FB_API_BASE}/me/messages`;
    await fetch(`${endpoint}?access_token=${token}`, {
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

/**
 * Parse ALL incoming messages from a Facebook Messenger webhook payload.
 * Returns array of messages (Meta can batch multiple entries/messaging events).
 */
export function parseFBWebhookAll(body: Record<string, unknown>): FBIncomingMessage[] {
  const results: FBIncomingMessage[] = [];
  try {
    if (body.object !== "page") return results;

    for (const entry of (body.entry as Array<Record<string, unknown>>) || []) {
      for (const messaging of (entry.messaging as Array<Record<string, unknown>>) || []) {
        const sender = messaging.sender as Record<string, string>;
        const recipient = messaging.recipient as Record<string, string>;
        const message = messaging.message as Record<string, unknown>;

        // Skip echo messages (bot's own messages)
        if (message?.is_echo) continue;
        // Skip postbacks and other non-text events
        if (!message?.text) continue;

        results.push({
          senderId: sender?.id,
          pageId: recipient?.id,
          text: String(message.text),
          messageId: String(message.mid || ""),
        });
      }
    }
  } catch (e) {
    console.error("parseFBWebhookAll error:", e);
  }
  return results;
}

/**
 * Parse incoming Facebook Messenger webhook payload (legacy — returns first message only)
 */
export function parseFBWebhook(body: Record<string, unknown>): FBIncomingMessage | null {
  const all = parseFBWebhookAll(body);
  return all.length > 0 ? all[0] : null;
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
