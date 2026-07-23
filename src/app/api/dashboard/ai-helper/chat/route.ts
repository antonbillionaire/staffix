/**
 * POST /api/dashboard/ai-helper/chat (23 июля 2026)
 *
 * Встроенный AI-помощник для владельца бизнеса в дашборде Staffix.
 * Владелец задаёт вопрос («как настроить WhatsApp?»), помощник отвечает
 * с учётом:
 *   - Всей документации Staffix (docSections из docs-content.ts)
 *   - Текущего состояния бизнеса (что уже настроено, какие каналы активны)
 *   - Названия страницы дашборда где владелец задал вопрос
 *
 * Body: { messages: [{role, content}], currentPagePath?: string }
 * Response: { reply: string }
 *
 * Auth: сессия владельца обязательна.
 * Rate-limit: 60 msg/hour per business — 3× больше widget-чата т.к. владелец
 * задаёт больше вопросов подряд во время настройки.
 * Trackable: расходы Claude идут в Business.tokensUsed* через trackClaudeUsage
 * (входят в общий счёт клиента, но никаких отдельных лимитов — этот помощник
 * бесплатен для владельца, мы его подарок клиентам).
 */

import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getCurrentBusinessId } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { callClaudeWithRetry, logClaudeUsage, trackClaudeUsage } from "@/lib/claude-retry";
import {
  loadHelperContext,
  buildHelperSystemPrompt,
  getDocsSectionContent,
} from "@/lib/dashboard-helper-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 20;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  messages?: ChatMessage[];
  currentPagePath?: string;
}

export async function POST(request: NextRequest) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Rate-limit — helper бесплатен, но не хочу чтобы владелец случайно
  // задудосил (или намеренно). 60 msg/hour = 1 сообщение/минуту в среднем.
  const rl = await rateLimit(`ai-helper:${businessId}`, 60, 60, "open");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Слишком много вопросов. Подождите минуту и попробуйте снова." },
      { status: 429 }
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_HISTORY) : [];
  const cleanMessages: ChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m.content !== "string") continue;
    if (m.role !== "user" && m.role !== "assistant") continue;
    const content = m.content.trim().slice(0, MAX_MESSAGE_LEN);
    if (!content) continue;
    cleanMessages.push({ role: m.role, content });
  }
  if (cleanMessages.length === 0 || cleanMessages[cleanMessages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Ожидаем список сообщений заканчивающийся вопросом пользователя" },
      { status: 400 }
    );
  }

  const ctx = await loadHelperContext(businessId, body.currentPagePath);
  if (!ctx) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }

  const { stable, variable } = buildHelperSystemPrompt();

  // Tool для получения полного контента секции docs (лениво — только если
  // AI решит что нужны детали, не грузим всю доку в промпт).
  const tools: Anthropic.Messages.Tool[] = [
    {
      name: "get_docs_section",
      description:
        "Получить полный текст секции документации Staffix по её ID. Использовать когда нужны конкретные пошаговые инструкции которых нет в кратком индексе. ID берётся из списка секций в системном промпте (например 'channels', 'knowledge', 'ads').",
      input_schema: {
        type: "object",
        properties: {
          section_id: {
            type: "string",
            description: "ID секции документации (например 'meta-ads', 'site-widget')",
          },
        },
        required: ["section_id"],
      },
    },
  ];

  // Split-prompt caching: stable (1h) + variable (5m) — как везде в проекте.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: stable, cache_control: { type: "ephemeral", ttl: "1h" } },
    { type: "text", text: variable(ctx), cache_control: { type: "ephemeral", ttl: "5m" } },
  ];

  try {
    let response = await callClaudeWithRetry({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system: systemBlocks,
      messages: cleanMessages,
      tools,
    });
    logClaudeUsage("dashboard-helper/main", response.usage, { biz: businessId });
    if (response.usage) trackClaudeUsage(businessId, response.usage);

    // Tool-loop: если помощник решил дёрнуть get_docs_section
    let iterations = 0;
    const maxIterations = 3;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workingMessages: any[] = [...cleanMessages];

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

      workingMessages.push({ role: "assistant", content: response.content });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolResults: any[] = [];
      for (const b of toolUseBlocks) {
        if (b.type !== "tool_use") continue;
        if (b.name === "get_docs_section") {
          const sectionId = (b.input as { section_id?: string })?.section_id ?? "";
          const content = getDocsSectionContent(sectionId);
          toolResults.push({
            type: "tool_result",
            tool_use_id: b.id,
            content: content ?? `Секция "${sectionId}" не найдена. Проверь ID по индексу.`,
          });
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: b.id,
            content: "Неизвестный инструмент",
          });
        }
      }
      workingMessages.push({ role: "user", content: toolResults });

      response = await callClaudeWithRetry({
        // Haiku для tool-loop итераций — задача простая (переформулировать
        // ответ на базе прочитанной секции), Sonnet тут overkill.
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemBlocks,
        messages: workingMessages,
        tools,
      });
      logClaudeUsage("dashboard-helper/tool-loop-haiku", response.usage, {
        biz: businessId,
        iter: iterations,
      });
      if (response.usage) trackClaudeUsage(businessId, response.usage);
    }

    const textBlocks = response.content.filter((b) => b.type === "text");
    const reply = textBlocks
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    if (!reply) {
      return NextResponse.json(
        { reply: "Извините, не смогла сформулировать ответ. Попробуйте переформулировать вопрос или посмотрите /docs напрямую." },
        { status: 200 }
      );
    }

    return NextResponse.json({ reply });
  } catch (e) {
    console.error(`[ai-helper] biz=${businessId} failed:`, e);
    return NextResponse.json(
      {
        reply:
          "Не получилось ответить — техническая ошибка. Попробуйте через минуту или посмотрите /docs напрямую.",
      },
      { status: 200 } // возвращаем 200 чтобы UI показал fallback-ответ, а не ошибку
    );
  }
}
