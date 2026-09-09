/**
 * POST /api/messages/reply
 *
 * Manual reply by the business owner from /dashboard/messages.
 * Sends the message via the customer's connected channel (TG / WA / IG / FB)
 * using the customer's per-channel token, then appends it to the conversation
 * history so it shows up in the dashboard.
 *
 * Body: { clientId: string, channel: "telegram" | "whatsapp" | "instagram" | "facebook", text: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/api";
import { sendFBMessage, getPageAccessToken } from "@/lib/facebook-utils";
import { stripMarkdown } from "@/lib/strip-markdown";
import { checkSubscriptionLimit, incrementMessageCount } from "@/lib/subscription-check";
import { computeTakeoverExpiry } from "@/lib/human-takeover";

const META_API_BASE = "https://graph.facebook.com/v21.0";

type Channel = "telegram" | "whatsapp" | "instagram" | "facebook";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      clientId?: string;
      channel?: Channel;
      text?: string;
    };
    const clientId = (body.clientId || "").trim();
    const channel = body.channel as Channel;
    const text = (body.text || "").trim();

    if (!clientId || !channel || !text) {
      return NextResponse.json(
        { error: "Missing clientId, channel or text" },
        { status: 400 }
      );
    }
    if (!["telegram", "whatsapp", "instagram", "facebook"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        botToken: true,
        waAccessToken: true,
        waPhoneNumberId: true,
        fbPageId: true,
        fbPageAccessToken: true,
        igBusinessAccountId: true,
      },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Subscription gate — manual reply counts toward the plan's message limit
    // and stops when trial/subscription expired or PayPro suspended the account.
    // Without this, owners could keep replying for free after the trial ended.
    const subStatus = await checkSubscriptionLimit(business.id);
    if (!subStatus.allowed) {
      return NextResponse.json(
        {
          error: "subscription_blocked",
          reason: subStatus.reason,
          message:
            subStatus.reason === "limit_reached"
              ? "Message limit reached. Upgrade your plan to keep replying."
              : subStatus.reason === "suspended"
              ? "Subscription suspended. Update your payment method to continue."
              : "Subscription expired. Renew your plan to reply to customers.",
        },
        { status: 402 }
      );
    }

    const cleanText = stripMarkdown(text);

    // ─── Route by channel ──────────────────────────────────────────────────

    let sent = false;
    // metaError — детали ответа Meta API когда сообщение отклонено. Раньше
    // возвращали generic "Instagram API rejected the message", владельцу
    // приходилось лезть в Vercel логи. Теперь текст ошибки Meta уходит в UI
    // как есть — сразу видна причина (24h window / invalid token / spam
    // и т.п.). Добавлено 7 сент 2026 по запросу владельца OLLEE.
    let metaError: { code?: number; type?: string; message?: string; subcode?: number } | null = null;
    let errorMessage: string | null = null;

    if (channel === "telegram") {
      if (!business.botToken) {
        return NextResponse.json(
          { error: "Telegram bot not connected" },
          { status: 400 }
        );
      }
      if (!/^\d+$/.test(clientId)) {
        return NextResponse.json({ error: "Invalid Telegram chat ID" }, { status: 400 });
      }
      sent = await sendTelegramMessage(business.botToken, Number(clientId), cleanText);
      if (!sent) errorMessage = "Telegram API rejected the message";
    } else if (channel === "whatsapp") {
      const token = business.waAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = business.waPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phoneNumberId) {
        return NextResponse.json(
          { error: "WhatsApp not connected" },
          { status: 400 }
        );
      }
      const result = await sendWhatsAppText(phoneNumberId, token, clientId, cleanText);
      sent = result.ok;
      if (!sent) {
        metaError = result.metaError;
        errorMessage = "WhatsApp API rejected the message";
      }
    } else if (channel === "facebook") {
      const pageToken = business.fbPageAccessToken;
      const pageId = business.fbPageId;
      if (!pageToken || !pageId) {
        return NextResponse.json(
          { error: "Facebook Page not connected" },
          { status: 400 }
        );
      }
      sent = await sendFBMessage(pageToken, clientId, cleanText, pageId);
      if (!sent) errorMessage = "Facebook API rejected the message";
    } else if (channel === "instagram") {
      const baseToken = business.fbPageAccessToken;
      // IG DM API требует Page ID (FB Page с подключённым IG Business Account),
      // а НЕ Instagram Business Account ID. Оба хранятся у нас в БД, но это
      // разные объекты Meta Graph API.
      //   fbPageId          — объект типа Page (например 904739952733272)
      //   igBusinessAccountId — объект типа IGUser (например 17841448967020589)
      // POST /{PAGE_ID}/messages имеет capability отправки DM. POST на
      // IGUser — не имеет (код 3 "Application does not have the capability").
      //
      // Проверено 7 сент 2026: webhook (instagram/webhook/route.ts) использует
      // именно fbPageId и успешно отправляет 6.3K сообщений (метрика Meta).
      // Manual reply до этого приоритезировал igBusinessAccountId → 100%
      // отклонений с кодом 3.
      //
      // Fallback на igBusinessAccountId оставляем на случай если бизнес
      // подключён через новый Instagram Business Login (без FB Page) — там
      // endpoint работает через IGUser.
      const targetId = business.fbPageId || business.igBusinessAccountId;
      if (!baseToken || !targetId) {
        return NextResponse.json(
          { error: "Instagram not connected" },
          { status: 400 }
        );
      }
      // Convert to Page Access Token (required for IG Messages API)
      const pageToken = await getPageAccessToken(targetId, baseToken).catch(() => baseToken);
      const result = await sendIGText(targetId, pageToken, clientId, cleanText);
      sent = result.ok;
      if (!sent) {
        metaError = result.metaError;
        errorMessage = "Instagram API rejected the message";
      }
    }

    if (!sent) {
      console.error(`[Manual Reply] Failed (${channel}, business=${business.id}):`, errorMessage, metaError);
      // Строим человеко-читаемое сообщение из ответа Meta если он есть.
      // Формат Meta: error.message + error.code + error.error_subcode (опц).
      // Для типичных ошибок даём подсказку что делать.
      const userMessage = metaError?.message
        ? buildFriendlyMetaErrorMessage(metaError, channel)
        : errorMessage || "Failed to send message";
      return NextResponse.json(
        {
          error: userMessage,
          metaError, // сырые детали для отладки, UI может показать в details если нужно
        },
        { status: 502 }
      );
    }

    // ─── Append to conversation history ────────────────────────────────────

    if (channel === "telegram") {
      const conversation = await prisma.conversation.findFirst({
        where: {
          businessId: business.id,
          clientTelegramId: BigInt(clientId),
        },
      });
      if (conversation) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: cleanText,
          },
        });
        // Ставим/продлеваем human takeover: пока менеджер отвечает — бот
        // молчит на входящие клиента в этом диалоге. Каждое новое ручное
        // сообщение сдвигает дедлайн вперёд.
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            updatedAt: new Date(),
            humanTakeoverUntil: computeTakeoverExpiry(),
          },
        });
      }
    } else {
      // Channel conversation (WA/IG/FB)
      const conv = await prisma.channelConversation.findFirst({
        where: {
          businessId: business.id,
          channel,
          clientId,
        },
      });
      if (conv) {
        // Read fresh history to avoid race with bot AI reply
        const history = (conv.history as Array<{ role: string; content: string }>) || [];
        history.push({ role: "assistant", content: cleanText });
        await prisma.channelConversation.update({
          where: { id: conv.id },
          data: {
            history,
            messageCount: { increment: 1 },
            updatedAt: new Date(),
            // Human takeover — см. коммент в telegram-ветке выше.
            humanTakeoverUntil: computeTakeoverExpiry(),
          },
        });
      }
    }

    // Count manual reply toward the plan's message quota — same as AI auto-reply.
    await incrementMessageCount(business.id);

    console.log(`[Manual Reply] Sent (${channel}, business=${business.id}, to=${clientId.slice(0, 8)}...)`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Manual Reply] Unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─── Channel-specific senders ────────────────────────────────────────────────

/** Возвращаемое значение сендеров: ok + опциональная детализация ошибки Meta. */
type SendResult = {
  ok: boolean;
  metaError: { code?: number; type?: string; message?: string; subcode?: number } | null;
};

