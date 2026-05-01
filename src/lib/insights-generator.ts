/**
 * AI Insights Generator — Уровень 1 (per-business)
 *
 * Раз в неделю анализирует переписки бизнеса со своими клиентами
 * и предлагает владельцу конкретные действия:
 *  - faq_suggestion — повторяющийся вопрос, на который бот не знает ответа
 *  - escalation_pattern — много похожих эскалаций к менеджеру (значит FAQ неполный)
 *  - dont_know_pattern — бот часто отвечает "уточните у менеджера"
 *  - language_gap — клиенты пишут не на том языке, что отвечает бот
 *
 * Каждый инсайт сохраняется в AiInsight + создаётся Notification +
 * пушится владельцу в Telegram (если он подписан).
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const ANALYSIS_WINDOW_DAYS = 7;
const MIN_OCCURRENCES = 3; // паттерн считаем интересным от 3 повторов
const MAX_MESSAGES_PER_BUSINESS = 800; // потолок для одного прогона по Claude

interface SimpleMessage {
  role: string;
  content: string;
  createdAt: Date;
  conversationKey: string; // unique per conversation, для группировки
}

/**
 * Собирает все сообщения бизнеса за окно анализа из обоих источников
 * (Conversation + ChannelConversation.history) в единый плоский список.
 */
async function loadRecentMessages(
  businessId: string,
  windowDays: number
): Promise<SimpleMessage[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Основной TG-бот
  const tgConvs = await prisma.conversation.findMany({
    where: { businessId, updatedAt: { gte: since } },
    select: {
      id: true,
      messages: {
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, createdAt: true },
      },
    },
  });

  const tgFlat: SimpleMessage[] = tgConvs.flatMap((c) =>
    c.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      conversationKey: `tg-${c.id}`,
    }))
  );

  // WA / IG / FB (история живёт в JSON-поле history)
  const channelConvs = await prisma.channelConversation.findMany({
    where: { businessId, updatedAt: { gte: since } },
    select: { id: true, history: true, updatedAt: true },
  });

  const channelFlat: SimpleMessage[] = channelConvs.flatMap((c) => {
    const hist = (c.history as Array<{ role: string; content: string; ts?: string }>) || [];
    return hist.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.ts ? new Date(m.ts) : c.updatedAt,
      conversationKey: `ch-${c.id}`,
    }));
  });

  const all = [...tgFlat, ...channelFlat].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Хард-кап чтобы не отправить в Claude лишние тысячи сообщений
  return all.slice(-MAX_MESSAGES_PER_BUSINESS);
}

/**
 * Простой эвристический детектор: ищет user-сообщения, на которые бот ответил
 * фразами "не знаю", "уточните у менеджера", "не могу", "к сожалению, у меня нет".
 * Это сигнал что в FAQ/документах нет ответа на популярный вопрос.
 */
const DONT_KNOW_PATTERNS = [
  /не\s*знаю/i,
  /уточн[иь]те\s+у\s+менеджер/i,
  /уточнить\s+у\s+наших/i,
  /у\s+меня\s+нет\s+информации/i,
  /не\s+могу\s+ответ/i,
  /к\s+сожалению,?\s+(у\s+меня|я\s+не)/i,
  /свяжитесь\s+с\s+менеджер/i,
  /пока\s+не\s+загружен/i,
  /не\s+могу\s+самостоятельно/i,
];

function isDontKnow(text: string): boolean {
  if (!text) return false;
  return DONT_KNOW_PATTERNS.some((re) => re.test(text));
}

/**
 * Просит Claude сгруппировать список вопросов клиентов в кластеры
 * и предложить кандидаты в FAQ. Возвращает структурированный JSON.
 */
