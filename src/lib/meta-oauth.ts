/**
 * Meta OAuth helpers for Facebook Login flow.
 * Handles token exchange, page listing, and webhook subscription.
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
