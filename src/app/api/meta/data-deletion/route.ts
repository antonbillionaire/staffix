import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Meta Data Deletion Callback.
 * Meta sends a signed request when a user removes your app.
 * We must delete their data and return a confirmation URL + code.
 *
 * Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */

interface ParsedSignedRequest {
  user_id: string;
  algorithm: string;
  issued_at: number;
}

function parseSignedRequest(signedRequest: string, appSecret: string): ParsedSignedRequest | null {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;

  // Decode signature
  const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");

  // Compute expected signature
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest();

  if (!crypto.timingSafeEqual(sig, expectedSig)) {
    console.error("[Meta Data Deletion] Signature verification failed");
    return null;
  }

  const decoded = JSON.parse(
    Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
  );

  if (decoded.algorithm?.toUpperCase() !== "HMAC-SHA256") {
    console.error("[Meta Data Deletion] Unexpected algorithm:", decoded.algorithm);
    return null;
  }

  return decoded;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const signedRequest = formData.get("signed_request") as string;

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("[Meta Data Deletion] META_APP_SECRET not configured");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const parsed = parseSignedRequest(signedRequest, appSecret);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
    }

    const metaUserId = parsed.user_id;
    console.log(`[Meta Data Deletion] Request for Meta user_id: ${metaUserId}`);

    // Generate a unique confirmation code
    const confirmationCode = crypto.randomUUID();

    // Find businesses connected via this specific Meta user ID
    const businesses = await prisma.business.findMany({
      where: {
        metaUserId: metaUserId,
      },
      select: { id: true, name: true, fbPageId: true, igBusinessAccountId: true },
    });

    if (businesses.length === 0) {
      console.log(`[Meta Data Deletion] No businesses found for Meta user_id: ${metaUserId}`);
    }

    let deletedCount = 0;
    for (const biz of businesses) {
      // Delete channel conversations from Meta channels
      await prisma.channelConversation.deleteMany({
        where: {
          businessId: biz.id,
          channel: { in: ["facebook", "instagram"] },
        },
      });

      // Delete channel messages from Meta channels
      await prisma.channelMessage.deleteMany({
        where: {
          businessId: biz.id,
          channel: { in: ["facebook", "instagram"] },
        },
      });

      // Delete channel connections for Meta channels
      await prisma.channelConnection.deleteMany({
        where: {
          businessId: biz.id,
          channel: { in: ["facebook", "instagram"] },
        },
      });

      // Clear Meta connection fields
      await prisma.business.update({
        where: { id: biz.id },
        data: {
          fbPageId: null,
          fbPageAccessToken: null,
          fbActive: false,
          igBusinessAccountId: null,
          igUsername: null,
          igActive: false,
          metaUserId: null,
          metaUserAccessToken: null,
          metaTokenExpiresAt: null,
        },
      });

      deletedCount++;
      console.log(`[Meta Data Deletion] Cleared Meta data for business ${biz.id} (${biz.name})`);
    }

    console.log(`[Meta Data Deletion] Completed. Affected businesses: ${deletedCount}, code: ${confirmationCode}`);

    // Meta expects this exact response format
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://staffix.io";
    return NextResponse.json({
      url: `${appUrl}/meta/deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    console.error("[Meta Data Deletion] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