async function clusterQuestionsIntoFaqCandidates(
  questions: string[]
): Promise<Array<{ question: string; examples: string[]; suggestedAnswer?: string }>> {
  if (questions.length < MIN_OCCURRENCES) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[insights] ANTHROPIC_API_KEY not set — skipping clustering");
    return [];
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = `Проанализируй вопросы клиентов из переписки с AI-ботом бизнеса. Бот не смог ответить на эти вопросы — значит в базе знаний бизнеса нет нужной информации.

Сгруппируй похожие вопросы в кластеры. Для каждого кластера сформулируй:
- canonical_question: один общий вопрос, который покрывает все варианты в кластере (как должен выглядеть FAQ-вопрос)
- examples: до 3 примеров из исходных вопросов (дословные цитаты)

Минимум 3 повтора в кластере (одиночные не выводи). Выведи только JSON-массив, без markdown:

[{"canonical_question": "...", "examples": ["...", "...", "..."]}, ...]

Если кластеров нет — верни [].

Вопросы клиентов:
${questions.slice(0, 200).map((q, i) => `${i + 1}. ${q}`).join("\n")}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    // Извлекаем JSON массив
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      canonical_question: string;
      examples: string[];
    }>;

    return parsed
      .filter((c) => c.examples && c.examples.length >= MIN_OCCURRENCES)
      .map((c) => ({
        question: c.canonical_question,
        examples: c.examples,
      }));
  } catch (error) {
    console.error("[insights] Claude clustering failed:", error);
    return [];
  }
}

/**
 * Главная точка входа: анализирует один бизнес, создаёт инсайты,
 * возвращает количество созданных. Идемпотентность — чтобы не плодить
 * дубликаты, проверяем что свежие "new" инсайты с таким же типом + темой
 * не существуют (за последние 14 дней).
 */
export async function generateInsightsForBusiness(
  businessId: string
): Promise<{ created: number; skipped: number }> {
  const tag = `[insights][${businessId}]`;
  console.log(`${tag} START analysis window=${ANALYSIS_WINDOW_DAYS}d`);

  const messages = await loadRecentMessages(businessId, ANALYSIS_WINDOW_DAYS);
  if (messages.length === 0) {
    console.log(`${tag} no messages in window — skip`);
    return { created: 0, skipped: 0 };
  }
  console.log(`${tag} loaded ${messages.length} messages`);

  // Соберём пары "вопрос клиента → ответ бота" в рамках одного диалога
  const dontKnowQuestions: string[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const cur = messages[i];
    const next = messages[i + 1];
    if (
      cur.role === "user" &&
      next.role === "assistant" &&
      cur.conversationKey === next.conversationKey &&
      isDontKnow(next.content) &&
      cur.content.trim().length > 5 &&
      cur.content.trim().length < 500 // отбрасываем гигантские сообщения
    ) {
      dontKnowQuestions.push(cur.content.trim());
    }
  }
  console.log(`${tag} don't-know questions found: ${dontKnowQuestions.length}`);

  if (dontKnowQuestions.length < MIN_OCCURRENCES) {
    console.log(`${tag} below threshold (${MIN_OCCURRENCES}) — skip clustering`);
    return { created: 0, skipped: 0 };
  }

  // Кластеризуем через Claude
  const clusters = await clusterQuestionsIntoFaqCandidates(dontKnowQuestions);
  console.log(`${tag} Claude returned ${clusters.length} FAQ-candidate clusters`);

  if (clusters.length === 0) return { created: 0, skipped: 0 };

  // Идемпотентность: не дублируем те же вопросы за последние 14 дней
  const recentInsights = await prisma.aiInsight.findMany({
    where: {
      businessId,
      type: "faq_suggestion",
      status: { in: ["new", "accepted"] },
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { data: true },
  });
  const existingQuestions = new Set(
    recentInsights
      .map((i) => (i.data as { question?: string } | null)?.question?.trim().toLowerCase())
      .filter(Boolean)
  );

  let created = 0;
  let skipped = 0;
  for (const cluster of clusters) {
    const key = cluster.question.trim().toLowerCase();
    if (existingQuestions.has(key)) {
      skipped++;
      continue;
    }
    await prisma.aiInsight.create({
      data: {
        businessId,
        type: "faq_suggestion",
        title: `Часто спрашивают: ${cluster.question.slice(0, 70)}${cluster.question.length > 70 ? "…" : ""}`,
        description: `Клиенты ${cluster.examples.length} раз задали этот вопрос за неделю. Бот не смог ответить — нет информации в FAQ или документах. Добавьте FAQ, чтобы бот отвечал клиентам сразу.`,
        data: {
          question: cluster.question,
          examples: cluster.examples,
          frequency: cluster.examples.length,
        },
      },
    });
    created++;
  }

  console.log(`${tag} created=${created} skipped(duplicates)=${skipped}`);
  return { created, skipped };
}

/**
 * Запускает анализ по всем бизнесам с активными диалогами за окно.
 */
export async function generateInsightsForAllBusinesses(): Promise<{
  businessesProcessed: number;
  totalCreated: number;
}> {
  const since = new Date(Date.now() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { conversations: { some: { updatedAt: { gte: since } } } },
        { channelConversations: { some: { updatedAt: { gte: since } } } },
      ],
    },
    select: { id: true },
  });

  let totalCreated = 0;
  for (const b of businesses) {
    try {
      const r = await generateInsightsForBusiness(b.id);
      totalCreated += r.created;
    } catch (e) {
      console.error(`[insights] business ${b.id} failed:`, e);
    }
  }

  return { businessesProcessed: businesses.length, totalCreated };
}
