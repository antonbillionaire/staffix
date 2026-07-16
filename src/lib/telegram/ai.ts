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
import { pickRelevantDocuments, type DocDescriptor } from "@/lib/document-matcher";
import { pickMainModel } from "@/lib/complexity-classifier";
import type Anthropic from "@anthropic-ai/sdk";

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

    // 4. Lazy document matcher (июль 2026): выбирает нужные документы под запрос.
    //    Пул docs = businessContext.documents (уже с description/autoDescription).
    //    Матчер возвращает подмножество; в промпт идёт только оно.
    //    При ошибке / малом числе документов возвращает весь пул → поведение как раньше.
    const docPool: DocDescriptor[] = businessContext.documents.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      autoDescription: d.autoDescription,
      extractedText: d.extractedText,
    }));
    const pickedDocs = await pickRelevantDocuments(userMessage, docPool);
    if (pickedDocs.length !== docPool.length) {
      console.log(`[Webhook] doc matcher: ${docPool.length} → ${pickedDocs.length} for business=${businessId}`);
    }

    // 5. Строим системный промпт — обе функции возвращают
    //    { stable, docs, variable }: stable кэшируется на 1h, docs и variable на 5m.
    let systemPrompt: { stable: string; docs: string; variable: string };
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

      // Sales prompt получает уже отфильтрованный набор документов через матчер.
      const documentsForSales = pickedDocs.map((d) => ({ name: d.name, extractedText: d.extractedText }));

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
          documents: documentsForSales,
          faqs: businessContext.faqs,
          consultationsEnabled: businessContext.consultationsEnabled,
          services: businessContext.services,
          staff: businessContext.staff,
        },
        salesClientCtx
      );
    } else {
      // Service mode: buildSystemPrompt принимает docSubset — передаём выбранные.
      systemPrompt = buildSystemPrompt(businessContext, clientContext, pickedDocs.map((d) => ({
        id: d.id,
        name: d.name,
        extractedText: d.extractedText,
        description: d.description,
        autoDescription: d.autoDescription,
      })));
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
    // Порядок cache-блоков: stable(1h) → docs(5m) → variable(5m). Порядок важен
    // потому что каждый последующий cache_key = hash(всех предыдущих + этого).
    // stable первым — он самый стабильный. docs перед variable — их набор
    // меняется по темам (штук 5-10 у бизнеса), variable по клиентам (много).
    // Больше hit'ов если реже-меняющееся идёт раньше.
    const systemBlocks = [
      { type: "text" as const, text: systemPrompt.stable, cache_control: { type: "ephemeral" as const, ttl: "1h" as const } },
      ...(systemPrompt.docs.trim()
        ? [{ type: "text" as const, text: systemPrompt.docs, cache_control: { type: "ephemeral" as const, ttl: "5m" as const } }]
        : []),
      ...(variableTail.trim()
        ? [{ type: "text" as const, text: variableTail, cache_control: { type: "ephemeral" as const, ttl: "5m" as const } }]
        : []),
    ];

    // Hybrid routing: SIMPLE → Haiku 4.5, COMPLEX → Sonnet 5. Только для
    // бизнесов из AI_HYBRID_BUSINESS_IDS. Для остальных всегда Sonnet 5.
    const mainModel = await pickMainModel(businessId, userMessage);
    console.log(
      `[Webhook] Calling Claude API for business=${businessId}, salesMode=${salesMode}, stableLen=${systemPrompt.stable.length}, docsLen=${systemPrompt.docs.length}, variableLen=${variableTail.length}, model=${mainModel.model}, complexity=${mainModel.complexity}`
    );
    // thinking: disabled — на Sonnet 5 adaptive thinking по дефолту тратит
    // токены на цепочки рассуждений. Для клиент-чата это оверкилл; выключаем.
    // Для Haiku thinking не применяется (Sonnet/Opus-only feature).
    // max_tokens: 1024 — компенсируем 30%-inflated токенайзер Sonnet 5.
    const mainParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: mainModel.model,
      max_tokens: 1024,
      system: systemBlocks,
      messages: recentMessages,
      tools: activeTools,
    };
    if (mainModel.model === "claude-sonnet-5") {
      mainParams.thinking = { type: "disabled" };
    }
    let response = await callClaudeWithRetry(mainParams);
    logClaudeUsage(`tg/main/${mainModel.complexity}`, response.usage, { biz: businessId, tg: telegramId, sales: salesMode ? 1 : 0, model: mainModel.model });
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

    // 8. Финальный текстовый ответ.
    // Фильтруем NON-EMPTY text-блоки (Claude иногда шлёт `text: ""`).
    // Если ничего — recovery-вызов Sonnet без tools + explicit user-nudge.
    // Если и recovery пусто → buildFallbackFromToolResults → нейтральный фолбэк.
    const collectText = (r: Anthropic.Message): string => {
      const parts: string[] = [];
      for (const block of r.content) {
        if (block.type === "text" && block.text && block.text.trim()) {
          parts.push(block.text);
        }
      }
      return parts.join("\n\n").trim();
    };

    let assistantMessage = collectText(response);
    let assistantIsFallback = false;

    // Recovery: если пусто — форсируем текст ещё одним вызовом Sonnet без tools.
    // Защита от tool-loop, дошедшего до maxIterations, и от API-ошибок в цикле,
    // после которых response остаётся с только-tool_use блоками.
    if (!assistantMessage) {
      const reason =
        response.stop_reason === "tool_use"
          ? `tool_loop_exhausted (iterations=${iterations}/${maxIterations})`
          : `empty_text (stop=${response.stop_reason})`;
      console.warn(`[Webhook] EMPTY RESPONSE — recovery attempt. reason=${reason} biz=${businessId} tg=${telegramId}`);

      try {
        const recoveryMessages = [
          ...recentMessages,
          {
            role: "user" as const,
            content:
              "Пожалуйста, ответь клиенту простым текстом одним-двумя предложениями. " +
              "Не вызывай инструменты. Используй уже собранную информацию из контекста.",
          },
        ];
        const recovery = await callClaudeWithRetry({
          model: "claude-sonnet-5",
          max_tokens: 400,
          thinking: { type: "disabled" },
          system: systemBlocks,
          messages: recoveryMessages,
          // tools намеренно опущены — форсируем текст
        });
        logClaudeUsage("tg/recovery", recovery.usage, { biz: businessId, tg: telegramId, orig_reason: reason });
        assistantMessage = collectText(recovery);
        if (assistantMessage) {
          console.log(`[Webhook] RECOVERY succeeded: "${assistantMessage.slice(0, 80)}"`);
        }
      } catch (recoveryErr) {
        console.error(`[Webhook] RECOVERY failed:`, recoveryErr);
      }
    }

    // Второй эшелон: если recovery не помогла — пробуем собрать текст из tool_results
    // (например «Заказ 123 оформлен» из результата create_order).
    if (!assistantMessage && lastToolResults.length > 0) {
      console.log("[Webhook] No text after recovery, building from tool results");
      assistantMessage = buildFallbackFromToolResults(lastToolResults, salesMode);
    }

    // Финальный fallback — нейтральный, помечен isFallback чтоб не заражать историю
    if (!assistantMessage) {
      assistantMessage = "Секундочку, я уточню. Задайте, пожалуйста, вопрос по нашим услугам ещё раз.";
      assistantIsFallback = true;
      console.error(
        `[Webhook] FALLBACK reached — no text and no tool results. biz=${businessId} tg=${telegramId} stop=${response.stop_reason}`
      );
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

    // Смотрим ЛЮБОЙ сохранённый телефон клиента (не только когда пришёл в этом
    // turn'e) — нужно для hard-code guard ниже. Раньше проверяли только когда
    // extractedPhoneEarly !== null, из-за чего guard не мог решить перехватывать
    // ли обещание для клиентов у которых номер уже был в базе.
    let clientPhoneOnRecord: string | null = null;
    try {
      const existing = await prisma.client.findUnique({
        where: { businessId_telegramId: { businessId, telegramId } },
        select: { phone: true },
      });
      clientPhoneOnRecord = existing?.phone ?? null;
    } catch {
      // не критично
    }
    const clientHadPhoneBefore = !!clientPhoneOnRecord;
    const newContactProvided = !!extractedPhoneEarly && !clientHadPhoneBefore;
    const hasPhoneNowTg = !!(extractedPhoneEarly || clientPhoneOnRecord);
    const botPromisedTg = promisedForwardingRegex.test(assistantMessage);

    // ⚠️ HARD-CODE GUARD (июль 2026, AY 16 июля): промпт-правило может протечь.
    // Если бот пообещал «менеджер свяжется» БЕЗ телефона и не вызвал
    // notify_manager сам — ПЕРЕХВАТЫВАЕМ ответ. Клиент видит запрос номера,
    // эскалация не отправляется (менеджер отработает когда телефон реально
    // придёт через newContactProvided trigger).
    let promiseInterceptedTg = false;
    if (botPromisedTg && !calledNotifyManager && !hasPhoneNowTg) {
      console.warn(
        `[Webhook] HARD-CODE GUARD: prompt leaked promise without phone — intercepting. business=${businessId}`
      );
      assistantMessage =
        "Отлично! Чтобы менеджер мог с Вами связаться и всё подробно рассказать — " +
        "подскажите, пожалуйста, Ваш номер телефона и удобное время для звонка.";
      promiseInterceptedTg = true;
    }

    const shouldNotify = !calledNotifyManager && !promiseInterceptedTg && (
      promisedForwardingRegex.test(assistantMessage) || newContactProvided
    );

    if (shouldNotify) {
      const trigger = newContactProvided ? "new-contact" : "handoff-promise";

      // Телефон уже подтянули выше (clientPhoneOnRecord + hasPhoneNowTg).
      // После добавления HARD-CODE GUARD ветка handoff-promise без телефона
      // фактически не должна доходить сюда — guard перехватил бы. Оставляем
      // защитную логику ниже на случай race conditions.
      const existingClientPhone = clientPhoneOnRecord;
      const hasPhone = hasPhoneNowTg;
      const missingPhoneForHandoff = trigger === "handoff-promise" && !hasPhone;

      console.warn(
        `[Webhook] SAFETY NET: ${trigger} — invoking notify_manager. business=${businessId} hasPhone=${hasPhone} missingPhone=${missingPhoneForHandoff}`
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
        if (extractedPhoneEarly) {
          contextLines.push(`Телефон: ${extractedPhoneEarly}`);
        } else if (existingClientPhone) {
          contextLines.push(`Телефон (ранее): ${existingClientPhone}`);
        }

        let label: string;
        if (newContactProvided) {
          label = "[новый контакт от клиента]";
        } else if (missingPhoneForHandoff) {
          label =
            "⚠️ [БЕЗ ТЕЛЕФОНА] Бот пообещал что менеджер свяжется, но НЕ собрал номер клиента.\n" +
            "Ответьте клиенту в Telegram — запросите телефон, потом позвоните.";
        } else {
          label = "[авто-эскалация после обещания бота]";
        }
        const reason = `${label}\n${contextLines.join("\n")}`;

        const urgency = missingPhoneForHandoff ? "urgent" : "normal";
        await notifyManagerByTelegram(businessId, telegramId, reason, userName, urgency);
        console.log(`[Webhook] SAFETY NET: notify_manager fired (${trigger}) for business=${businessId}`);

        // Также создаём Task чтобы менеджер видел эту эскалацию в дашборде,
        // не только в TG-пуше. См. AY 16 июля 2026 — Right Flight: эскалаций
        // много в статистике, но в /dashboard задач мало потому что safety-net
        // раньше писал только Notification, не Task.
        const { createEscalationTask } = await import("@/lib/tasks");
        createEscalationTask({
          businessId,
          clientTelegramId: telegramId,
          clientChannel: "telegram",
          clientChannelId: telegramId.toString(),
          clientName: userName,
          reason,
          urgency,
        }).catch(() => {});
      } catch (e) {
        console.error("[Webhook] SAFETY NET notify_manager failed:", e);
      }
    }

    // 9. Сохраняем в БД. User-turn — всегда. Assistant-turn — только если это
    // РЕАЛЬНЫЙ ответ бота, а не финальный fallback («уточню детали»). Иначе
    // Claude при следующем turn'e увидит fallback в истории и начнёт его копировать
    // как валидный шаблон ответа — заражает диалог.
    await saveMessage(conversation.id, "user", userMessage);
    if (!assistantIsFallback) {
      await saveMessage(conversation.id, "assistant", assistantMessage);
    } else {
      console.warn(`[Webhook] FALLBACK — not saving assistant reply to history. conv=${conversation.id}`);
    }

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
