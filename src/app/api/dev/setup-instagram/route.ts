// One-time setup: subscribe Facebook Page to Instagram webhook events
// Call this once after configuring the Page Access Token in Vercel env vars
// DELETE or restrict access after use

import { NextRequest, NextResponse } from "next/server";
import { subscribePageToWebhooks } from "@/lib/sales-bot/meta-api";

const SECRET = process.env.DEMO_SECRET || "paypro-demo-2025";

export async function POST(request: NextRequest) {
  const { secret } = await request.json();
  if (secret !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pageId =
    process.env.FACEBOOK_PAGE_ID ||
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !pageAccessToken) {
    return NextResponse.json({
      error: "FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be set in env",
    }, { status: 500 });
  }

  const ok = await subscribePageToWebhooks(
    pageId,
    pageAccessToken,
    "messages,comments,live_comments"
  );

  if (ok) {
    return NextResponse.json({
      success: true,
      message: `Page ${pageId} subscribed to: messages, comments, live_comments`,
    });
  }

  return NextResponse.json({
    error: "Failed to subscribe. Check FACEBOOK_PAGE_ACCESS_TOKEN permissions: pages_manage_metadata + instagram_manage_messages required.",
  }, { status: 500 });
}
