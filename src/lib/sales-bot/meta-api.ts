// Meta Graph API helpers for Instagram DM and WhatsApp Business API

// ========================================
// INSTAGRAM MESSAGING API
// ========================================

/**
 * Send a text message via Instagram Messaging API
 * Docs: https://developers.facebook.com/docs/instagram-messaging
 */
export async function sendInstagramMessage(
  recipientId: string,
  text: string
): Promise<boolean> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !pageId) {
    console.error("Meta API: FACEBOOK_PAGE_ACCESS_TOKEN or FACEBOOK_PAGE_ID not set");
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Meta API: Instagram send error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Meta API: Instagram send error:", error);
    return false;
  }
}

// ========================================
// INSTAGRAM SENDER ACTIONS (UX)
// ========================================

/**
 * Show typing indicator or mark message as seen.
 * Call markSeen first, then typingOn, then send message.
 * sender_action: "typing_on" | "typing_off" | "mark_seen"
 */
async function sendSenderAction(
  recipientId: string,
  senderAction: "typing_on" | "typing_off" | "mark_seen"
): Promise<void> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !pageId) return;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: senderAction,
      }),
    });
  } catch {
    // Non-critical, ignore errors
  }
}

export async function markMessageSeen(recipientId: string): Promise<void> {
  await sendSenderAction(recipientId, "mark_seen");
}

export async function showTypingIndicator(recipientId: string): Promise<void> {
  await sendSenderAction(recipientId, "typing_on");
}

// ========================================
// INSTAGRAM COMMENT PRIVATE REPLY API
// ========================================

/**
 * Send a private DM reply to someone who commented on an Instagram post/ad/Reel.
 * Docs: https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
 *
 * Requirements:
 * - instagram_manage_comments + pages_messaging permissions
 * - Advanced Access (App Review)
 * - Must be sent within 7 days of the comment
 * - Only ONE private reply per comment allowed
 * - After the person replies, a 24h conversation window opens
 */
export async function sendPrivateReply(
  commentId: string,
  text: string
): Promise<boolean> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !pageId) {
    console.error("Meta API: FACEBOOK_PAGE_ACCESS_TOKEN or FACEBOOK_PAGE_ID not set");
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Meta API: Private reply error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Meta API: Private reply error:", error);
    return false;
  }
}

/**
 * Subscribe a Facebook Page to Instagram webhook events.
 * Call this once after connecting a new Page/account.
 * fields: "messages,comments,live_comments"
 */
export async function subscribePageToWebhooks(
  pageId: string,
  pageAccessToken: string,
  fields = "messages,comments,live_comments"
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=${fields}&access_token=${pageAccessToken}`,
      { method: "POST" }
    );
    if (!response.ok) {
      const error = await response.json();
      console.error("Meta API: subscribePageToWebhooks error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Meta API: subscribePageToWebhooks error:", error);
    return false;
  }
}

// ========================================
// WHATSAPP BUSINESS API
// ========================================

/**
 * Send a text message via WhatsApp Business API
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export async function sendWhatsAppMessage(
  recipientPhone: string,
  text: string
): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error("Meta API: WhatsApp credentials not set");
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Meta API: WhatsApp send error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Meta API: WhatsApp send error:", error);
    return false;
  }
}

/**
 * Mark WhatsApp message as read
 */
export async function markWhatsAppRead(messageId: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_BUSINESS_PHONE_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return;

  try {
    await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      }
    );
  } catch {
    // Ignore
  }
}

// ========================================
// WEBHOOK VERIFICATION
// ========================================

/**
 * Verify Meta webhook subscription (used for both Instagram and WhatsApp)
 */
export function verifyMetaWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null
): { valid: boolean; challenge?: string } {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return { valid: true, challenge: challenge || "" };
  }

  return { valid: false };
}
