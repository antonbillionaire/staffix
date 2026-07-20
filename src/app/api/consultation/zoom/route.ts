import { NextRequest, NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 заявок в час с одного IP — защита от спама админ-Telegram.
    // Реальный пользователь подаёт 1 заявку, фейковый бот — пытается флудить.
    const rl = await rateLimit(`consultation-zoom:${getClientIp(req)}`, 5, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Слишком много заявок с этого IP. Попробуйте позже." },
        { status: 429 }
      );
    }

    const { name, email, phone, preferredTime, message } = await req.json();

    // Validate required fields
    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: "Name, email and phone are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Persist the lead in SalesLead BEFORE hitting Telegram. If TG delivery
    // fails, the lead is still recoverable from /admin/sales-leads — losing
    // demo requests to a transient Telegram outage was the pre-fix behaviour.
    const notesBlock = [
      preferredTime ? `Preferred time: ${preferredTime}` : null,
      message ? `Message: ${message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const existing = await prisma.salesLead.findFirst({
        where: { email: email.toLowerCase() },
        select: { id: true, notes: true, stage: true },
      });

      if (existing) {
        const stagedNote = `[Zoom demo ${new Date().toISOString()}]${notesBlock ? `\n${notesBlock}` : ""}`;
        await prisma.salesLead.update({
          where: { id: existing.id },
          data: {
            name: name,
            phone: phone,
            channel: "web",
            // Promote to demo_requested unless already further along.
            stage: ["converted", "trial_started"].includes(existing.stage)
              ? existing.stage
              : "demo_requested",
            notes: existing.notes
              ? `${existing.notes}\n\n${stagedNote}`
              : stagedNote,
          },
        });
      } else {
        await prisma.salesLead.create({
          data: {
            name,
            email: email.toLowerCase(),
            phone,
            channel: "web",
            stage: "demo_requested",
            notes: notesBlock || null,
          },
        });
      }
    } catch (dbErr) {
      // We still want to try Telegram — DB save is not the only channel.
      console.error("Zoom consultation DB save failed:", dbErr);
    }

    // Send Telegram notification (best-effort — DB write above is source of truth)
    const notificationMessage = [
      "📞 New Zoom Consultation Request",
      "",
      `👤 Name: ${name}`,
      `📧 Email: ${email}`,
      `📱 Phone: ${phone}`,
      preferredTime ? `🕐 Preferred time: ${preferredTime}` : "",
      message ? `💬 Message: ${message}` : "",
      "",
      `📅 Submitted: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await sendTelegramNotification(notificationMessage);

    if (!result.success) {
      console.error("Failed to send Telegram notification:", result.error);
      // Still return success to user — DB has the lead, admin will see it.
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Zoom consultation error:", error);
    return NextResponse.json(
      { error: "Failed to submit consultation request" },
      { status: 500 }
    );
  }
}
