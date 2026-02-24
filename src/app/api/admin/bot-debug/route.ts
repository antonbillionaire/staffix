import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

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

  const business = await prisma.business.findFirst({
    where: { botUsername: { equals: cleanUsername, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      botToken: true,
      botUsername: true,
      botActive: true,
      webhookSecret: true,
      subscription: {
        select: { plan: true, messagesUsed: true, messagesLimit: true, expiresAt: true },
      },
    },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found for this bot", username: cleanUsername }, { status: 404 });
  }

  // Check webhook status via Telegram API
  let webhookInfo = null;
  if (business.botToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${business.botToken}/getWebhookInfo`);
      webhookInfo = await res.json();
    } catch (e) {
      webhookInfo = { error: String(e) };
    }
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
      hasToken: !!business.botToken,
      hasWebhookSecret: !!business.webhookSecret,
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
    webhookInfo,
  });
}
