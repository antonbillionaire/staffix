/**
 * Cron: /api/cron/victor-follow-up (каждые 30 минут через vercel.json)
 *
 * Что делает: находит sales-лидов, которые ответили Виктору хоть раз, потом
 * Виктор задал вопрос — и клиент замолчал. Через ~30-90 минут молчания —
 * Виктор шлёт ОДИН короткий nudge с оценочным примером или уточнением, чтобы
 * лид не потерялся. Cap = 1 nudge на лида (в MVP), потом лид считается lost
 * если по-прежнему молчит.
 *
 * Правила по времени: только 9:00-21:00 по Asia/Tashkent (основной рынок).
 * Не будим лида ночью — это выглядит как спам и убивает конверсию.
 *
 * Правила по сегменту:
 *   - stage IN ("new", "interested") — не трогаем converted и lost.
 *   - updatedAt между 30 и 120 мин назад — окно доставки nudge.
 *   - nudgeCount = 0 — ещё не пробовали.
 *   - последнее сообщение в history — от бота (assistant), не от клиента.
 *     (Если последним был клиент — значит бот сам виноват что не ответил, это
 *     баг обычного webhook, а не «клиент замолчал».)
 *
 * Сам nudge генерирует Claude: даём ему последние 3-4 сообщения диалога и
 * просим написать 1-2 предложения от лица Виктора в его же стиле. Без всяких
 * шаблонов — динамика важна.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { sendInstagramMessage, sendWhatsAppMessage } from "@/lib/sales-bot/meta-api";

export const maxDuration = 60;

type HistoryMessage = { role: "user" | "assistant"; content: string };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Локальное время в Asia/Tashkent — простая проверка «рабочих часов».
 * Возвращает час дня в TSH (0-23). Ошибка на границе часа приемлема,
 * cron всё равно бегает каждые 30 мин.
 */
function tashkentHour(): number {
  const now = new Date();
  const tashkentString = now.toLocaleString("en-US", {
    timeZone: "Asia/Tashkent",
    hour12: false,
    hour: "2-digit",
  });
  return parseInt(tashkentString, 10) || 0;
}

/**
 * Отправка через нужный канал. Не универсализируем — три канала, три метода.
 */
async function sendNudge(lead: {
  channel: string;
  telegramChatId: bigint | null;
  instagramId: string | null;
  fbPsid: string | null;
  whatsappPhone: string | null;
}, text: string): Promise<boolean> {
  try {
    if (lead.channel === "telegram" && lead.telegramChatId) {
      const botToken = process.env.SALES_BOT_TELEGRAM_TOKEN;
      if (!botToken) return false;
      const r = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: lead.telegramChatId.toString(), text }),
        }
      );
      return r.ok;
    }
    if (lead.channel === "instagram" && lead.instagramId) {
      await sendInstagramMessage(lead.instagramId, text);
      return true;
    }
    if (lead.channel === "facebook" && lead.fbPsid) {
      await sendInstagramMessage(lead.fbPsid, text); // meta-api уходит через тот же endpoint
      return true;
    }
    if (lead.channel === "whatsapp" && lead.whatsappPhone) {
      await sendWhatsAppMessage(lead.whatsappPhone, text);
      return true;
    }
  } catch (e) {
    console.error(`[victor-follow-up] send failed channel=${lead.channel}:`, e);
  }
  return false;
}

/**
 * Генерируем nudge с помощью Claude. Промпт короткий и очень ограниченный
 * (макс 200 символов, 1-2 предложения, никаких «сейчас покажу» без результата).
 */
