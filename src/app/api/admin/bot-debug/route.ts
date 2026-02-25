import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

// Temporary diagnostic endpoint — admin only
export async function GET(request: NextRequest) {
  const session = await auth();
  // Allow access for admin OR via secret header (for CLI debugging)
  const debugSecret = request.headers.get("x-debug-secret");
  const isAdminUser = session?.user?.email && isAdmin(session.user.email);

  if (!isAdminUser && debugSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = request.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "Provide ?username=bot_username" }, { status: 400 });
  }

  const cleanUsername = username.replace("@", "").toLowerCase();

  // 1. Check business in DB
  let business;
  try {
    business = await prisma.business.findFirst({
      where: { botUsername: { equals: cleanUsername, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        botToken: true,
        botUsername: true,
        botActive: true,
        webhookSecret: true,
        businessType: true,
        language: true,
        subscription: {
          select: { plan: true, messagesUsed: true, messagesLimit: true, expiresAt: true },
        },
      },
    });
  } catch (dbError) {
    return NextResponse.json({
      error: "Database query failed",
      details: dbError instanceof Error ? dbError.message : String(dbError),
    }, { status: 500 });
  }

  if (!business) {
    return NextResponse.json({ error: "Business not found for this bot", username: cleanUsername }, { status: 404 });
  }

  // 2. Check webhook status via Telegram API
  let webhookInfo = null;
  if (business.botToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${business.botToken}/getWebhookInfo`);
      webhookInfo = await res.json();
    } catch (e) {
      webhookInfo = { error: String(e) };
    }
  }

  // 3. Check ANTHROPIC_API_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasApiKey = !!apiKey;
  const apiKeyPrefix = apiKey ? apiKey.slice(0, 10) + "..." : null;

  // 4. Test Anthropic API call
  let anthropicTest: { success: boolean; error?: string; model?: string } = { success: false };
  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say OK" }],
      });
      anthropicTest = {
        success: true,
        model: response.model,
      };
    } catch (apiError) {
      anthropicTest = {
        success: false,
        error: apiError instanceof Error ? apiError.message : String(apiError),
      };
    }
  }

  // 5. Check LoyaltyProgram table exists
  let loyaltyTableExists = false;
  try {
    await prisma.loyaltyProgram.findFirst({ where: { businessId: business.id }, select: { id: true } });
    loyaltyTableExists = true;
  } catch {
    loyaltyTableExists = false;
  }

  // 6. Check new Business fields exist
  let newFieldsExist = false;
  try {
    const biz = await prisma.business.findUnique({
      where: { id: business.id },
      select: { id: true },
    });
    // Try accessing new fields via raw query
    const raw = await prisma.$queryRawUnsafe(
      `SELECT "deliveryEnabled", "businessTypes" FROM "Business" WHERE id = $1 LIMIT 1`,
      business.id
    );
    newFieldsExist = Array.isArray(raw) && raw.length > 0;
  } catch (e) {
    newFieldsExist = false;
  }

  // 7. Check Client loyalty fields exist
  let clientLoyaltyFieldsExist = false;
  try {
    const raw = await prisma.$queryRawUnsafe(
      `SELECT "loyaltyPoints" FROM "Client" LIMIT 1`
    );
    clientLoyaltyFieldsExist = true;
  } catch {
    clientLoyaltyFieldsExist = false;
  }

  const subExpired = business.subscription
    ? new Date(business.subscription.expiresAt) < new Date()
    : null;

  return NextResponse.json({
    business: {
      id: business.id,
      name: business.name,
      botUsername: business.botUsername,
      botActive: business.botActive,
      businessType: business.businessType,
      language: business.language,
      hasToken: !!business.botToken,
      hasWebhookSecret: !!business.webhookSecret,
      webhookSecretLength: business.webhookSecret?.length || 0,
    },
    subscription: business.subscription
      ? {
          plan: business.subscription.plan,
          messagesUsed: business.subscription.messagesUsed,
          messagesLimit: business.subscription.messagesLimit,
          expired: subExpired,
          expiresAt: business.subscription.expiresAt,
        }
      : null,
    anthropic: {
      hasApiKey,
      apiKeyPrefix,
      testResult: anthropicTest,
    },
    database: {
      loyaltyTableExists,
      newBusinessFieldsExist: newFieldsExist,
      clientLoyaltyFieldsExist,
    },
    webhookInfo,
  });
}
