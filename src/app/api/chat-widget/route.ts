import { NextRequest, NextResponse } from "next/server";
import {
  generateSupportReply,
  isEscalationResponse,
  type SupportChatMessage,
} from "@/lib/support-bot-prompt";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface ChatWidgetRequestBody {
  message?: string;
  history?: SupportChatMessage[];
}

/**
 * Endpoint для виджета AI-помощника на дашборде (ChatWidget).
 * Принимает сообщение и краткую историю, возвращает AI ответ.
 * Если AI эскалирует — шлёт уведомление администратору в Telegram.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatWidgetRequestBody;
    const userMessage = (body.message || "").trim();
    if (!userMessage) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }
    if (userMessage.length > 4000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-20)
      : [];

    const reply = await generateSupportReply(history, userMessage);

    // Если AI решил эскалировать — уведомляем админа в Telegram (если настроено).
    if (isEscalationResponse(reply)) {
      const botToken = process.env.SUPPORT_BOT_TOKEN;
      const adminChatId = process.env.SUPPORT_CHAT_ID;
      if (botToken && adminChatId) {
        try {
          const session = await auth().catch(() => null);
          let userInfo = "веб-виджет (без авторизации)";
          if (session?.user?.email) {
            const user = await prisma.user.findUnique({
              where: { email: session.user.email },
              select: { name: true, email: true },
            });
            if (user) {
              userInfo = `${user.name || user.email} (${user.email})`;
            }
          }

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminChatId,
              text:
                `🔔 <b>Эскалация из веб-виджета</b>\n\n` +
                `<b>Пользователь:</b> ${userInfo}\n\n` +
                `<b>Сообщение:</b>\n${userMessage}`,
              parse_mode: "HTML",
            }),
          });
        } catch (e) {
          console.error("[chat-widget] admin notify failed:", e);
        }
      }
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[chat-widget] error:", error);
    return NextResponse.json(
      { reply: "Произошла ошибка. Попробуйте позже или напишите на support@staffix.io." },
      { status: 200 } // 200, чтобы виджет показал сообщение об ошибке текстом, а не «упал»
    );
  }
}
