import { NextRequest, NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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

    // Send Telegram notification
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
      // Still return success to user — we received their request
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
