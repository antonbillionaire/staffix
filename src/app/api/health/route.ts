import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";

// Health check — detailed info for admins only
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ status: "ok" }); // minimal response for non-admins
  }

  const checks: Record<string, unknown> = {};

  // 1. Database connection
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = "OK";
  } catch (e) {
    checks.database = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. ANTHROPIC_API_KEY
  const apiKey = process.env.ANTHROPIC_API_KEY;
  checks.anthropicKeySet = !!apiKey;

  // 3. Test Anthropic API
  if (apiKey) {
    try {
      const anthropic = new Anthropic({ apiKey });
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 5,
        messages: [{ role: "user", content: "Hi" }],
      });
      checks.anthropicApi = `OK (model: ${res.model})`;
    } catch (e) {
      checks.anthropicApi = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    checks.anthropicApi = "SKIP: no API key";
  }

  // 4. Check if LoyaltyProgram table exists
  try {
    await prisma.$queryRawUnsafe(`SELECT count(*) FROM "LoyaltyProgram" LIMIT 1`);
    checks.loyaltyTable = "OK";
  } catch (e) {
    checks.loyaltyTable = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 5. Check new Business columns
  try {
    await prisma.$queryRawUnsafe(`SELECT "deliveryEnabled", "businessTypes" FROM "Business" LIMIT 1`);
    checks.newBusinessFields = "OK";
  } catch (e) {
    checks.newBusinessFields = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 6. Check new Client columns
  try {
    await prisma.$queryRawUnsafe(`SELECT "loyaltyPoints", "loyaltyVisits", "loyaltyTotalSpent" FROM "Client" LIMIT 1`);
    checks.clientLoyaltyFields = "OK";
  } catch (e) {
    checks.clientLoyaltyFields = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 7. Total businesses with bots
  try {
    const count = await prisma.business.count({ where: { botToken: { not: null } } });
    checks.businessesWithBots = count;
  } catch (e) {
    checks.businessesWithBots = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 8. Environment
  checks.nodeEnv = process.env.NODE_ENV;
  checks.appUrl = process.env.NEXT_PUBLIC_APP_URL || "not set";
  checks.timestamp = new Date().toISOString();

  return NextResponse.json(checks);
}
