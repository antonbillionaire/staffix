/**
 * generateAIResponse — основной AI-цикл для Telegram бота:
 *  1. Загружает business + client context из ai-memory
 *  2. Определяет режим (sales/service) и собирает system prompt
 *  3. Подгружает историю диалога (через getOrCreateConversation)
 *  4. Вызывает Claude с tools, итерируется до 5 раз пока stop_reason=tool_use
 *  5. Финальный текст возвращает + извлечённые imageUrls (фото товаров)
 *
 * Важные guardrails:
 *  - Если Claude вернул только tool_use без текста — собираем ответ из tool_results
 *    (buildFallbackFromToolResults). Защита от пустых сообщений клиенту.
 *  - SAFETY NET для notify_manager: если бот написал «передал менеджеру» в тексте,
 *    но tool не вызвал — сами зовём notify_manager. Защита от галлюцинаций.
 *  - Если база знаний обновилась И диалог активный — добавляем soft warning в
 *    промпт, чтобы факты брались из FAQ/услуг, а не из истории/saммари.
 */

import { callClaudeWithRetry, logClaudeUsage } from "@/lib/claude-retry";
import { prisma } from "@/lib/prisma";
import {
  buildClientContext,
  buildBusinessContext,
  buildSystemPrompt,
  updateClientAfterMessage,
  updateConversationMessageCount,
  extractClientName,
  extractPhone,
} from "@/lib/ai-memory";
import { bookingToolDefinitions } from "@/lib/booking-tools";
import { salesToolDefinitions, executeSalesTool, notifyManagerByTelegram } from "@/lib/sales-tools";
import { buildSalesSystemPrompt, isSalesMode } from "@/lib/sales-prompt";
import { botPromisedHandoffRegex } from "@/lib/handoff-detector";
import {
  loadRoutableStaff,
  buildRouteToSpecialistTool,
  buildRoutingPromptSection,
} from "@/lib/ai-routing";
import { getOrCreateConversation, saveMessage } from "./conversation";
import { handleToolCall, buildFallbackFromToolResults } from "./tools";

export interface AIResponseWithMedia {
  text: string;
  imageUrls: string[];
}

