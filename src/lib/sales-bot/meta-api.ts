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
  if (!accessToken) {
    console.error("Meta API: FACEBOOK_PAGE_ACCESS_TOKEN not set");
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
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
