import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { sendSupportReplyToUserEmail } from "@/lib/email";

// Telegram update type — only fields we use
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
    audio?: { file_id: string; duration: number; mime_type?: string; file_size?: number };
  };
}

// System prompt — обновлён до состояния продукта на 4 мая 2026.
// Включает все 28 коммитов спринта 3-4 мая (CRM, AI продуктивность, платежи).
const SYSTEM_PROMPT = `Ты — AI-помощник службы поддержки Staffix. Staffix — SaaS-платформа AI-сотрудников для бизнеса в Telegram / WhatsApp / Instagram / Facebook.

## ПРАВИЛА ОБЩЕНИЯ (КРИТИЧНО)
- ВСЕГДА на «Вы». НИКОГДА не переходи на «ты» даже если собеседник пишет на «ты».
- Первое приветствие — «Здравствуйте» / «Добрый день / вечер». ЗАПРЕЩЕНО: Привет, Эй, Хай, Здорово, Слушай.
- Тон вежливый, профессиональный, тёплый. Кратко по делу.
- Допустимо: «честно говоря», «на самом деле», «если позволите», «кстати».
- Допустимо одно тёплое выражение на сообщение: «Понимаю Вас», «Хороший вопрос», «Конечно», «Безусловно», «Рад был помочь».
- ЗАПРЕЩЕНО: Прикольно, Круто, Топ, Жиза, Ооо, ")" вместо эмодзи.
- Эмодзи 0–1 на сообщение.
- Отвечай на языке пользователя (русский / английский / узбекский / казахский).

## ЧТО УМЕЕТ STAFFIX (актуально на май 2026)

### Каналы общения AI-сотрудника
- Telegram (через @BotFather + токен в дашборде → Каналы)
- WhatsApp Business (Embedded Signup, 5 минут)
- Instagram DM (через Meta OAuth, бизнес-аккаунт)
- Facebook Messenger (Page нужна — НЕ личный профиль, это требование Meta)
- **Голосовые сообщения** распознаются на 4 языках (Groq Whisper)

### AI и его обучение
- AI обучается на вашей **базе знаний**: FAQ, документы (PDF / Word / Excel), услуги, товары
- **AI Learning** — кнопка «Исправить ответ» в /dashboard/messages: исправляете один раз, AI больше не повторяет ошибку
- **AI-память клиента** — каждые 2 часа cron обновляет резюме и предпочтения каждого клиента из истории диалогов
- **AI заполняет custom fields сам** — если в /dashboard/settings → Профиль завести «Дата свадьбы» (тип Дата), AI заполнит её когда клиент упомянет в чате

### Что AI делает сам без команды менеджера
- Записывает клиентов на услуги (с проверкой расписания мастеров и специализации)
- Оформляет заказы (для магазинов)
- Шлёт напоминания за 24ч и 2ч до визита (no-show падает с 30% до 8%)
- Запрашивает отзыв после визита (4-5 баллов → на 2gis, 1-3 → в дашборд)
- Реактивирует ушедших клиентов со скидкой
- Делает допродажу после заказа (один товар)
- Передаёт диалог человеку (notify_manager) → создаётся задача менеджеру

### CRM — управление клиентами
- **База клиентов** с историей, AI-резюме, предпочтениями, тегами
- **Кастомные поля** — до 20 своих полей под бизнес (текст / число / дата / выбор), AI заполняет автоматом
- **Воронка продаж** — 5 этапов: лид → записан → встреча прошла → клиент / не купил
- **Kanban-вид** в /dashboard/customers — drag&drop карточек между этапами
- **Funnel-аналитика** в /dashboard/statistics — конверсии стадия→стадия в %
- **Программа лояльности** — cashback / каждый N-ный визит / уровни (бронзовый/серебряный/золотой/платиновый)
- **CSV-импорт и экспорт** клиентов и заказов (UTF-8 BOM, Excel сразу читает кириллицу)
- **Сегменты** клиентов (VIP / Активные / Неактивные) — для рассылок

### Команда
- Сотрудники, расписание, отгулы, специализация
- **Реферальные ссылки** \`t.me/ВашБот?start=s_<staffId>\` — клиент по ссылке привязан к менеджеру (работает в обоих режимах: продажи и услуги)
- **Распределение лидов** — 3 режима: Вручную / По очереди / По нагрузке
- **Ручное переназначение** — колонка «Менеджер» в /dashboard/customers, dropdown в строке клиента
- **Задачи менеджера** — виджет «Мои задачи» в /dashboard, AI авто-создаёт задачу при эскалации (срочные → +30 минут, обычные → +4 часа)

### Маркетинг
- **Рассылки в Telegram + Email** одновременно (тоggle при создании)
- Сегментация рассылок (все / VIP / активные / неактивные)
- Запланированные рассылки (cron каждые 5 мин обрабатывает очередь)
- Обязательная ссылка «Отписаться» в каждом email (Gmail one-click Unsubscribe)
- Транзакционные email (оплата, отмена) не блокируются отпиской

### Интеграции
- Outbound webhooks в Bitrix24 / amoCRM / Google Sheets / любой URL
- 6 типов событий: создание брони, подтверждение, отмена, новый клиент, отзыв, сообщение

### Sales+Booking гибрид (для онлайн-школ, консалтинга, коучей)
- Toggle «Запись на бесплатные консультации» в /dashboard/settings → Подписка (только в sales-режиме)
- AI получает оба набора инструментов — оформляет заказы И записывает на встречи

### Подписка Staffix (тарифы и платежи)
- Тарифы: Trial 14 дней (100 сообщений), Starter $20 (200), Pro $45 (1000), Business $95 (3000), Enterprise $180 (безлимит)
- Платежи через PayPro Global
- **Pro-rata смена тарифа**: при апгрейде неиспользованные дни старого плана становятся бонус-днями нового. При даунгрейде можно без оплаты — кредит конвертируется в дни.
- **Управление картой**: кнопка в /dashboard/settings → Подписка → открывается \`cc.payproglobal.com/customer/Account/Login\`. Первый раз? Пароля нет — нужно нажать «Forgot password», получить ссылку на email, задать пароль.
- **Отмена подписки**: PayPro Terminate → сервис до конца оплаченного периода → email «доступ до X числа» → напоминания за 7/3/1 день
- **При неудачном списании**: email клиенту с инструкцией обновить карту, после нескольких попыток — статус «Приостановлена», красный баннер в дашборде

## ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ

### «Бот не отвечает после изменения базы знаний / FAQ»
- Кэша нет — на каждое сообщение бот заново читает FAQ, документы, услуги, товары из БД. Изменения вступают в силу мгновенно.
- Документы парсятся при загрузке (несколько секунд для PDF) — пока статус «обрабатывается», документ в промпт не попадает.
- Если бот в продолжающемся диалоге повторяет старое — это «история перетягивает промпт». Решение: при изменении FAQ/документов на активных диалогах ставится флаг обновления, на следующем сообщении промпт включает напоминание сверять факты.

### «Не подключается Facebook / Instagram, ошибка No Pages»
Это значит подключили личный профиль FB. Meta разрешает API только бизнес-страницам (Facebook Page). Решение:
1. Создать Page на facebook.com/pages/create
2. Instagram переключить на Business + связать с Page
3. Опционально: «Convert profile to Page» в настройках Meta — переносит подписчиков
4. Вернуться в Staffix → Каналы → Подключить заново

### «Хочу добавить мастеров / расписание»
Дашборд → Моя команда → Добавить → имя, должность, фото, Telegram-username + кнопка «Расписание» для смен и «Отгулы» для отпусков.

### «Куда вводить токен Telegram бота»
Дашборд → AI-сотрудник → Канал Telegram → вставить токен от @BotFather.

### «Как работает реферальная ссылка менеджера»
В карточке сотрудника на /dashboard/staff кнопка «Копировать ссылку». Формат \`t.me/ВашБот?start=s_<staffId>\`. Клиент по ссылке привязывается к менеджеру навсегда.

### «У меня 2+ менеджеров — как распределять лидов»
/dashboard/staff → блок «Распределение новых лидов» (виден если 2+ сотрудников). Три режима — Вручную, По очереди, По нагрузке. На карточке сотрудника галочка «Принимает лидов» — снимите для отпускника.

### «Где увидеть свои тикеты в поддержку»
/dashboard/support — там история обращений и ответов администратора.

## ПРАВИЛА РАБОТЫ

- Отвечай кратко и по делу. Не пиши простыни — пользователь хочет конкретный шаг.
- Если знаешь точный ответ — давай ссылку на конкретный раздел дашборда.
- Если не знаешь точно — честно скажи и предложи передать вопрос специалисту.
- НЕ выдумывай функций которых нет (см. список выше — это исчерпывающий).
- ЗАПРЕЩЕНО упоминать «Финансы команды» / «Мои финансы» — этот раздел был удалён.
- При технических проблемах с аккаунтом — эскалируй.

## ЭСКАЛАЦИЯ
Если вопрос требует доступа к аккаунту, биллингу, или это явно баг — скажи:
«Для решения этого вопроса передам Ваше обращение специалисту. Он свяжется с Вами в ближайшее время.»

После этой фразы тебя автоматически эскалируют — Антон получит уведомление.`;

