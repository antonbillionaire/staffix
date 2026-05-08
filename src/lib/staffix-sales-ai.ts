/**
 * Staffix Sales AI — консультирует потенциальных клиентов о продукте Staffix
 * через WhatsApp, Instagram, Facebook Messenger и Telegram.
 * Хранит историю в модели SalesLead.
 * Поддерживает tools: schedule_demo, notify_owner, update_lead_stage.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getSalesSystemPrompt } from "@/lib/sales-bot/system-prompt";
import { getInstagramUserProfile } from "@/lib/sales-bot/meta-api";
import { notifyAdmin } from "@/lib/admin-notify";
import { ONBOARDING_STEPS, formatOnboardingContextForVictor, getOnboardingStep } from "@/lib/onboarding-steps";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type HistoryMessage = { role: "user" | "assistant"; content: string };

// ========================================
// TOOL DEFINITIONS
// ========================================

const salesBotTools: Anthropic.Tool[] = [
  {
    name: "schedule_demo",
    description:
      "Сохранить контакты лида в систему. Используй ТОЛЬКО как крайний случай — если лид трижды настоял на личной встрече с человеком после твоих попыток закрыть его в чате. В стандартном сценарии — НЕ ИСПОЛЬЗУЙ этот tool: твоя цель довести лида до регистрации на staffix.io прямо в этом разговоре. Если используешь — НЕ обещай когда конкретно состоится встреча или звонок.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_name: {
          type: "string",
          description: "Имя контактного лица",
        },
        contact_phone: {
          type: "string",
          description: "Телефон или WhatsApp для связи",
        },
        contact_telegram: {
          type: "string",
          description: "Telegram username или ссылка (если есть)",
        },
        business_name: {
          type: "string",
          description: "Название бизнеса",
        },
        business_type: {
          type: "string",
          description: "Тип бизнеса: salon, barbershop, dental, clinic, fitness, spa, language_school, other",
        },
        business_address: {
          type: "string",
          description: "Адрес бизнеса (куда приехать)",
        },
        preferred_date: {
          type: "string",
          description: "Желаемая дата и время в формате YYYY-MM-DD HH:mm",
        },
        notes: {
          type: "string",
          description: "Дополнительные заметки о лиде (интересующие функции, боли, размер бизнеса)",
        },
      },
      required: ["contact_name", "preferred_date"],
    },
  },
  {
    name: "notify_owner",
    description:
      "Тихое внутреннее уведомление команды Staffix о КРИТИЧЕСКОЙ технической проблеме которую ты не можешь обработать. Используй ТОЛЬКО для: техническая поломка которую невозможно объяснить лиду, юридический вопрос требующий человека, жалоба на конкретного клиента/партнёра, угрозы. НЕ ИСПОЛЬЗУЙ для: «лид хочет поговорить» (отвечаешь сам), «лид стал горячим» (используй update_lead_stage), «лид готов к встрече» (закрывай в чате на регистрацию). Обычные продажи — без этого tool.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "Текст уведомления для Антона",
        },
        priority: {
          type: "string",
          enum: ["high", "normal"],
          description: "high = горячий лид или срочное, normal = информационное",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "update_lead_stage",
    description:
      "Обновить статус лида в воронке. Используй когда статус лида изменился.",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: {
          type: "string",
          enum: ["interested", "warm", "hot", "demo_requested", "trial_started", "converted", "lost"],
          description: "Новый статус лида",
        },
        reason: {
          type: "string",
          description: "Причина изменения статуса",
        },
      },
      required: ["stage"],
    },
  },
  {
    name: "update_onboarding_step",
    description:
      "Зафиксировать шаг настройки Staffix на котором сейчас находится лид. ОБЯЗАТЕЛЬНО вызывай каждый раз когда лид подтверждает что выполнил очередной шаг (зарегистрировался, заполнил профиль, подключил TG-бота и т.д.). Это сохраняет состояние между сессиями — даже если лид пропадёт на 1-2 дня, ты вернёшься к разговору и продолжишь с правильного места.",
    input_schema: {
      type: "object" as const,
      properties: {
        step: {
          type: "integer",
          description:
            "Номер шага. 0=ещё не начал, 1=зарегистрировался на staffix.io, 2=заполнил профиль бизнеса, 3=подключил Telegram-бота, 4=подключил доп. каналы (WA/IG/FB), 5=добавил команду, 6=наполнил каталог (услуги/товары), 7=загрузил базу знаний, 8=настроил AI (тон/приветствие), 9=включил автоматизации, 10=протестировал, 11=запущено в реальных условиях",
          minimum: 0,
          maximum: 11,
        },
        notes: {
          type: "string",
          description:
            "Опциональные заметки о текущем контексте — что важно помнить когда лид вернётся. Например: 'email подсказан, ждёт что Антон поможет с Staff завтра' или 'застрял на BotFather, объяснил пошагово'.",
        },
      },
      required: ["step"],
    },
  },
  {
    name: "get_sales_facts",
    description:
      "Получить точный фактический ответ из базы знаний Staffix. Используй ВСЕГДА когда клиент " +
      "спрашивает про конкретный тариф, шаги настройки, конкурентов, фичу. Это твой источник " +
      "истины — не отвечай по памяти про цифры/тарифы/функции, чтобы не выдумать. " +
      "Доступные темы: pricing, onboarding-steps, competitor-yclients, competitor-altegio, " +
      "competitor-dikidi, competitor-custom-development, feature-multichannel, feature-ai-search, " +
      "feature-loyalty, feature-knowledge-base, what-staffix-doesnt-do. " +
      "Можно передать и свободный запрос клиента — система найдёт релевантный.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description:
            "ID темы или ключевые слова из вопроса клиента (например 'тарифы', 'yclients', 'программа лояльности').",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "calculate_roi",
    description:
      "Посчитать ROI для конкретного клиента из его цифр. Используй когда выяснил у клиента " +
      "средний чек и сколько клиентов он теряет в месяц. Возвращает структурированный расчёт.",
    input_schema: {
      type: "object" as const,
      properties: {
        avg_check: {
          type: "number",
          description: "Средний чек клиента в указанной валюте",
        },
        lost_clients_per_month: {
          type: "number",
          description: "Сколько клиентов клиент теряет в месяц из-за медленных ответов",
        },
        plan_price_usd: {
          type: "number",
          description: "Цена рекомендуемого тарифа в USD (по умолчанию 45 для Pro)",
        },
        currency: {
          type: "string",
          description: "USD | UZS | RUB | KZT — для красивого форматирования. По умолчанию USD.",
        },
      },
      required: ["avg_check", "lost_clients_per_month"],
    },
  },
];

// ========================================
// TOOL EXECUTION
// ========================================

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  leadId: string,
  channel: string,
  channelId: string
): Promise<string> {
  switch (toolName) {
    case "schedule_demo": {
      const scheduledAt = new Date(toolInput.preferred_date as string);
      if (isNaN(scheduledAt.getTime())) {
        return JSON.stringify({ success: false, error: "Invalid date format. Use YYYY-MM-DD HH:mm" });
      }

      const booking = await prisma.demoBooking.create({
        data: {
          salesLeadId: leadId,
          contactName: (toolInput.contact_name as string) || "Unknown",
          contactPhone: (toolInput.contact_phone as string) || null,
          contactTelegram: (toolInput.contact_telegram as string) || null,
          contactWhatsapp: (toolInput.contact_phone as string) || null,
          businessName: (toolInput.business_name as string) || null,
          businessType: (toolInput.business_type as string) || null,
          businessAddress: (toolInput.business_address as string) || null,
          scheduledAt,
          notes: (toolInput.notes as string) || null,
        },
      });

      // Update lead stage
      await prisma.salesLead.update({
        where: { id: leadId },
        data: { stage: "demo_requested" },
      });

      // Notify Anton
      const dateStr = scheduledAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
      const timeStr = scheduledAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      const emoji = (toolInput.priority === "high") ? "🔥" : "📅";

      await notifyAdmin(
        `${emoji} <b>НОВАЯ ЗАПИСЬ НА ДЕМО</b>\n\n` +
        `👤 ${toolInput.contact_name}\n` +
        `📞 ${toolInput.contact_phone || "не указан"}\n` +
        `💬 TG: ${toolInput.contact_telegram || "нет"}\n` +
        `🏢 ${toolInput.business_name || "не указано"} (${toolInput.business_type || "?"})\n` +
        `📍 ${toolInput.business_address || "адрес не указан"}\n` +
        `📅 ${dateStr}, ${timeStr}\n` +
        `📝 ${toolInput.notes || "—"}\n` +
        `\n🔗 Канал: ${channel} | ID: ${channelId}`
      );

      return JSON.stringify({
        success: true,
        booking_id: booking.id,
        scheduled_at: scheduledAt.toISOString(),
        message: `Контакты сохранены. НЕ обещай клиенту конкретное время встречи или звонка — скажи что кейс взяли в работу и пусть пока попробует Staffix сам на staffix.io (14 дней бесплатно).`,
      });
    }

    case "notify_owner": {
      const priority = toolInput.priority === "high" ? "🔥" : "ℹ️";
      await notifyAdmin(
        `${priority} <b>Sales Bot — внутреннее уведомление</b>\n\n` +
        `${toolInput.message}\n` +
        `\n🔗 Канал: ${channel} | Lead ID: ${leadId}`
      );
      // Возвращаем нейтральный ответ — клиент не должен видеть «Антон уведомлён».
      // Виктор продолжает диалог сам, без обещания «свяжется человек».
      return JSON.stringify({ success: true, message: "Сохранено внутри системы. Продолжай диалог с клиентом сам." });
    }

    case "update_lead_stage": {
      const newStage = toolInput.stage as string;
      await prisma.salesLead.update({
        where: { id: leadId },
        data: {
          stage: newStage,
          notes: toolInput.reason ? `[${new Date().toISOString().slice(0, 10)}] ${toolInput.reason}` : undefined,
        },
      });

      // Auto-notify for hot leads
      if (newStage === "hot") {
        await notifyAdmin(
          `🔥 <b>HOT LEAD</b>\n\n` +
          `Канал: ${channel} | Lead ID: ${leadId}\n` +
          `Причина: ${toolInput.reason || "квалифицирован как горячий"}`
        );
      }

      return JSON.stringify({ success: true, stage: newStage });
    }

    case "update_onboarding_step": {
      const stepNum = Number(toolInput.step);
      if (!Number.isInteger(stepNum) || stepNum < 0 || stepNum > 11) {
        return JSON.stringify({ success: false, error: "step must be integer 0-11" });
      }
      const stepInfo = getOnboardingStep(stepNum);
      const notes = typeof toolInput.notes === "string" ? toolInput.notes.slice(0, 500) : null;

      await prisma.salesLead.update({
        where: { id: leadId },
        data: {
          onboardingStep: stepNum,
          onboardingNotes: notes,
        },
      });

      console.log(`[Victor] onboardingStep updated for lead ${leadId}: step=${stepNum} (${stepInfo?.key}) notes="${notes?.slice(0, 80) || ""}"`);

      return JSON.stringify({
        success: true,
        step: stepNum,
        step_key: stepInfo?.key,
        next_step_hint: stepInfo
          ? ONBOARDING_STEPS.find((s) => s.num === stepNum + 1)?.title || "Все шаги пройдены"
          : null,
      });
    }

    case "get_sales_facts": {
      const { findSalesFact, listSalesTopicIds } = await import("./sales-knowledge");
      const query = String(toolInput.topic || "").trim();
      const result = findSalesFact(query);
      if (result) {
        return JSON.stringify({
          found: true,
          topicId: result.topicId,
          content: result.content,
        });
      }
      return JSON.stringify({
        found: false,
        message: `Тема "${query}" не найдена. Доступные: ${listSalesTopicIds().join(", ")}. Если ответа нет в базе — эскалируй или скажи "уточню у команды".`,
      });
    }

    case "calculate_roi": {
      const { calculateRoi } = await import("./sales-knowledge");
      const avgCheck = Number(toolInput.avg_check) || 0;
      const lostClients = Number(toolInput.lost_clients_per_month) || 0;
      const planUsd = Number(toolInput.plan_price_usd) || 45;
      const currency = ((toolInput.currency as string) || "USD").toUpperCase() as
        | "USD" | "UZS" | "RUB" | "KZT";
      if (avgCheck <= 0 || lostClients <= 0) {
        return JSON.stringify({
          success: false,
          error: "Нужны положительные avg_check и lost_clients_per_month",
        });
      }
      const roi = calculateRoi(avgCheck, lostClients, planUsd, currency);
      return JSON.stringify({ success: true, ...roi });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ========================================
// SAFETY-NET: politeness post-processor
// ========================================

/**
 * Виктор иногда забывает правила и здоровается на «Привет!» или переходит на «ты».
 * Промпт это запрещает, но Claude не всегда следует промпту 100%. Защищаемся в коде.
 *
 * Стратегия:
 *   1. «Привет/Приветствую» в начале сообщения → меняем на «Здравствуйте» (безопасная замена).
 *   2. «ты/тебя/твой/etc.» → перегенерируем ответ с явной инструкцией. Замена напрямую сломала
 *      бы глаголы (ты делаешь → Вы делаешь? нужно «делаете»).
 */

