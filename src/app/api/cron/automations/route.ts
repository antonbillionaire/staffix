import { NextResponse } from "next/server";
import {
  processReminders,
  processReviewRequests,
  processReactivation,
} from "@/lib/automation";

// Vercel Cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON] Starting automation jobs...");

    // Run all automation tasks in parallel
    const [remindersResult, reviewsResult, reactivationResult] = await Promise.allSettled([
      processReminders(),
      processReviewRequests(),
      processReactivation(),
    ]);

    const results = {
      timestamp: new Date().toISOString(),
      reminders:
        remindersResult.status === "fulfilled"
          ? remindersResult.value
          : { error: remindersResult.reason },
      reviews:
        reviewsResult.status === "fulfilled"
          ? reviewsResult.value
          : { error: reviewsResult.reason },
      reactivation:
        reactivationResult.status === "fulfilled"
          ? reactivationResult.value
          : { error: reactivationResult.reason },
    };

    console.log("[CRON] Automation jobs completed:", results);

    return NextResponse.json(results);
  } catch (error) {
    console.error("[CRON] Automation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST also allowed for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
