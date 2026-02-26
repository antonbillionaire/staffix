/**
 * Debug endpoint: GET /api/debug/fb-test?psid=XXXX
 * Tests FB Messenger send API and returns the raw response.
 * DELETE THIS FILE after debugging.
 */
import { NextResponse } from "next/server";

const FB_API_VERSION = "v21.0";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const psid = searchParams.get("psid");

  const accessToken =
    process.env.STAFFIX_FB_PAGE_ACCESS_TOKEN ||
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: "No FB access token found in env" });
  }

  if (!psid) {
    return NextResponse.json({
      usage: "GET /api/debug/fb-test?psid=YOUR_PSID",
      tokenPreview: accessToken.slice(0, 20) + "...",
      envVars: {
        STAFFIX_FB_PAGE_ACCESS_TOKEN: !!process.env.STAFFIX_FB_PAGE_ACCESS_TOKEN,
        FACEBOOK_PAGE_ACCESS_TOKEN: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
        FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID || "not set",
      },
    });
  }

  // Test 1: Send typing indicator
  let typingResult;
  try {
    const typingRes = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/me/messages?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          sender_action: "typing_on",
        }),
      }
    );
    typingResult = {
      status: typingRes.status,
      body: await typingRes.json().catch(() => null),
    };
  } catch (e) {
    typingResult = { error: String(e) };
  }

  // Test 2: Send actual message
  let messageResult;
  try {
    const msgRes = await fetch(
      `https://graph.facebook.com/${FB_API_VERSION}/me/messages?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          message: { text: "FB Debug test — if you see this, sending works!" },
          messaging_type: "RESPONSE",
        }),
      }
    );
    messageResult = {
      status: msgRes.status,
      body: await msgRes.json().catch(() => null),
    };
  } catch (e) {
    messageResult = { error: String(e) };
  }

  // Test 3: Try with page ID instead of /me
  let pageIdResult;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (pageId) {
    try {
      const pageRes = await fetch(
        `https://graph.facebook.com/${FB_API_VERSION}/${pageId}/messages?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: psid },
            message: { text: "FB Debug test via page ID endpoint" },
            messaging_type: "RESPONSE",
          }),
        }
      );
      pageIdResult = {
        status: pageRes.status,
        body: await pageRes.json().catch(() => null),
      };
    } catch (e) {
      pageIdResult = { error: String(e) };
    }
  }

  return NextResponse.json({
    typing: typingResult,
    messageSendViaMeEndpoint: messageResult,
    messageSendViaPageId: pageIdResult || "FACEBOOK_PAGE_ID not set",
  });
}