const FORBIDDEN_TY_REGEX = /\b(ты|тебя|тебе|тобой|твой|твоя|твоё|твои|твоих|твоего|твоему|твоей|твоих|твоим|твоими)\b/i;

function detectFamiliarAddress(text: string): boolean {
  return FORBIDDEN_TY_REGEX.test(text);
}

function fixGreeting(text: string): { fixed: string; changed: boolean } {
  // «Привет!»/«Привет,»/«Привет» в начале (с возможным эмодзи перед) → «Здравствуйте»
  const original = text;
  const fixed = text
    .replace(/^(\s*[\p{Emoji}\s]*)Приветствую([!,.])/u, "$1Здравствуйте$2")
    .replace(/^(\s*[\p{Emoji}\s]*)Привет([!,.])/u, "$1Здравствуйте$2")
    .replace(/^(\s*[\p{Emoji}\s]*)Хай([!,.])/u, "$1Здравствуйте$2");
  return { fixed, changed: fixed !== original };
}

async function regeneratePoliteResponse(
  systemPrompt: string,
  allMessages: Anthropic.MessageParam[],
  rudeText: string
): Promise<string> {
  const correctionMessage: Anthropic.MessageParam = {
    role: "user",
    content:
      `[Системная коррекция] В твоём предыдущем ответе ты использовал обращение на "ты" — это нарушение правила вежливости. ` +
      `Правило: ВСЕГДА на "Вы". Перепиши свой последний ответ полностью на "Вы", сохраняя смысл. ` +
      `Не извиняйся, не объясняй коррекцию — просто выдай переписанный ответ.\n\n` +
      `Твой предыдущий текст:\n"""${rudeText}"""`,
  };

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...allMessages, correctionMessage],
    tools: salesBotTools,
  });

  const newText = response.content.find((b) => b.type === "text")?.text;
  return newText || rudeText;
}

