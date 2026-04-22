/**
 * POST /api/auth/whatsapp/callback
 * Body: { accessToken: string, businessId: string, wabaId?: string, phoneNumberId?: string }
 * Completes WhatsApp Embedded Signup: uses token + IDs from the signup event,
 * subscribes webhooks, registers phone, saves to DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  subscribeWABA,
  registerWAPhoneNumber,
} from "@/lib/meta-oauth";

const META_API_VERSION = "v21.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Fetch phone number details (display number, verified name) by phone number ID.
 */
async function getPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string
): Promise<{ display_phone_number: string; verified_name: string }> {
  const res = await fetch(
    `${META_GRAPH_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) {
    console.error("[WA] getPhoneNumberDetails error:", data.error);
    return { display_phone_number: "", verified_name: "" };
  }
  return {
    display_phone_number: data.display_phone_number || "",
    verified_name: data.verified_name || "",
  };
}

/**
 * Fetch WABA name by WABA ID.
 */
async function getWABAName(
  wabaId: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(
    `${META_GRAPH_BASE}/${wabaId}?fields=name&access_token=${accessToken}`
  );
  const data = await res.json();
  return data.name || "WhatsApp Business";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { code, businessId, wabaId, phoneNumberId } = body;
  let { accessToken } = body;

  if (!businessId) {
    return NextResponse.json(
      { error: "Missing businessId" },
      { status: 400 }
    );
  }

  // If we received a code instead of accessToken, exchange it for a token
  if (code && !accessToken) {
    try {
      const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;
      if (!appId || !appSecret) {
        console.error("[WA] Missing META_APP_ID or META_APP_SECRET env variables");
        return NextResponse.json(
          { error: "Server configuration error. Contact support." },
          { status: 500 }
        );
      }
      const tokenRes = await fetch(
        `${META_GRAPH_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
      );
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        console.error("[WA] Code exchange error:", tokenData.error);
        return NextResponse.json(
          { error: "Failed to exchange code for token: " + (tokenData.error.message || "Unknown error") },
          { status: 400 }
        );
      }
      accessToken = tokenData.access_token;
      console.log("[WA] Exchanged code for access token successfully");
    } catch (err) {
      console.error("[WA] Code exchange failed:", err);
      return NextResponse.json(
        { error: "Failed to exchange authorization code" },
        { status: 500 }
      );
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing accessToken or code" },
      { status: 400 }
    );
  }

  // Verify ownership
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    // If we have both IDs from Embedded Signup event — use them directly
    if (wabaId && phoneNumberId) {
      console.log("[WA Signup] Using IDs from Embedded Signup:", { wabaId, phoneNumberId });

      // Get phone number details and WABA name
      const [phoneDetails, wabaName] = await Promise.all([
        getPhoneNumberDetails(phoneNumberId, accessToken),
        getWABAName(wabaId, accessToken),
      ]);

      // Subscribe WABA to webhooks
      const subscribed = await subscribeWABA(wabaId, accessToken);
      console.log("[WA Signup] Subscribed WABA:", wabaId, "result:", subscribed);

      // Register phone number for Cloud API
      const registered = await registerWAPhoneNumber(phoneNumberId, accessToken);
      console.log("[WA Signup] Registered phone:", phoneNumberId, "result:", registered);

      // Save to Business
      const tokenExpiry = new Date(Date.now() + 5184000 * 1000); // ~60 days
      await prisma.business.update({
        where: { id: businessId },
        data: {
          waPhoneNumberId: phoneNumberId,
          waAccessToken: accessToken,
          waVerifyToken: `staffix_wa_${businessId.slice(0, 8)}`,
          waActive: true,
        },
      });

      // Upsert ChannelConnection
      await prisma.channelConnection.upsert({
        where: { businessId_channel: { businessId, channel: "whatsapp" } },
        create: {
          businessId,
          channel: "whatsapp",
          isConnected: true,
          isVerified: true,
          whatsappPhoneId: phoneNumberId,
          whatsappPhoneNumber: phoneDetails.display_phone_number,
          whatsappBusinessAccId: wabaId,
          metaAccessToken: accessToken,
          metaTokenExpiresAt: tokenExpiry,
          webhookVerified: true,
          connectedAt: new Date(),
          lastActivityAt: new Date(),
        },
        update: {
          isConnected: true,
          isVerified: true,
          whatsappPhoneId: phoneNumberId,
          whatsappPhoneNumber: phoneDetails.display_phone_number,
          whatsappBusinessAccId: wabaId,
          metaAccessToken: accessToken,
          metaTokenExpiresAt: tokenExpiry,
          lastActivityAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        phoneNumber: phoneDetails.display_phone_number,
        verifiedName: phoneDetails.verified_name,
        wabaName,
      });
    }

    // Fallback: no IDs from Embedded Signup — try to discover via API
    // This requires business_management permission
    console.log("[WA Signup] No Embedded Signup IDs, attempting API discovery...");

    // Try debug_token to find granted WABAs
    const debugRes = await fetch(
      `${META_GRAPH_BASE}/debug_token?input_token=${accessToken}&access_token=${accessToken}`
    );
    const debugData = await debugRes.json();
    console.log("[WA Signup] debug_token granular_scopes:", JSON.stringify(debugData.data?.granular_scopes || []).slice(0, 500));

    // Look for whatsapp_business_management scope which includes WABA IDs
    const waScope = debugData.data?.granular_scopes?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.scope === "whatsapp_business_management"
    );

    if (waScope?.target_ids?.length > 0) {
      const discoveredWabaId = waScope.target_ids[0];
      console.log("[WA Signup] Discovered WABA from debug_token:", discoveredWabaId);

      // Get phone numbers for this WABA
      const phoneRes = await fetch(
        `${META_GRAPH_BASE}/${discoveredWabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${accessToken}`
      );
      const phoneData = await phoneRes.json();
      const phones = phoneData.data || [];

      if (phones.length === 0) {
        return NextResponse.json(
          { error: "No phone numbers found in your WhatsApp Business Account." },
          { status: 404 }
        );
      }

      if (phones.length === 1) {
        const phone = phones[0];
        // Auto-connect single phone
        await subscribeWABA(discoveredWabaId, accessToken);
        await registerWAPhoneNumber(phone.id, accessToken);

        const tokenExpiry = new Date(Date.now() + 5184000 * 1000);
        await prisma.business.update({
          where: { id: businessId },
          data: {
            waPhoneNumberId: phone.id,
            waAccessToken: accessToken,
            waVerifyToken: `staffix_wa_${businessId.slice(0, 8)}`,
            waActive: true,
          },
        });

        const wabaName = await getWABAName(discoveredWabaId, accessToken);
        await prisma.channelConnection.upsert({
          where: { businessId_channel: { businessId, channel: "whatsapp" } },
          create: {
            businessId, channel: "whatsapp", isConnected: true, isVerified: true,
            whatsappPhoneId: phone.id, whatsappPhoneNumber: phone.display_phone_number,
            whatsappBusinessAccId: discoveredWabaId, metaAccessToken: accessToken,
            metaTokenExpiresAt: tokenExpiry, webhookVerified: true,
            connectedAt: new Date(), lastActivityAt: new Date(),
          },
          update: {
            isConnected: true, isVerified: true,
            whatsappPhoneId: phone.id, whatsappPhoneNumber: phone.display_phone_number,
            whatsappBusinessAccId: discoveredWabaId, metaAccessToken: accessToken,
            metaTokenExpiresAt: tokenExpiry, lastActivityAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          phoneNumber: phone.display_phone_number,
          verifiedName: phone.verified_name,
          wabaName,
        });
      }

      // Multiple phones — return list
      await prisma.business.update({
        where: { id: businessId },
        data: { waAccessToken: accessToken },
      });

      const wabaName = await getWABAName(discoveredWabaId, accessToken);
      return NextResponse.json({
        needsSelection: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phones: phones.map((p: any) => ({
          phoneId: p.id,
          phoneNumber: p.display_phone_number,
          verifiedName: p.verified_name,
          wabaName,
        })),
      });
    }

    return NextResponse.json(
      { error: "No WhatsApp Business Account found. Please complete the Embedded Signup flow." },
      { status: 404 }
    );
  } catch (err) {
    console.error("POST /api/auth/whatsapp/callback error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "WhatsApp connection failed" },
      { status: 500 }
    );
  }
}
