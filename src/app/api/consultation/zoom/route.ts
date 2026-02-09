import { NextRequest, NextResponse } from "next/server";
import { sendTelegramNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
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
