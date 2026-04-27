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
  text: string;        // message text (may be empty if audioUrl is set)
  messageId: string;   // FB message ID
  audioUrl?: string;   // direct URL to audio attachment for STT
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
        if (!message) continue;

        // Detect audio attachment for transcription
        const attachments = message.attachments as Array<{ type?: string; payload?: { url?: string } }> | undefined;
        const audioAtt = attachments?.find((a) => a?.type === "audio");
        const audioUrl = audioAtt?.payload?.url;

        // Skip if neither text nor audio (postbacks, stickers, images)
        if (!message.text && !audioUrl) continue;

        results.push({
          senderId: sender?.id,
          pageId: recipient?.id,
          text: message.text ? String(message.text) : "",
          messageId: String(message.mid || ""),
          audioUrl,
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

// ─── Lead Ads ────────────────────────────────────────────────────────────────

export interface LeadAdData {
  leadId: string;
  formId: string;
  pageId: string;
  adId?: string;
  createdTime: string;
  fields: Record<string, string>; // field_name → value (e.g. full_name, email, phone_number)
}

/**
 * Parse leadgen events from a Facebook webhook payload.
 * Lead Ads events arrive as entry.changes with field="leadgen".
 */
export function parseLeadgenEvents(body: Record<string, unknown>): Array<{
  leadId: string;
  pageId: string;
  formId: string;
  adId?: string;
  createdTime: number;
}> {
  const results: Array<{
    leadId: string;
    pageId: string;
    formId: string;
    adId?: string;
    createdTime: number;
  }> = [];

  if (body.object !== "page") return results;

  for (const entry of (body.entry as Array<Record<string, unknown>>) || []) {
    const changes = (entry.changes as Array<Record<string, unknown>>) || [];
    for (const change of changes) {
      if (change.field !== "leadgen") continue;
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      results.push({
        leadId: String(value.leadgen_id || ""),
        pageId: String(value.page_id || entry.id || ""),
        formId: String(value.form_id || ""),
        adId: value.ad_id ? String(value.ad_id) : undefined,
        createdTime: Number(value.created_time || 0),
      });
    }
  }
  return results;
}

/**
 * Fetch lead data from Meta Graph API.
 * Requires: leads_retrieval permission + Page Access Token.
 * Docs: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
 */
export async function fetchLeadAdData(
  leadId: string,
  pageAccessToken: string
): Promise<LeadAdData | null> {
  try {
    const res = await fetch(
      `${FB_API_BASE}/${leadId}?fields=id,created_time,field_data,ad_id,form_id&access_token=${pageAccessToken}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[LeadAds] fetchLeadAdData error:", err);
      return null;
    }
    const data = await res.json();

    // Parse field_data array into flat object
    const fields: Record<string, string> = {};
    for (const fd of (data.field_data as Array<{ name: string; values: string[] }>) || []) {
      if (fd.name && fd.values?.length) {
        fields[fd.name] = fd.values[0];
      }
    }

    return {
      leadId: data.id || leadId,
      formId: data.form_id || "",
      pageId: "", // filled by caller
      adId: data.ad_id || undefined,
      createdTime: data.created_time || "",
      fields,
    };
  } catch (e) {
    console.error("[LeadAds] fetchLeadAdData exception:", e);
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
