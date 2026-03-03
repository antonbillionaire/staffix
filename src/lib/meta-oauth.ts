/**
 * Meta OAuth helpers for Facebook Login flow and WhatsApp Embedded Signup.
 * Handles token exchange, page listing, webhook subscription, and WABA management.
 */

const META_API_VERSION = "v21.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://staffix.io";
}

function getRedirectUri(): string {
  return `${getAppUrl()}/api/auth/meta/callback`;
}

/**
 * Build the Facebook Login URL for OAuth.
 */
export function buildMetaOAuthUrl(businessId: string): string {
  const scopes = [
    "pages_show_list",
    "pages_messaging",
    "pages_manage_metadata",
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_comments",
  ].join(",");

  const state = Buffer.from(JSON.stringify({ businessId })).toString("base64url");

  return (
    `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?` +
    `client_id=${process.env.META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(getRedirectUri())}` +
    `&state=${state}` +
    `&scope=${scopes}` +
    `&response_type=code`
  );
}

/**
 * Exchange authorization code for long-lived user access token (~60 days).
 */
export async function exchangeCodeForLongLivedToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  // Step 1: code → short-lived token
  const shortRes = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?` +
      `client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(getRedirectUri())}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&code=${code}`
  );
  const shortData = await shortRes.json();
  if (shortData.error) throw new Error(shortData.error.message || "Code exchange failed");

  // Step 2: short-lived → long-lived token
  const longRes = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${shortData.access_token}`
  );
  const longData = await longRes.json();
  if (longData.error) throw new Error(longData.error.message || "Token exchange failed");

  return {
    accessToken: longData.access_token,
    expiresIn: longData.expires_in || 5184000, // default 60 days
  };
}

/**
 * Fetch the authenticated Meta user's ID from a user access token.
 * Used to store metaUserId for data deletion scoping.
 */
export async function getMetaUserId(userAccessToken: string): Promise<string> {
  const res = await fetch(
    `${META_GRAPH_BASE}/me?fields=id&access_token=${userAccessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch Meta user ID");
  return data.id;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

/**
 * Get Facebook Pages the user manages, with Instagram business account info.
 */
export async function getUserPages(userAccessToken: string): Promise<MetaPage[]> {
  const res = await fetch(
    `${META_GRAPH_BASE}/me/accounts?` +
      `fields=id,name,access_token,instagram_business_account{id,username}` +
      `&access_token=${userAccessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch pages");
  return data.data || [];
}

/**
 * Subscribe a Facebook Page to receive webhook events.
 */
export async function subscribePageWebhooks(
  pageId: string,
  pageAccessToken: string,
  fields: string = "messages,messaging_postbacks"
): Promise<boolean> {
  const res = await fetch(
    `${META_GRAPH_BASE}/${pageId}/subscribed_apps?` +
      `subscribed_fields=${fields}` +
      `&access_token=${pageAccessToken}`,
    { method: "POST" }
  );
  const data = await res.json();
  if (data.error) {
    console.error("subscribePageWebhooks error:", data.error);
    return false;
  }
  return data.success === true;
}

/**
 * Unsubscribe page from webhooks and optionally revoke permissions.
 */
export async function disconnectPage(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  await fetch(
    `${META_GRAPH_BASE}/${pageId}/subscribed_apps?access_token=${pageAccessToken}`,
    { method: "DELETE" }
  ).catch(() => {});
}

/**
 * Refresh a long-lived token before it expires.
 * Returns new token or null if refresh failed.
 */
export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const res = await fetch(
      `${META_GRAPH_BASE}/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${process.env.META_APP_ID}` +
        `&client_secret=${process.env.META_APP_SECRET}` +
        `&fb_exchange_token=${currentToken}`
    );
    const data = await res.json();
    if (data.error || !data.access_token) return null;
    return { accessToken: data.access_token, expiresIn: data.expires_in || 5184000 };
  } catch {
    return null;
  }
}

// ─── WhatsApp Embedded Signup ────────────────────────────────────────────────

export interface WAPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
}

export interface WABusinessAccount {
  id: string;
  name: string;
  phoneNumbers: WAPhoneNumber[];
}

/**
 * Exchange WhatsApp Embedded Signup code for access token.
 * Code comes from client-side FB.login() with response_type: 'code'.
 * No redirect_uri for JS SDK codes.
 */
export async function exchangeWACodeForToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;

  console.log("[WA Token Exchange] appId:", appId?.slice(0, 6) + "...");

  const res = await fetch(
    `${META_GRAPH_BASE}/oauth/access_token?` +
      `client_id=${appId}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&code=${code}`
  );
  const data = await res.json();
  console.log("[WA Token Exchange] response:", JSON.stringify(data).slice(0, 200));
  if (data.error) throw new Error(data.error.message || "WA code exchange failed");
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000,
  };
}

/**
 * Get WhatsApp Business Accounts and their phone numbers.
 * Uses the debug_token endpoint to find the WABA ID from Embedded Signup,
 * then fetches phone numbers.
 */
export async function getWABusinessAccounts(
  accessToken: string
): Promise<WABusinessAccount[]> {
  // Get the user's businesses with owned WABAs
  const res = await fetch(
    `${META_GRAPH_BASE}/me/businesses?` +
      `fields=id,name,owned_whatsapp_business_accounts{id,name}` +
      `&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch WABAs");

  const results: WABusinessAccount[] = [];

  for (const biz of data.data || []) {
    const wabas = biz.owned_whatsapp_business_accounts?.data || [];
    for (const waba of wabas) {
      // Fetch phone numbers for this WABA
      const phoneRes = await fetch(
        `${META_GRAPH_BASE}/${waba.id}/phone_numbers?` +
          `fields=id,display_phone_number,verified_name` +
          `&access_token=${accessToken}`
      );
      const phoneData = await phoneRes.json();
      const phones: WAPhoneNumber[] = (phoneData.data || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => ({
          id: p.id,
          display_phone_number: p.display_phone_number || "",
          verified_name: p.verified_name || "",
        })
      );

      results.push({
        id: waba.id,
        name: waba.name || biz.name || "WhatsApp Business",
        phoneNumbers: phones,
      });
    }
  }

  return results;
}

/**
 * Subscribe our app to a WABA for webhook events.
 */
export async function subscribeWABA(
  wabaId: string,
  accessToken: string
): Promise<boolean> {
  const res = await fetch(
    `${META_GRAPH_BASE}/${wabaId}/subscribed_apps`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const data = await res.json();
  if (data.error) {
    console.error("subscribeWABA error:", data.error);
    return false;
  }
  return data.success === true;
}

/**
 * Register a phone number for WhatsApp Cloud API messaging.
 * This tells Meta to route messages through Cloud API.
 */
export async function registerWAPhoneNumber(
  phoneNumberId: string,
  accessToken: string
): Promise<boolean> {
  const res = await fetch(
    `${META_GRAPH_BASE}/${phoneNumberId}/register`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: "123456", // 6-digit PIN for 2FA (required)
      }),
    }
  );
  const data = await res.json();
  if (data.error) {
    console.error("registerWAPhoneNumber error:", data.error);
    return false;
  }
  return data.success === true;
}
