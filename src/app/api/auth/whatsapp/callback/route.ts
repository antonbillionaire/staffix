/**
 * POST /api/auth/whatsapp/callback
 * Body: { accessToken?: string, code?: string, businessId: string, phoneNumberId?: string }
 * Completes WhatsApp Embedded Signup: uses token directly (or exchanges code),
 * discovers WABA and phone numbers, subscribes webhooks, saves to DB.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  exchangeWACodeForToken,
  getWABusinessAccounts,
  subscribeWABA,
  registerWAPhoneNumber,
} from "@/lib/meta-oauth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    accessToken: directToken,
    code,
    businessId,
    phoneNumberId: selectedPhoneId,
  } = body;

  if ((!directToken && !code) || !businessId) {
    return NextResponse.json(
      { error: "Missing accessToken/code or businessId" },
      { status: 400 }
    );
  }

  // Verify ownership
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: { id: true, waAccessToken: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    // 1. Get access token — direct from FB.login() or exchange code
    let accessToken: string;
    let expiresIn = 5184000; // default 60 days

    if (directToken) {
      // Token came directly from FB.login() (default response_type)
      accessToken = directToken;
      console.log("[WA Signup] Using direct token from FB.login()");
    } else if (selectedPhoneId && business.waAccessToken) {
      // Phone selection step — token was saved earlier
      accessToken = business.waAccessToken;
      console.log("[WA Signup] Using saved token for phone selection");
    } else {
      // Code flow fallback
      const result = await exchangeWACodeForToken(code);
      accessToken = result.accessToken;
      expiresIn = result.expiresIn;
      console.log("[WA Signup] Token from code exchange, expiresIn:", expiresIn);
    }

    // 2. Discover WABAs and phone numbers
    const wabas = await getWABusinessAccounts(accessToken);
    console.log("[WA Signup] Found WABAs:", wabas.length);

    if (wabas.length === 0) {
      return NextResponse.json(
        { error: "No WhatsApp Business Account found. Please try again." },
        { status: 404 }
      );
    }

    // Collect all phone numbers across all WABAs
    const allPhones: Array<{
      wabaId: string;
      wabaName: string;
      phoneId: string;
      phoneNumber: string;
      verifiedName: string;
    }> = [];

    for (const waba of wabas) {
      for (const phone of waba.phoneNumbers) {
        allPhones.push({
          wabaId: waba.id,
          wabaName: waba.name,
          phoneId: phone.id,
          phoneNumber: phone.display_phone_number,
          verifiedName: phone.verified_name,
        });
      }
    }

    if (allPhones.length === 0) {
      return NextResponse.json(
        { error: "No phone numbers found in your WhatsApp Business Account." },
        { status: 404 }
      );
    }

    // 3. If multiple phones and no selection yet — return list for user to choose
    if (allPhones.length > 1 && !selectedPhoneId) {
      // Save token temporarily (waActive stays false)
      await prisma.business.update({
        where: { id: businessId },
        data: {
          waAccessToken: accessToken,
        },
      });
      return NextResponse.json({
        needsSelection: true,
        phones: allPhones.map((p) => ({
          phoneId: p.phoneId,
          phoneNumber: p.phoneNumber,
          verifiedName: p.verifiedName,
          wabaName: p.wabaName,
        })),
      });
    }

    // 4. Select phone (auto if single, or user-selected)
    const selected = selectedPhoneId
      ? allPhones.find((p) => p.phoneId === selectedPhoneId) || allPhones[0]
      : allPhones[0];

    // 5. Subscribe WABA to webhooks
    await subscribeWABA(selected.wabaId, accessToken);
    console.log("[WA Signup] Subscribed WABA:", selected.wabaId);

    // 6. Register phone number for Cloud API
    await registerWAPhoneNumber(selected.phoneId, accessToken);
    console.log("[WA Signup] Registered phone:", selected.phoneId);

    // 7. Save to Business
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
    await prisma.business.update({
      where: { id: businessId },
      data: {
        waPhoneNumberId: selected.phoneId,
        waAccessToken: accessToken,
        waVerifyToken: `staffix_wa_${businessId.slice(0, 8)}`,
        waActive: true,
      },
    });

    // 8. Upsert ChannelConnection
    await prisma.channelConnection.upsert({
      where: { businessId_channel: { businessId, channel: "whatsapp" } },
      create: {
        businessId,
        channel: "whatsapp",
        isConnected: true,
        isVerified: true,
        whatsappPhoneId: selected.phoneId,
        whatsappPhoneNumber: selected.phoneNumber,
        whatsappBusinessAccId: selected.wabaId,
        metaAccessToken: accessToken,
        metaTokenExpiresAt: tokenExpiry,
        webhookVerified: true,
        connectedAt: new Date(),
        lastActivityAt: new Date(),
      },
      update: {
        isConnected: true,
        isVerified: true,
        whatsappPhoneId: selected.phoneId,
        whatsappPhoneNumber: selected.phoneNumber,
        whatsappBusinessAccId: selected.wabaId,
        metaAccessToken: accessToken,
        metaTokenExpiresAt: tokenExpiry,
        lastActivityAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      phoneNumber: selected.phoneNumber,
      verifiedName: selected.verifiedName,
      wabaName: selected.wabaName,
    });
  } catch (err) {
    console.error("POST /api/auth/whatsapp/callback error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "WhatsApp connection failed" },
      { status: 500 }
    );
  }
}