/** Извлекает поля error из ответа Meta Graph API. Формат:
 *  { error: { message, type, code, error_subcode, fbtrace_id } }
 *  При отсутствии error возвращает null (значит fetch упал по другой причине). */
function extractMetaError(json: unknown): SendResult["metaError"] {
  if (!json || typeof json !== "object") return null;
  const err = (json as { error?: Record<string, unknown> }).error;
  if (!err || typeof err !== "object") return null;
  return {
    code: typeof err.code === "number" ? err.code : undefined,
    type: typeof err.type === "string" ? err.type : undefined,
    message: typeof err.message === "string" ? err.message : undefined,
    subcode: typeof err.error_subcode === "number" ? err.error_subcode : undefined,
  };
}

/**
 * Человеко-читаемое сообщение об ошибке Meta для владельца дашборда.
 * Ловит частые кейсы (24h window, invalid token, permissions), остальное
 * показывает как есть — сырое сообщение Meta плюс код.
 * Добавлено 7 сент 2026 — раньше владелец видел только "Instagram API rejected".
 */
function buildFriendlyMetaErrorMessage(
  metaError: NonNullable<SendResult["metaError"]>,
  channel: string
): string {
  const channelLabel =
    channel === "instagram" ? "Instagram" :
    channel === "whatsapp" ? "WhatsApp" :
    channel === "facebook" ? "Facebook" : channel;
  const code = metaError.code;
  const msg = metaError.message || "unknown";

  // Частые кейсы Meta:
  //  10 / subcode 2534014 — outside 24h messaging window
  //  190 — invalid/expired token
  //  200 — permission denied
  //  551 — user unavailable / user blocked
  //  613 — rate limit
  if (code === 10 || /outside.*allowed.*window|24.hour/i.test(msg)) {
    return `${channelLabel}: клиент не писал более 24 часов — вне окна для ручного ответа. Дождитесь пока клиент напишет сам, или отправьте через официальный шаблон/тег.`;
  }
  if (code === 190) {
    return `${channelLabel}: токен канала недействителен или истёк. Переподключите канал в разделе «Каналы» дашборда.`;
  }
  if (code === 200) {
    return `${channelLabel}: недостаточно прав. Проверьте разрешения приложения (Advanced Access для instagram_manage_messages / pages_messaging).`;
  }
  if (code === 551) {
    return `${channelLabel}: клиент недоступен (заблокировал бота, удалил чат, или его аккаунт неактивен).`;
  }
  if (code === 613) {
    return `${channelLabel}: превышен лимит сообщений. Подождите несколько минут и попробуйте снова.`;
  }
  // Fallback — как есть с кодом чтобы можно было гуглить
  return `${channelLabel} отклонил сообщение (код ${code ?? "—"}): ${msg}`;
}

