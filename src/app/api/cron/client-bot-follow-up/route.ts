/**
 * Cron: /api/cron/client-bot-follow-up (каждые 30 минут через vercel.json)
 *
 * Что делает: для КЛИЕНТСКИХ ботов всех бизнесов Staffix (не путать с
 * victor-follow-up который для нашего sales-бота Виктора) находит диалоги
 * где бот задал клиенту вопрос, а клиент замолчал ~45 мин. Отправляет ОДИН
 * мягкий follow-up чтобы вернуть лида, потом больше не тревожит.
 *
 * Критерии выборки (см. согласованные с owner'ом правила):
 *   - Прошло 45-180 минут с последнего сообщения бота
 *   - Последнее сообщение — от assistant И содержит вопрос («?»)
 *   - После этого сообщения нет ответа клиента (проверяем последний role)
 *   - nudgeCount = 0 (никогда не тревожили этот диалог)
 *   - outcome !== "escalated" (менеджера уже позвали — не мешаем)
 *   - Рабочие часы бизнеса: 9-21 по Business.timezone (по умолчанию Asia/Tashkent)
 *
 * Каналы: TG (Conversation) + WA/IG/FB (ChannelConversation). Web-виджет
 * пропускаем — клиент может уже закрыть вкладку, follow-up бесполезен.
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { checkCronAuth } from "@/lib/cron-auth";
import { sendAutomationMessage } from "@/lib/automation";
import { sendWAMessage } from "@/lib/whatsapp-utils";
import { sendFBMessage } from "@/lib/facebook-utils";
import { SILENT_FOLLOWUP_SYSTEM, buildNudgeUserMessage } from "@/lib/prompts/silent-followup";
import { decrypt } from "@/lib/crypto";
import { stripMarkdown } from "@/lib/strip-markdown";

export const maxDuration = 60;

const NUDGE_MIN_MINUTES = 45;
const NUDGE_MAX_MINUTES = 180;
const WORK_HOURS_START = 9;
const WORK_HOURS_END = 21;
const MAX_BUSINESSES_PER_RUN = 200;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: string; content: string };

/** Локальный час бизнеса по его timezone. Возвращает 0-23 или null при ошибке. */
function localHour(tz: string | null): number | null {
  const timezone = tz || "Asia/Tashkent";
  try {
    const hStr = new Date().toLocaleString("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
    });
    const h = parseInt(hStr, 10);
    return Number.isNaN(h) ? null : h;
  } catch {
    return null;
  }
}

function inWorkHours(tz: string | null): boolean {
  const h = localHour(tz);
  if (h === null) return true; // при ошибке TZ безопаснее греть
  return h >= WORK_HOURS_START && h < WORK_HOURS_END;
}

/**
 * Есть ли в последнем сообщении бота приглашение к следующему шагу —
 * повод пнуть клиента если он замолчал.
 *
 * До 6 августа 2026 проверяли только "?" в тексте. Но LLM (особенно в
 * sales-режиме) часто предлагает без явного вопроса: «Оформляем.»,
 * «Записываю на завтра!», «Могу подобрать что-то другое.» — клиент
 * замолчал, cron должен реагировать. Аудит OLLEE показал что четверть
 * длинных диалогов не получила nudge именно из-за узкого триггера.
 *
 * Триггер срабатывает если:
 *   - Последнее сообщение от assistant (клиент замолчал ПОСЛЕ ответа бота)
 *   - Есть "?" (прямой вопрос) ИЛИ CTA-слово ("оформить", "записать",
 *     "заказать", "выбрать", "подобрать", "показать", "отправить",
 *     "продолжить", "добавить") — знак что бот ждёт ответа/решения
 */
export function lastMessageIsBotQuestion(history: HistoryMessage[]): boolean {
  if (history.length === 0) return false;
  const last = history[history.length - 1];
  if (last.role !== "assistant") return false;
  const text = last.content.toLowerCase();
  if (text.includes("?")) return true;
  // CTA-слова которые обычно намекают что клиент должен ответить
  const ctaKeywords = [
    "оформить", "оформляем", "оформляю", "оформи",
    "записать", "записываю", "запишем", "запиши",
    "заказать", "заказываю",
    "выбрать", "выбираем", "выбирай",
    "подобрать", "подобрал", "подбираю",
    "показать", "покажу", "показываю",
    "отправить", "отправляю",
    "продолжить", "продолжаем",
    "добавить", "добавляю",
    "ждём вас", "жду ответа",
  ];
  return ctaKeywords.some((k) => text.includes(k));
}