export async function generateAIResponse(
  businessId: string,
  telegramId: bigint,
  userMessage: string,
  userName: string,
  telegramUsername?: string | null
): Promise<AIResponseWithMedia> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("[Webhook] ANTHROPIC_API_KEY is not set!");
    return { text: "Извините, сервис временно недоступен. Попробуйте позже.", imageUrls: [] };
  }

  try {
    // 1. Загружаем контекст бизнеса
    console.log(`[Webhook] Building business context for ${businessId}...`);
    const businessContext = await buildBusinessContext(businessId);
    if (!businessContext) {
      console.error(`[Webhook] buildBusinessContext returned null for ${businessId}`);
      return { text: "Извините, произошла ошибка. Попробуйте позже.", imageUrls: [] };
    }
    console.log(`[Webhook] Business context loaded: ${businessContext.name}`);

    // 2. Загружаем контекст клиента (AI Memory!)
    console.log(`[Webhook] Building client context for telegramId=${telegramId}...`);
    const clientContext = await buildClientContext(businessId, telegramId);
    console.log(`[Webhook] Client context: ${clientContext ? "loaded" : "null (new client)"}`);

    // 3. Определяем режим бота: продажи или запись
    const salesMode = isSalesMode(businessContext.businessType, businessContext.dashboardMode);
    console.log(`[Webhook] Mode: ${salesMode ? "sales" : "service"}, type=${businessContext.businessType}`);

    // 4. Строим системный промпт — обе функции теперь возвращают
    // { stable, variable } для split-кэширования (1h на префикс, 5m на хвост).
    let systemPrompt: { stable: string; variable: string };
    if (salesMode) {
      const salesClientCtx = clientContext
        ? {
            name: clientContext.name,
            totalOrders: clientContext.totalVisits, // используем totalVisits как счётчик заказов
            lastOrderDate: clientContext.lastVisitDate,
            tags: clientContext.tags,
            importantNotes: clientContext.importantNotes,
          }
        : null;

      const { getAvailableCategories } = await import("@/lib/sales-tools");
      const categories = await getAvailableCategories(businessId);
      const totalProducts = await prisma.product.count({ where: { businessId, isActive: true } });
      const documents = await prisma.document.findMany({
        where: { businessId, parsed: true },
        select: { name: true, extractedText: true },
      });

      systemPrompt = buildSalesSystemPrompt(
        {
          name: businessContext.name,
          businessType: businessContext.businessType,
          phone: businessContext.phone,
          address: businessContext.address,
          workingHours: businessContext.workingHours,
          welcomeMessage: businessContext.welcomeMessage,
          aiTone: businessContext.aiTone,
          aiRules: businessContext.aiRules,
          language: businessContext.language || "ru",
          categories,
          totalProducts,
          documents,
          faqs: businessContext.faqs,
          consultationsEnabled: businessContext.consultationsEnabled,
          services: businessContext.services,
          staff: businessContext.staff,
        },
        salesClientCtx
      );
    } else {
      systemPrompt = buildSystemPrompt(businessContext, clientContext);
    }

    // 5. Получаем историю разговора
    const conversation = await getOrCreateConversation(businessId, telegramId, userName);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentMessages: any[] = [
      ...conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ].slice(-20);

    // 6. Tools — sales mode + consultations включены = ОБА набора
    // (онлайн-школы / консалтинг принимают и заказы, и записи на консультации).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let activeTools: any[] = salesMode
      ? businessContext.consultationsEnabled
        ? [...salesToolDefinitions, ...bookingToolDefinitions]
        : salesToolDefinitions
      : bookingToolDefinitions;

    // 6.5 AI smart routing — добавляем route_to_specialist tool ТОЛЬКО если
    // у бизнеса включён режим ai_smart И есть staff с routingDescription.
    // Иначе всё работает как раньше (ничего не ломаем).
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { leadAssignmentMode: true },
    });
    let routingPromptSection = "";
    if (business?.leadAssignmentMode === "ai_smart") {
      const routableStaff = await loadRoutableStaff(businessId);
      const routingTool = buildRouteToSpecialistTool(routableStaff);
      if (routingTool) {
        activeTools = [...activeTools, routingTool];
        routingPromptSection = buildRoutingPromptSection(routableStaff);
        console.log(
          `[Webhook] AI smart routing enabled: ${routableStaff.length} routable staff for business=${businessId}`
        );
      }
    }

    const today = new Date().toISOString().split("T")[0];
    const systemHint = salesMode
      ? `\n\nСегодня: ${today}. Используй инструменты для поиска товаров и оформления заказов.`
      : `\n\nСегодняшняя дата: ${today}. Используй инструменты для работы с записями.`;

    // База знаний только что обновилась + диалог активный → анти-якорь:
    // запрещаем боту брать факты из своей истории, source-of-truth = промпт.
    const refreshNotice = conversation.contextRefreshSoftWarning
      ? `\n\n⚠️ ВНИМАНИЕ — БАЗА ЗНАНИЙ ОБНОВЛЕНА (правило приоритета фактов)
База знаний этого бизнеса (FAQ / услуги / товары / документы) только что была изменена владельцем. Это перебивает любую информацию, которую ты помнишь о ценах, датах, услугах или остатках товаров.

ИСТОЧНИК ИСТИНЫ для фактов о бизнесе — ТОЛЬКО разделы текущего системного промпта выше:
- "Услуги"/"Каталог товаров"
- "Частые вопросы (FAQ)"
- "Дополнительная информация из документов"

НЕ ИСТОЧНИК фактов (могут содержать устаревшие данные):
- Твои собственные предыдущие ответы в этом диалоге
- Раздел "Резюме предыдущего разговора" / "Что мы обсуждали ранее"
- AI-summary клиента ("этот клиент спрашивал про X")
- Любые упоминания конкретных цен/дат/услуг из памяти

Как применять:
- Если клиент спрашивает "появились ли новые даты?", "сколько сейчас стоит?", "а есть ещё варианты?" — отвечай ТОЛЬКО по разделам FAQ/услуги/документы из промпта. Не по тому, что ты говорил раньше.
- Если ты раньше сказал "одна дата 08.06" а в FAQ теперь три даты — называй ВСЕ ТРИ. Не извиняйся, не упоминай старый ответ — просто дай актуальную информацию.
- Если в саммари написано "клиент спрашивал про X, я ответил Y" — используй это только чтобы понять КОНТЕКСТ запроса, но цифры/факты бери из FAQ заново.
- Контекст разговора (имя, предпочтения, что обсуждали в общем) — сохраняй. Конкретные факты — переспрашивай у промпта.`
      : "";
    // Все «дрейфующие» куски (дата, refreshNotice, routing) пакуем в
    // переменный хвост, рядом с клиентским контекстом. Стабильный префикс
    // остаётся неизменным от вызова к вызову — Anthropic держит его в кэше.
    const variableTail = systemPrompt.variable + systemHint + refreshNotice + routingPromptSection;
    const systemBlocks = [
      { type: "text" as const, text: systemPrompt.stable, cache_control: { type: "ephemeral" as const, ttl: "1h" as const } },
      ...(variableTail.trim()
        ? [{ type: "text" as const, text: variableTail, cache_control: { type: "ephemeral" as const, ttl: "5m" as const } }]
        : []),
    ];

    console.log(`[Webhook] Calling Claude API for business=${businessId}, salesMode=${salesMode}, stableLen=${systemPrompt.stable.length}, variableLen=${variableTail.length}`);
    let response = await callClaudeWithRetry({
      model: "claude-sonnet-4-5-20250929",
      // 500 ≈ ~375 chars output — enough for the 1–3 sentence default in
      // ai-memory.ts buildSystemPrompt. Tool-loop turns still get the same
      // cap, which keeps verbose multi-step replies bounded too. If a
      // specific business needs longer replies it goes via aiRules
      // override at the top of the prompt, not a global cap.
      max_tokens: 800,
      system: systemBlocks,
      messages: recentMessages,
      tools: activeTools,
    });
    logClaudeUsage("tg/main", response.usage, { biz: businessId, tg: telegramId, sales: salesMode ? 1 : 0 });
    console.log(`[Webhook] Claude response: stop_reason=${response.stop_reason}`);

    // 7. Цикл tool_use (до 5 итераций)
    let iterations = 0;
    const maxIterations = 5;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastToolResults: any[] = [];
    // Все tool-names вызванные за оборот — для safety-net проверки notify_manager
    const calledToolNames: string[] = [];

    while (response.stop_reason === "tool_use" && iterations < maxIterations) {
      iterations++;

      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
      for (const b of toolUseBlocks) {
        if (b.type === "tool_use") calledToolNames.push(b.name);
      }

      recentMessages.push({
        role: "assistant",
        content: response.content,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolResults: any[] = [];

      for (const block of toolUseBlocks) {
        if (block.type === "tool_use") {
          const inputPreview = (() => {
            try {
              return JSON.stringify(block.input).slice(0, 200);
            } catch {
              return "(unstringifiable)";
            }
          })();
          console.log(
            `[Webhook] Tool call: ${block.name} mode=${salesMode ? "sales" : "service"} input=${inputPreview}`
          );

          // Роутим к нужному диспетчеру по имени, не по режиму:
          // в sales+consultations возможны и sales, и booking tools в одном диалоге.
          const SALES_TOOL_NAMES = new Set([
            "search_products",
            "get_product_details",
            "get_categories",
            "list_by_category",
            "identify_client",
            "create_order",
            "get_client_orders",
            "get_upsell_suggestions",
          ]);
          const isSalesTool = SALES_TOOL_NAMES.has(block.name);
          const result = isSalesTool
            ? await executeSalesTool(
                block.name,
                block.input as Record<string, unknown>,
                businessId,
                telegramId
              )
            : await handleToolCall(
                block.name,
                block.input as Record<string, string>,
                businessId,
                telegramId
              );

          const resultPreview = typeof result === "string" ? result.slice(0, 200) : "(non-string)";
          console.log(`[Webhook] Tool result: ${block.name} -> ${resultPreview}`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      lastToolResults = toolResults;

      recentMessages.push({
        role: "user",
        content: toolResults,
      });

      // ЭКСПЕРИМЕНТ (июль 2026): tool-loop итерации на Haiku 4.5 вместо Sonnet.
      // См. подробный комментарий в channel-ai.ts — Haiku в 3× дешевле, справляется
      // с промежуточной работой (интерпретация результатов инструментов) на 90%+,
      // главный ответ клиенту остаётся на Sonnet.
      try {
        response = await callClaudeWithRetry({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system: systemBlocks,
          messages: recentMessages,
          tools: activeTools,
        });
        logClaudeUsage("tg/tool-loop-haiku", response.usage, { biz: businessId, tg: telegramId, iter: iterations + 1 });
      } catch (apiError) {
        // Если API упал ПОСЛЕ успешного tool — собираем ответ из результатов
        console.error("[Webhook] API error after tool execution:", apiError);
        return { text: buildFallbackFromToolResults(lastToolResults, salesMode), imageUrls: [] };
      }
    }

    // 8. Финальный текстовый ответ
    const textBlocks = response.content.filter((block) => block.type === "text");
    let assistantMessage: string;
    if (textBlocks.length > 0 && textBlocks[0].type === "text") {
      assistantMessage = textBlocks[0].text;
    } else if (lastToolResults.length > 0) {
      console.log("[Webhook] No text blocks in response, building from tool results");
      assistantMessage = buildFallbackFromToolResults(lastToolResults, salesMode);
    } else {
      assistantMessage = "Чем ещё могу помочь?";
    }

    // 8.5 SAFETY NET: если бот в этом обороте обещал «передал менеджеру» ИЛИ
    // клиент только что прислал новый телефон — гарантированно уведомляем владельца.
    //
    // Два триггера, любой достаточен:
    //  1) Regex по тексту бота — покрывает "передам менеджеру" / "свяжемся" и т.п.
    //  2) В сообщении клиента впервые появился телефон, которого раньше не было в
    //     Client.phone. Ловит кейс Right Flight (июль 2026): Turn 1 — бот просит номер
    //     (regex fires); Turn 2 — клиент шлёт "+998...", бот отвечает "спасибо" (regex
    //     не срабатывает). Раньше молча писали телефон в Client.phone, владелец о нём
    //     не знал. Теперь второй заход тоже уведомит — с телефоном И контекстом переписки.
    const promisedForwardingRegex = botPromisedHandoffRegex();
    const calledNotifyManager = calledToolNames.includes("notify_manager");
    const extractedPhoneEarly = extractPhone(userMessage);

    // Был ли у клиента телефон ДО этого сообщения — отличаем "только что дал контакт"
    // от "давно у нас в базе с телефоном" чтобы не спамить владельца.
    let clientHadPhoneBefore = false;
    if (extractedPhoneEarly) {
      const existing = await prisma.client.findUnique({
        where: { businessId_telegramId: { businessId, telegramId } },
        select: { phone: true },
      });
      clientHadPhoneBefore = !!existing?.phone;
    }
    const newContactProvided = !!extractedPhoneEarly && !clientHadPhoneBefore;

    const shouldNotify = !calledNotifyManager && (
      promisedForwardingRegex.test(assistantMessage) || newContactProvided
    );

    if (shouldNotify) {
      const trigger = newContactProvided ? "new-contact" : "handoff-promise";
      console.warn(
        `[Webhook] SAFETY NET: ${trigger} — invoking notify_manager. business=${businessId}`
      );
      try {
        // Контекст: предыдущее сообщение бота + текущее клиента + телефон.
        // Без контекста владелец видит просто "+998901234567" и не понимает зачем.
        const prevAssistantTurn = conversation.messages
          .filter((m) => m.role === "assistant")
          .slice(-1)[0]?.content?.slice(0, 300);

        const contextLines: string[] = [];
        if (prevAssistantTurn) contextLines.push(`Бот ранее: ${prevAssistantTurn}`);
        contextLines.push(`Клиент: ${userMessage.slice(0, 400)}`);
        if (extractedPhoneEarly) contextLines.push(`Телефон: ${extractedPhoneEarly}`);

        const label = newContactProvided
          ? "[новый контакт от клиента]"
          : "[авто-эскалация после обещания бота]";
        const reason = `${label}\n${contextLines.join("\n")}`;

        await notifyManagerByTelegram(businessId, telegramId, reason, userName, "normal");
        console.log(`[Webhook] SAFETY NET: notify_manager fired (${trigger}) for business=${businessId}`);
      } catch (e) {
        console.error("[Webhook] SAFETY NET notify_manager failed:", e);
      }
    }

    // 9. Сохраняем в БД
    await saveMessage(conversation.id, "user", userMessage);
    await saveMessage(conversation.id, "assistant", assistantMessage);

    // 10. Счётчик сообщений в разговоре
    await updateConversationMessageCount(conversation.id);

    // 11. Извлекаем имя/телефон из текста и обновляем клиента
    const extractedName = extractClientName(userMessage);
    const extractedPhone = extractPhone(userMessage);

    await updateClientAfterMessage(businessId, telegramId, extractedName || userName, telegramUsername);

    if (extractedPhone) {
      await prisma.client.update({
        where: {
          businessId_telegramId: {
            businessId,
            telegramId,
          },
        },
        data: { phone: extractedPhone },
      });
    }

    // imageUrls из tool-результатов (фото товаров)
    const imageUrls: string[] = [];
    for (const tr of lastToolResults) {
      try {
        const content = typeof tr.content === "string" ? JSON.parse(tr.content) : tr.content;
        if (content?.products) {
          for (const p of content.products) {
            if (p.imageUrl) imageUrls.push(p.imageUrl);
          }
        }
        if (content?.product?.imageUrl) {
          imageUrls.push(content.product.imageUrl);
        }
      } catch {
        /* not JSON, skip */
      }
    }

    return { text: assistantMessage, imageUrls };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : "";
    console.error(`[Webhook] generateAIResponse FAILED: ${errMsg}\n${errStack}`);

    if (errMsg.includes("overloaded") || errMsg.includes("529")) {
      return {
        text: "Извините, сервер AI временно перегружен. Пожалуйста, попробуйте через 1-2 минуты.",
        imageUrls: [],
      };
    }

    return {
      text: "Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.",
      imageUrls: [],
    };
  }
}