// ---------------------------------------------------------------------------
// Telegram helpers
// ---------------------------------------------------------------------------

async function sendTelegramMessage(chatId: number | bigint, text: string): Promise<boolean> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("[support-bot] sendTelegramMessage failed:", error);
    return false;
  }
}

async function sendTypingAction(chatId: number): Promise<void> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// DB persistence — replaces the old in-memory Map.
// ---------------------------------------------------------------------------

async function getOrCreateConversation(
  chatId: number,
  from: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string }
): Promise<{ id: string; messages: Array<{ role: string; content: string }> }> {
  const chatBig = BigInt(chatId);

  let conv = await prisma.supportBotConversation.findUnique({
    where: { telegramChatId: chatBig },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!conv) {
    conv = await prisma.supportBotConversation.create({
      data: {
        telegramChatId: chatBig,
        telegramUserId: BigInt(from.id),
        username: from.username || null,
        firstName: from.first_name,
        lastName: from.last_name || null,
        language: from.language_code || null,
      },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
  }

  // Возвращаем хронологически — старые сначала
  const messagesAsc = conv.messages.slice().reverse().map((m) => ({ role: m.role, content: m.content }));
  return { id: conv.id, messages: messagesAsc };
}

async function appendMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<void> {
  await prisma.supportBotMessage.create({
    data: { conversationId, role, content },
  });
  await prisma.supportBotConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Admin reply (от админа в боте — /reply <ticketId> <message>)
// Сохраняет в БД, ОБНОВЛЯЕТ статус тикета, ШЛЁТ EMAIL пользователю.
// Это и было главным разрывом — раньше ответ висел только в БД.
// ---------------------------------------------------------------------------

async function handleAdminReply(
  ticketIdShort: string,
  replyMessage: string
): Promise<string> {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { id: { endsWith: ticketIdShort } },
      include: { user: { select: { email: true, name: true } } },
    });

    if (tickets.length === 0) {
      return `❌ Тикет с ID "${ticketIdShort}" не найден.`;
    }
    if (tickets.length > 1) {
      return `⚠️ Найдено несколько тикетов. Используйте полный ID.`;
    }

    const ticket = tickets[0];

    await prisma.supportMessage.create({
      data: {
        content: replyMessage,
        isFromSupport: true,
        ticketId: ticket.id,
      },
    });

    if (ticket.status === "open") {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "in_progress" },
      });
    }

    // 🔔 Уведомление пользователю — это и есть фикс главной баги.
    let emailStatus = "✉️ email не отправлен (нет адреса)";
    if (ticket.user.email) {
      try {
        const result = await sendSupportReplyToUserEmail({
          email: ticket.user.email,
          name: ticket.user.name || "пользователь",
          ticketSubject: ticket.subject,
          ticketIdShort,
          replyMessage,
        });
        emailStatus = result.success
          ? `✉️ email отправлен на ${ticket.user.email}`
          : `⚠️ email НЕ отправлен: ${result.error || "ошибка"}`;
      } catch (e) {
        emailStatus = `⚠️ email сбой: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    return `✅ Ответ отправлен!\n\n<b>Тикет:</b> ${ticketIdShort}\n<b>Клиент:</b> ${ticket.user.name || ticket.user.email}\n${emailStatus}\n\n<b>Ваш ответ:</b>\n${replyMessage}`;
  } catch (error) {
    console.error("[support-bot] handleAdminReply error:", error);
    return `❌ Ошибка при сохранении ответа. Попробуйте позже.`;
  }
}

// Notify admin about escalation (когда AI сам передаёт диалог человеку)
async function notifyAdminEscalation(
  userName: string,
  userMessage: string,
  chatId: number,
  conversationId: string
): Promise<void> {
  const botToken = process.env.SUPPORT_BOT_TOKEN;
  const adminChatId = process.env.SUPPORT_CHAT_ID;
  if (!botToken || !adminChatId) return;

  const message =
    `🔔 <b>Эскалация из support-бота</b>\n\n` +
    `<b>Пользователь:</b> ${userName}\n` +
    `<b>Chat ID:</b> <code>${chatId}</code>\n` +
    `<b>Conversation ID:</b> <code>${conversationId.slice(-8)}</code>\n\n` +
    `<b>Сообщение:</b>\n${userMessage}\n\n` +
    `💬 Ответьте напрямую в <a href="https://t.me/staffix_support_bot">@staffix_support_bot</a> или через тикет /reply.`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error("[support-bot] notifyAdminEscalation failed:", error);
  }
}

// ---------------------------------------------------------------------------
// AI response generation (теперь с DB-историей)
// ---------------------------------------------------------------------------

async function generateAIResponse(
  userMessage: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "Извините, сервис временно недоступен. Попробуйте позже.";
  }
  try {
    const anthropic = new Anthropic({ apiKey });
    // Берём последние 20 сообщений + текущее новое
    const trimmedHistory = history.slice(-20);
    const messages = [
      ...trimmedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "Извините, не смог обработать запрос.";
    return text;
  } catch (error) {
    console.error("[support-bot] generateAIResponse failed:", error);
    return "Произошла ошибка. Попробуйте позже или напишите на support@staffix.io.";
  }
}

// ---------------------------------------------------------------------------
// Webhook entrypoint
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    if (!update.message?.text && !update.message?.voice && !update.message?.audio) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = message.chat.id;
    let userMessage = message.text || "";
    const userName = message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : "");

    // Voice / audio → STT
    if (!userMessage && (message.voice || message.audio)) {
      const fileId = message.voice?.file_id || message.audio?.file_id;
      const botToken = process.env.SUPPORT_BOT_TOKEN;
      if (botToken && fileId) {
        try {
          const { downloadTelegramFile, transcribeAudio } = await import("@/lib/voice-ai");
          const buf = await downloadTelegramFile(botToken, fileId);
          const filename = message.voice ? "voice.ogg" : "audio.mp3";
          const result = await transcribeAudio(buf, filename);
          userMessage = (result.text || "").trim();
          console.log(`[support-bot] STT (${result.language || "?"}): "${userMessage.slice(0, 80)}"`);
        } catch (e) {
          console.error("[support-bot] STT failed:", e);
        }
      }
      if (!userMessage) {
        await sendTelegramMessage(
          chatId,
          "Извините, не удалось распознать голосовое сообщение. Пожалуйста, напишите Ваш вопрос текстом."
        );
        return NextResponse.json({ ok: true });
      }
    }

    // /start
    if (userMessage === "/start") {
      await sendTelegramMessage(
        chatId,
        `Здравствуйте, ${message.from.first_name}! 👋\n\n` +
          `Я AI-помощник службы поддержки Staffix.\n\n` +
          `Задайте вопрос о платформе, и я постараюсь помочь:\n` +
          `• Как настроить AI-сотрудника\n` +
          `• Как подключить Telegram / WhatsApp / Instagram / Facebook\n` +
          `• Вопросы о тарифах и оплате\n` +
          `• Технические проблемы\n\n` +
          `Просто напишите Ваш вопрос!`
      );
      return NextResponse.json({ ok: true });
    }

    if (userMessage === "/help") {
      await sendTelegramMessage(
        chatId,
        `<b>Чем я могу помочь:</b>\n\n` +
          `• Ответить на вопросы о Staffix\n` +
          `• Помочь с настройкой AI-сотрудника\n` +
          `• Объяснить как подключить мессенджеры\n` +
          `• Рассказать о тарифах\n\n` +
          `<b>Команды:</b>\n` +
          `/start — Начать сначала\n` +
          `/help — Эта справка\n` +
          `/human — Связаться с живым оператором`
      );
      return NextResponse.json({ ok: true });
    }

    if (userMessage === "/human") {
      const conv = await getOrCreateConversation(chatId, message.from);
      await notifyAdminEscalation(userName, "Пользователь запросил связь с оператором", chatId, conv.id);
      await sendTelegramMessage(
        chatId,
        `Ваш запрос передан нашему специалисту. Он свяжется с Вами в ближайшее время.\n\n` +
          `Пока ожидаете — можете задать другие вопросы, возможно я смогу помочь.`
      );
      return NextResponse.json({ ok: true });
    }

    // Admin commands — /reply, /tickets
    const adminChatId = process.env.SUPPORT_CHAT_ID;
    if (userMessage.startsWith("/reply ") && String(chatId) === adminChatId) {
      const parts = userMessage.slice(7).trim().split(" ");
      const ticketIdShort = parts[0];
      const replyMessage = parts.slice(1).join(" ");
      if (!ticketIdShort || !replyMessage) {
        await sendTelegramMessage(
          chatId,
          `❌ <b>Неверный формат</b>\n\nИспользуйте:\n<code>/reply TICKET_ID Ваш ответ</code>`
        );
        return NextResponse.json({ ok: true });
      }
      const result = await handleAdminReply(ticketIdShort, replyMessage);
      await sendTelegramMessage(chatId, result);
      return NextResponse.json({ ok: true });
    }

    if (userMessage === "/tickets" && String(chatId) === adminChatId) {
      try {
        const openTickets = await prisma.supportTicket.findMany({
          where: { status: { in: ["open", "in_progress"] } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        if (openTickets.length === 0) {
          await sendTelegramMessage(chatId, "✅ Нет открытых тикетов!");
        } else {
          let msg = `📋 <b>Открытые тикеты (${openTickets.length}):</b>\n\n`;
          for (const t of openTickets) {
            const shortId = t.id.slice(-8);
            const status = t.status === "open" ? "🆕" : "⏳";
            msg += `${status} <code>${shortId}</code> — ${t.subject}\n   👤 ${t.user.name || t.user.email}\n\n`;
          }
          msg += `\n💬 Ответить: <code>/reply ID сообщение</code>`;
          await sendTelegramMessage(chatId, msg);
        }
      } catch (error) {
        console.error("[support-bot] /tickets error:", error);
        await sendTelegramMessage(chatId, "❌ Ошибка при загрузке тикетов");
      }
      return NextResponse.json({ ok: true });
    }

    // Регулярный диалог: персистентная история + AI ответ
    await sendTypingAction(chatId);

    const conv = await getOrCreateConversation(chatId, message.from);
    await appendMessage(conv.id, "user", userMessage);

    const aiResponse = await generateAIResponse(userMessage, conv.messages);

    await appendMessage(conv.id, "assistant", aiResponse);
    await sendTelegramMessage(chatId, aiResponse);

    // Эскалация если AI сам сообщил что передаёт человеку
    if (
      aiResponse.toLowerCase().includes("передам ваше обращение") ||
      aiResponse.toLowerCase().includes("передать ваше обращение") ||
      aiResponse.toLowerCase().includes("свяжется с вами в ближайшее время") ||
      aiResponse.toLowerCase().includes("специалисту")
    ) {
      await notifyAdminEscalation(userName, userMessage, chatId, conv.id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[support-bot] webhook error:", error);
    return NextResponse.json({ ok: true }); // Telegram всегда ждёт 200
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", message: "Staffix Support Bot Webhook" });
}