/**
 * Генерирует nudge-текст через Claude Haiku. Короткий вызов, дешёвый —
 * ~500 tokens input + ~80 output. Не используем Sonnet: задача простая,
 * промпт жёсткий, Haiku справляется.
 */
async function generateNudgeText(
  recent: HistoryMessage[],
  clientName: string | null,
  businessName: string
): Promise<string | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SILENT_FOLLOWUP_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Компания: "${businessName}".\n\n${buildNudgeUserMessage(recent, clientName)}`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    if (!text || text.length < 10) return null;
    // Sanity: nudge не должен быть слишком длинным
    if (text.length > 500) return text.slice(0, 500);
    return text;
  } catch (e) {
    console.error("[client-bot-follow-up] Claude generation failed:", e);
    return null;
  }
}

interface ProcessResult {
  scanned: number;
  skippedNightHours: number;
  skippedEscalated: number;
  skippedNoQuestion: number;
  skippedNoCredentials: number;
  nudgeSent: number;
  errors: number;
}

/** Обработать TG-диалоги (Conversation модель) */
async function processTelegramConversations(since: Date, until: Date): Promise<ProcessResult> {
  const r: ProcessResult = {
    scanned: 0, skippedNightHours: 0, skippedEscalated: 0,
    skippedNoQuestion: 0, skippedNoCredentials: 0, nudgeSent: 0, errors: 0,
  };

  const candidates = await prisma.conversation.findMany({
    where: {
      updatedAt: { gte: since, lte: until },
      nudgeCount: 0,
      outcome: { not: "escalated" },
    },
    take: MAX_BUSINESSES_PER_RUN,
    include: {
      business: { select: { id: true, name: true, timezone: true, botToken: true, botActive: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 4 },
    },
    orderBy: { updatedAt: "asc" },
  });

  r.scanned = candidates.length;

  for (const conv of candidates) {
    if (!conv.business.botActive || !conv.business.botToken) {
      r.skippedNoCredentials++;
      continue;
    }
    if (!inWorkHours(conv.business.timezone)) {
      r.skippedNightHours++;
      continue;
    }

    // reverse — старые → новые
    const chrono = [...conv.messages].reverse().map((m) => ({ role: m.role, content: m.content }));

    if (!lastMessageIsBotQuestion(chrono)) {
      r.skippedNoQuestion++;
      continue;
    }

    const text = await generateNudgeText(chrono, conv.clientName, conv.business.name);
    if (!text) { r.errors++; continue; }

    const send = await sendAutomationMessage(conv.business.botToken, conv.clientTelegramId, stripMarkdown(text));
    if (!send.success) { r.errors++; continue; }

    // Записываем в БД что nudge ушёл + сохраняем в Message для истории диалога
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conv.id },
        data: { nudgeCount: { increment: 1 }, nudgeSentAt: new Date() },
      }),
      prisma.message.create({
        data: { conversationId: conv.id, role: "assistant", content: text },
      }),
    ]);

    r.nudgeSent++;
    console.log(`[client-bot-follow-up] TG nudge sent biz=${conv.business.id} conv=${conv.id}`);
  }

  return r;
}

/** Обработать WA/IG/FB диалоги (ChannelConversation модель) */
async function processChannelConversations(since: Date, until: Date): Promise<ProcessResult> {
  const r: ProcessResult = {
    scanned: 0, skippedNightHours: 0, skippedEscalated: 0,
    skippedNoQuestion: 0, skippedNoCredentials: 0, nudgeSent: 0, errors: 0,
  };

  const candidates = await prisma.channelConversation.findMany({
    where: {
      updatedAt: { gte: since, lte: until },
      nudgeCount: 0,
      outcome: { not: "escalated" },
      // web-виджет пропускаем — клиент мог уже закрыть вкладку
      channel: { in: ["whatsapp", "instagram", "facebook", "messenger"] },
    },
    take: MAX_BUSINESSES_PER_RUN,
    include: {
      business: {
        select: {
          id: true, name: true, timezone: true,
          waActive: true, waPhoneNumberId: true, waAccessToken: true,
          igActive: true, igBusinessAccountId: true,
          fbActive: true, fbPageId: true, fbPageAccessToken: true,
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  r.scanned = candidates.length;

  for (const conv of candidates) {
    if (!inWorkHours(conv.business.timezone)) {
      r.skippedNightHours++;
      continue;
    }

    const history = Array.isArray(conv.history) ? (conv.history as unknown as HistoryMessage[]) : [];
    if (!lastMessageIsBotQuestion(history)) {
      r.skippedNoQuestion++;
      continue;
    }

    // Проверка креденшелов канала — молча пропускаем если ушли/не подключены
    let sent = false;
    let sendError = false;

    if (conv.channel === "whatsapp") {
      if (!conv.business.waActive || !conv.business.waPhoneNumberId || !conv.business.waAccessToken) {
        r.skippedNoCredentials++;
        continue;
      }
      const text = await generateNudgeText(history, conv.clientName, conv.business.name);
      if (!text) { r.errors++; continue; }
      const envToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const waToken = envToken || conv.business.waAccessToken;
      const ok = await sendWAMessage(conv.business.waPhoneNumberId, waToken, conv.clientId, text);
      if (ok) {
        sent = true;
        await recordNudge(conv.id, text, history);
      } else {
        sendError = true;
      }
    } else if (conv.channel === "instagram") {
      if (!conv.business.igActive || !conv.business.igBusinessAccountId || !conv.business.fbPageAccessToken) {
        r.skippedNoCredentials++;
        continue;
      }
      const text = await generateNudgeText(history, conv.clientName, conv.business.name);
      if (!text) { r.errors++; continue; }
      const ok = await sendIGDirect(conv.business.igBusinessAccountId, conv.business.fbPageAccessToken, conv.clientId, text);
      if (ok) {
        sent = true;
        await recordNudge(conv.id, text, history);
      } else {
        sendError = true;
      }
    } else if (conv.channel === "facebook" || conv.channel === "messenger") {
      if (!conv.business.fbActive || !conv.business.fbPageAccessToken) {
        r.skippedNoCredentials++;
        continue;
      }
      const text = await generateNudgeText(history, conv.clientName, conv.business.name);
      if (!text) { r.errors++; continue; }
      const ok = await sendFBMessage(conv.business.fbPageAccessToken, conv.clientId, text, conv.business.fbPageId || undefined);
      if (ok) {
        sent = true;
        await recordNudge(conv.id, text, history);
      } else {
        sendError = true;
      }
    }

    if (sent) {
      r.nudgeSent++;
      console.log(`[client-bot-follow-up] ${conv.channel} nudge sent biz=${conv.business.id} conv=${conv.id}`);
    } else if (sendError) {
      r.errors++;
    }
  }

  return r;
}

/** Единый recordNudge для всех каналов — инкремент + append в history. */
async function recordNudge(convId: string, text: string, history: HistoryMessage[]): Promise<void> {
  const newHistory = [...history, { role: "assistant", content: text }];
  await prisma.channelConversation.update({
    where: { id: convId },
    data: {
      nudgeCount: { increment: 1 },
      nudgeSentAt: new Date(),
      // Prisma требует JSON-совместимый тип; наши записи — простые
      // {role, content} объекты, безопасно кастим через JsonArray.
      history: newHistory as unknown as import("@prisma/client").Prisma.JsonArray,
    },
  });
}

/**
 * Inline Instagram DM sender (Facebook Graph API). Копия логики из
 * instagram/webhook/route.ts — не экспортируем оттуда чтобы не менять
 * рабочий webhook-путь.
 */
async function sendIGDirect(igAccountId: string, accessToken: string, recipientId: string, text: string): Promise<boolean> {
  try {
    const token = decrypt(accessToken) || accessToken;
    const clean = stripMarkdown(text);
    if (!clean) return true;
    const res = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text: clean.slice(0, 1000) },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[client-bot-follow-up] IG send error:", err.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[client-bot-follow-up] IG send exception:", e);
    return false;
  }
}

export async function GET(request: Request) {
  const cronAuth = checkCronAuth(request);
  if (!cronAuth.ok) return cronAuth.response!;

  const now = Date.now();
  const since = new Date(now - NUDGE_MAX_MINUTES * 60 * 1000);
  const until = new Date(now - NUDGE_MIN_MINUTES * 60 * 1000);
  const startedAt = new Date();

  try {
    const [tgResult, chResult] = await Promise.all([
      processTelegramConversations(since, until),
      processChannelConversations(since, until),
    ]);

    const total = {
      telegram: tgResult,
      channels: chResult,
      totalNudgeSent: tgResult.nudgeSent + chResult.nudgeSent,
      totalScanned: tgResult.scanned + chResult.scanned,
      durationMs: Date.now() - startedAt.getTime(),
    };

    console.log("[client-bot-follow-up] done:", total);
    return NextResponse.json(total);
  } catch (error) {
    console.error("[client-bot-follow-up] cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