async function generateNudge(history: HistoryMessage[]): Promise<string | null> {
  const recent = history.slice(-6); // последние 6 реплик достаточно для контекста
  const dialogueText = recent
    .map((m) => `${m.role === "user" ? "Клиент" : "Виктор"}: ${m.content}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // Haiku достаточно — это простой follow-up
      max_tokens: 150,
      system: `Ты — Виктор, AI-продажник Staffix. Клиент замолчал после твоего последнего сообщения. Напиши ОДНУ короткую follow-up реплику (1-2 предложения, до 200 символов), которая деликатно возвращает диалог. Правила:
- НЕ упрекать («Вы не ответили» / «жду ответ»)
- НЕ обещать результат которого нет
- Обращение на "Вы", без "привет" — просто продолжи по контексту
- Если в последней твоей реплике был вопрос — дай оценочный пример ответа («может быть 3-5 человек в месяц? тогда потери составят N сум»)
- Если вопроса не было — коротко напомни о ценности и спроси есть ли конкретный вопрос
- НИКАКИХ «сейчас покажу», «дай секунду», «одну минуту» — то что напишешь ты уже и есть результат
- Один эмодзи допустим`,
      messages: [
        {
          role: "user",
          content: `Диалог с клиентом:\n${dialogueText}\n\nТвой follow-up сейчас:`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && "text" in textBlock) {
      return textBlock.text.trim().slice(0, 300); // финальный лимит на всякий случай
    }
  } catch (e) {
    console.error("[victor-follow-up] Claude failed:", e);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startedAt = now.getTime();

  // Часы работы (Tashkent) — ночью не будим
  const hourTsh = tashkentHour();
  if (hourTsh < 9 || hourTsh >= 21) {
    return NextResponse.json({
      skipped: "outside working hours",
      hourTsh,
      timestamp: now.toISOString(),
    });
  }

  // Окно активности: последний update лида был 30-120 минут назад.
  // Верхняя граница 120 мин — если больше двух часов прошло, лид скорее всего
  // уже потерян, nudge выглядит как назойливость.
  const upperCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const lowerCutoff = new Date(now.getTime() - 120 * 60 * 1000);

  const candidates = await prisma.salesLead.findMany({
    where: {
      stage: { in: ["new", "interested"] },
      nudgeCount: 0,
      updatedAt: { gte: lowerCutoff, lte: upperCutoff },
    },
    take: 50, // safety cap на прогон
  });

  const results = {
    candidates: candidates.length,
    nudged: 0,
    skippedNotBotLast: 0,
    skippedNoChannel: 0,
    skippedGenFailed: 0,
    errors: 0,
  };

  for (const lead of candidates) {
    try {
      const history = ((lead.history as HistoryMessage[]) || []).filter(
        (m) => m && typeof m === "object" && (m.role === "user" || m.role === "assistant")
      );

      // Последнее сообщение должно быть от бота — иначе это баг вебхука, а не молчание клиента
      const last = history[history.length - 1];
      if (!last || last.role !== "assistant") {
        results.skippedNotBotLast++;
        continue;
      }

      // Нужен канал для отправки
      const hasChannel =
        (lead.channel === "telegram" && lead.telegramChatId) ||
        (lead.channel === "instagram" && lead.instagramId) ||
        (lead.channel === "facebook" && lead.fbPsid) ||
        (lead.channel === "whatsapp" && lead.whatsappPhone);
      if (!hasChannel) {
        results.skippedNoChannel++;
        continue;
      }

      const nudgeText = await generateNudge(history);
      if (!nudgeText) {
        results.skippedGenFailed++;
        continue;
      }

      const sent = await sendNudge(lead, nudgeText);
      if (!sent) {
        results.errors++;
        continue;
      }

      // Сохраняем nudge в history и обновляем счётчик
      const newHistory = [...history, { role: "assistant" as const, content: nudgeText }];
      await prisma.salesLead.update({
        where: { id: lead.id },
        data: {
          history: newHistory,
          lastNudgeAt: now,
          nudgeCount: { increment: 1 },
        },
      });

      results.nudged++;
      console.log(
        `[victor-follow-up] nudged lead=${lead.id} channel=${lead.channel} text="${nudgeText.slice(0, 80)}"`
      );
    } catch (e) {
      console.error(`[victor-follow-up] error lead=${lead.id}:`, e);
      results.errors++;
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`[victor-follow-up] done in ${durationMs}ms:`, results);
  return NextResponse.json({ ...results, durationMs, hourTsh });
}