// ========================================
// LEAD MANAGEMENT
// ========================================

async function getOrCreateLead(
  channel: string,
  channelId: string,
  name?: string,
  phone?: string
) {
  // Telegram uses BigInt telegramChatId
  if (channel === "telegram") {
    let lead = await prisma.salesLead.findUnique({
      where: { telegramChatId: BigInt(channelId) },
    });
    if (!lead) {
      lead = await prisma.salesLead.create({
        data: {
          channel: "telegram",
          telegramChatId: BigInt(channelId),
          name: name || null,
          phone: phone || null,
          stage: "new",
          history: [],
        },
      });
    }
    return lead;
  }

  const channelField =
    channel === "whatsapp" ? "whatsappPhone" :
    channel === "facebook" ? "fbPsid" :
    channel === "instagram" || channel === "instagram_comment" ? "instagramId" :
    null;

  let lead = channelField
    ? await prisma.salesLead.findFirst({ where: { [channelField]: channelId } })
    : null;

  // For Instagram, fetch profile name from Graph API if not provided
  let resolvedName = name || null;
  const isInstagram = channel === "instagram" || channel === "instagram_comment";
  if (isInstagram && !resolvedName) {
    try {
      const profile = await getInstagramUserProfile(channelId);
      if (profile) {
        resolvedName = profile.name || (profile.username ? `@${profile.username}` : null);
      }
    } catch {
      // Ignore profile fetch errors — lead still gets created, just without name
    }
  }

  if (!lead) {
    lead = await prisma.salesLead.create({
      data: {
        channel: channel.replace("_comment", ""),
        ...(channelField ? { [channelField]: channelId } : {}),
        name: resolvedName,
        phone: phone || null,
        stage: "new",
        history: [],
      },
    });
  } else if (isInstagram && !lead.name && resolvedName) {
    // Backfill missing name on existing IG lead
    lead = await prisma.salesLead.update({
      where: { id: lead.id },
      data: { name: resolvedName },
    });
  }

  return lead;
}

