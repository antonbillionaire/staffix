/**
 * Публичный чат-endpoint виджета Staffix (21 июля 2026).
 *
 * Посетитель сайта клиента открывает виджет → пишет сообщение → мы вызываем
 * тот же AI-движок что для WA/IG/FB (channel="web"), возвращаем ответ.
 *
 * Диалог сохраняется в ChannelConversation с channel="web". В /dashboard/customers
 * веб-визитор появляется как обычный клиент с бейджем "web" (уже поддерживается
 * ChannelBadge component из Sprint 4A).
 *
 * ── Безопасность (публичный endpoint, обязательно) ─────────────────
 * 1. CORS: * (это же embed на чужих доменах)
 * 2. Rate-limit: 30 msg/hour per IP + 60 msg/hour per business
 *    (защита от abuse если кто-то заскриптует)
 * 3. Honeypot: скрытое поле "website" — боты его заполняют, люди — нет
 * 4. Валидация: message длина 1..1000 символов, visitor_id UUID-like
 * 5. Fail-open rate-limit (widget не должен ломать чужой сайт из-за
 *    нашего лага БД)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { generateChannelAIResponse } from "@/lib/channel-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const MAX_MESSAGE_LENGTH = 1000;
const MAX_VISITOR_ID_LENGTH = 64;

interface ChatRequest {
  message: string;
  visitor_id: string;
  /** Honeypot — если заполнен, значит бот. Скрытое поле в форме. */
  website?: string;
  /** Опциональное имя от посетителя (если сам представился). */
  name?: string;
}

interface ChatResponse {
  reply: string;
  /** Ссылки на мессенджеры — фронт может показать под ответом. */
  channels?: Array<{ type: string; url: string; label: string }>;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Простая проверка что visitor_id похож на UUID/nano-id.
 * Отсекает пустые строки, слишком длинные значения, HTML/JS-инъекции.
 */
function isValidVisitorId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (id.length < 8 || id.length > MAX_VISITOR_ID_LENGTH) return false;
  // Только буквы/цифры/дефис/подчёркивание (UUID-совместимо)
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

function jsonWithCors(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  const ip = getClientIp(request);

  // ── Rate-limit по IP (fail-open чтобы не сломать чужой сайт) ─────
  const ipLimit = await rateLimit(`widget-chat:${ip}`, 30, 60, "open");
  if (!ipLimit.allowed) {
    return jsonWithCors(
      { error: "Слишком много сообщений. Попробуйте через минуту." },
      429
    );
  }

  // ── Парсинг тела ─────────────────────────────────────────────────
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return jsonWithCors({ error: "Invalid JSON" }, 400);
  }

  // Honeypot: скрытое поле "website" в форме. Люди его не видят,
  // боты автозаполняют. Молча возвращаем "success" чтобы не намекать
  // атакующему что мы его палим.
  if (body.website && body.website.trim().length > 0) {
    console.warn(`[widget-chat] honeypot triggered from ${ip}, biz=${businessId}`);
    return jsonWithCors({ reply: "Здравствуйте! Чем могу помочь?" });
  }

  // Валидация message
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return jsonWithCors({ error: "Сообщение пустое" }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonWithCors(
      { error: `Сообщение слишком длинное (максимум ${MAX_MESSAGE_LENGTH} символов)` },
      400
    );
  }

  // Валидация visitor_id
  if (!isValidVisitorId(body.visitor_id)) {
    return jsonWithCors({ error: "Некорректный visitor_id" }, 400);
  }

  // ── Rate-limit по бизнесу (защита от DDoS на конкретный сайт) ────
  const bizLimit = await rateLimit(`widget-chat-biz:${businessId}`, 300, 60, "open");
  if (!bizLimit.allowed) {
    return jsonWithCors(
      { error: "Временная перегрузка. Попробуйте через несколько минут." },
      429
    );
  }

  // ── Проверяем что бизнес существует и widget активен ─────────────
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      botActive: true,
      botUsername: true,
      phone: true,
      waPhoneNumberId: true,
      waActive: true,
      igUsername: true,
      igActive: true,
      fbPageId: true,
      fbActive: true,
    },
  });
  if (!biz) {
    return jsonWithCors({ error: "Business not found" }, 404);
  }
  // Если владелец отключил бота — виджет тоже молчит
  if (!biz.botActive) {
    return jsonWithCors(
      {
        reply:
          "Извините, чат временно недоступен. Напишите нам в мессенджере — ссылки ниже.",
      },
      200
    );
  }

  // ── Генерация AI-ответа через тот же channel-ai движок ───────────
  // channel="web" — новый канал. ChannelConversation создастся автоматически.
  // ChannelClient не создаётся (в channel-ai есть guard "web" != whatsapp/ig/fb).
  // visitor_id = anonymous UUID, name опционально (можно расширить позже).
  let reply: string;
  try {
    reply = await generateChannelAIResponse(
      biz.id,
      "web",
      body.visitor_id,
      message,
      body.name || undefined
    );
  } catch (e) {
    console.error(`[widget-chat] AI failed for biz=${businessId}:`, e);
    reply =
      "Извините, возникла техническая ошибка. Попробуйте ещё раз или напишите нам в мессенджере — ссылки ниже.";
  }

  // ── Собираем ссылки на мессенджеры (для UI-fallback) ─────────────
  const channels: ChatResponse["channels"] = [];
  if (biz.botActive && biz.botUsername) {
    channels.push({ type: "telegram", url: `https://t.me/${biz.botUsername}`, label: "Telegram" });
  }
  if (biz.waActive && biz.waPhoneNumberId && biz.phone) {
    const wa = biz.phone.replace(/\D/g, "");
    if (wa.length >= 8 && wa.length <= 15) {
      channels.push({ type: "whatsapp", url: `https://wa.me/${wa}`, label: "WhatsApp" });
    }
  }
  if (biz.igActive && biz.igUsername) {
    channels.push({ type: "instagram", url: `https://ig.me/m/${biz.igUsername}`, label: "Instagram" });
  }
  if (biz.fbActive && biz.fbPageId) {
    channels.push({ type: "messenger", url: `https://m.me/${biz.fbPageId}`, label: "Messenger" });
  }

  return jsonWithCors({ reply, channels } as ChatResponse);
}