async function sendWhatsAppText(
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  text: string
): Promise<SendResult> {
  try {
    // decrypt() — envelope encryption; passthrough для plaintext
    const { decrypt } = await import("@/lib/crypto");
    const token = decrypt(accessToken) || accessToken;
    const cleanPhone = recipientPhone.replace(/[\s\-\(\)]/g, "");
    const res = await fetch(`${META_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: text },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Manual Reply] WA send error:", err);
      return { ok: false, metaError: extractMetaError(err) };
    }
    return { ok: true, metaError: null };
  } catch (e) {
    console.error("[Manual Reply] WA send exception:", e);
    return { ok: false, metaError: null };
  }
}

async function sendIGText(
  igAccountId: string,
  pageAccessToken: string,
  recipientId: string,
  text: string
): Promise<SendResult> {
  try {
    // decrypt() — envelope encryption; passthrough для plaintext.
    // Симметрично с sendWhatsAppText: если upstream getPageAccessToken упал
    // и мы откатились на исходный (зашифрованный) baseToken, здесь всё
    // равно расшифруем перед отправкой. Иначе Meta вернёт
    // «Cannot parse access token» (тот же класс бага, что был в
    // /api/auth/meta/pages/route.ts — регрессия июльского шифрования).
    const { decrypt } = await import("@/lib/crypto");
    const token = decrypt(pageAccessToken) || pageAccessToken;

    // IG DM limit is 1000 chars per message; split if needed.
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 1000) {
      const splitAt = remaining.lastIndexOf("\n", 1000);
      const cut = splitAt > 500 ? splitAt : 1000;
      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) chunks.push(remaining);

    for (const chunk of chunks) {
      const res = await fetch(`${META_API_BASE}/${igAccountId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { text: chunk },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[Manual Reply] IG send error:", err);
        return { ok: false, metaError: extractMetaError(err) };
      }
    }
    return { ok: true, metaError: null };
  } catch (e) {
    console.error("[Manual Reply] IG send exception:", e);
    return { ok: false, metaError: null };
  }
}