// ========================================
// MAIN RESPONSE GENERATOR
// ========================================

export async function generateStaffixSalesResponse(
  channel: string,
  channelId: string,
  userMessage: string,
  clientName?: string,
  clientPhone?: string
): Promise<string> {
  try {
    const lead = await getOrCreateLead(channel, channelId, clientName, clientPhone);
    const history = (lead.history as HistoryMessage[]) || [];
    const recentHistory = history.slice(-20);

    const messages: Anthropic.MessageParam[] = [
      ...recentHistory,
      { role: "user", content: userMessage },
    ];

    // Текущая дата — критично для Виктора, иначе он выдумывает ("записываю на 15 мая" когда сегодня 3 мая).
    // Tashkent — основной рынок, Антон работает в этой таймзоне.
    const todayStr = new Date().toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Tashkent",
    });

    const onboardingContext = formatOnboardingContextForVictor(
      lead.onboardingStep,
      lead.onboardingNotes
    );

    const messageCount = recentHistory.length;
    const tempLeadStage =
      messageCount === 0 ? "первое сообщение, холодный лид" :
      messageCount < 4 ? "ранний контакт, квалифицируется" :
      messageCount < 10 ? "идёт диалог" :
      "длинный диалог, лид уже хорошо знаком";

    const systemPrompt = getSalesSystemPrompt() +
      `\n\n## ТЕКУЩИЙ КОНТЕКСТ ЭТОГО ДИАЛОГА\n` +
      `Сегодня: ${todayStr} (Asia/Tashkent). Это РЕАЛЬНАЯ сегодняшняя дата — НИКОГДА не выдумывай и не путай дни. ` +
      `Если упоминаешь даты/время — отталкивайся ровно от этой даты.` +
      `\n\nКанал: ${channel}. ID собеседника: ${channelId}` +
      `\nТекущий статус лида: ${lead.stage}` +
      `\nСообщений в диалоге: ${messageCount} (${tempLeadStage})` +
      (lead.name ? `\nИмя лида: ${lead.name}` : "") +
      (lead.businessName ? `\nБизнес: ${lead.businessName}` : "") +
      (lead.businessType ? `\nТип: ${lead.businessType}` : "") +
      `\n\n### ТЕКУЩИЙ ЭТАП НАСТРОЙКИ\n${onboardingContext}` +
      `\n\n## КРИТИЧНОЕ НАПОМИНАНИЕ ПЕРЕД ОТВЕТОМ
1. Язык клиента → отвечай на нём же.
2. Мужской род → всегда «помог», «понял», «сделал», «рад».
3. Тарифы/конкуренты/фичи/шаги → ВСЕГДА через get_sales_facts, не по памяти.
4. ROI с цифрами → calculate_roi, не от руки.
5. Не знаешь точно → «уточню у команды», не выдумывай.
6. ТЫ САМ ВЕДЁШЬ ЛИДА ДО ЗАКРЫТИЯ. Цель — регистрация на staffix.io прямо в этом разговоре. НЕ передавай контакты, НЕ обещай встречу/звонок, НЕ говори «свяжемся». Если клиент хочет «человека» — отвечаешь что обсудишь всё сам прямо сейчас. schedule_demo — только если лид трижды настоял на встрече после твоих попыток закрыть в чате.`;

    // Call Claude with tools
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: salesBotTools,
    });

    // Process tool calls in a loop
    const allMessages: Anthropic.MessageParam[] = [...messages];
    let iterations = 0;

    while (response.stop_reason === "tool_use" && iterations < 5) {
      iterations++;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ContentBlock & { type: "tool_use" } => b.type === "tool_use"
      );

      // Add assistant message with tool use
      allMessages.push({ role: "assistant", content: response.content });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          lead.id,
          channel,
          channelId
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add tool results and get next response
      allMessages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages: allMessages,
        tools: salesBotTools,
      });
    }

    // Extract final text response
    let replyText =
      response.content.find((b) => b.type === "text")?.text ||
      "Здравствуйте! Я AI-консультант Staffix. Расскажите о Вашем бизнесе — помогу понять как Staffix может Вам помочь!";

    // Politeness safety-net: «Привет» → «Здравствуйте», «ты» → перегенерация на «Вы».
    const greetingFix = fixGreeting(replyText);
    if (greetingFix.changed) {
      console.log(`[Victor] SAFETY NET: replaced "Привет/Приветствую/Хай" greeting with "Здравствуйте"`);
      replyText = greetingFix.fixed;
    }
    if (detectFamiliarAddress(replyText)) {
      console.log(`[Victor] SAFETY NET: detected informal "ты" — regenerating response`);
      const regenerated = await regeneratePoliteResponse(systemPrompt, allMessages, replyText);
      const regeneratedFix = fixGreeting(regenerated);
      replyText = regeneratedFix.fixed;
      if (detectFamiliarAddress(replyText)) {
        // Если даже после регенерации остался "ты" — логируем, но не зацикливаемся.
        console.warn(`[Victor] SAFETY NET: regenerated text STILL contains "ты" — passing through with warning`);
      }
    }

    // Update history and lead info
    const updatedHistory = ([
      ...history,
      { role: "user" as const, content: userMessage },
      { role: "assistant" as const, content: replyText },
    ] as HistoryMessage[]).slice(-40);

    const updateData: Record<string, unknown> = {
      history: updatedHistory,
      updatedAt: new Date(),
    };
    if (clientName && !lead.name) updateData.name = clientName;
    if (clientPhone && !lead.phone) updateData.phone = clientPhone;
    if (lead.stage === "new") updateData.stage = "interested";

    await prisma.salesLead.update({
      where: { id: lead.id },
      data: updateData,
    });

    return replyText;
  } catch (e) {
    console.error("Staffix Sales AI error:", e);
    return "Привет! Я AI-консультант Staffix. Расскажите о вашем бизнесе — помогу понять как Staffix может вам помочь!";
  }
}
