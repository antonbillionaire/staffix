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

// Sprint 4C thresholds
const DONT_KNOW_RATE_THRESHOLD = 0.2; // >20% ответов бота = «не знаю» → инсайт
const DONT_KNOW_MIN_ASSISTANT_MESSAGES = 20; // ниже — статистика недостоверна
const LANGUAGE_GAP_THRESHOLD = 0.3; // >30% сообщений клиента в не-родном для бота языке
const LANGUAGE_GAP_MIN_USER_MESSAGES = 15;

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
 * Паттерны эскалации к менеджеру (после вызова notify_manager tool
 * бот пишет клиенту одну из этих фраз). Считаем такие моменты, чтобы
 * найти повторяющиеся темы, ради которых бот сдался.
 */
const ESCALATION_PATTERNS = [
  /(?:пере(?:дам|дал|адрес)|перешл[юё])\s+.*менеджер/i,
  /менеджер\s+.*(?:свяж[еи]тся|перезвон)/i,
  /(?:наш\s+)?специалист\s+.*(?:свяж[еи]тся|перезвон|уточнит)/i,
  /(?:соедин(?:ю|яю)|переключаю)\s+.*(?:менеджер|оператор)/i,
];

export function isEscalation(text: string): boolean {
  if (!text) return false;
  return ESCALATION_PATTERNS.some((re) => re.test(text));
}

// Экспорт для юнит-тестов Sprint 4C
export { isDontKnow };

/**
 * Определение языка по простым эвристикам. Только для инсайтов "language_gap":
 * важнее скорость и стабильность, чем 100% точность.
 *   - kz: наличие казахских спец-букв (ә, ө, ұ, ү, ң, і, ғ, қ, һ)
 *   - ru: кириллица без казахских букв
 *   - uz: латиница + типичные узбекские слова/окончания (aksiya, salom, rahmat, ...)
 *   - en: латиница без узбекских маркеров
 *   - other: непонятно (эмодзи/цифры/короткое)
 */
type Lang = "ru" | "kz" | "uz" | "en" | "other";

const KZ_LETTERS = /[әөұүңіғқһӘӨҰҮҢІҒҚҺ]/;
const CYRILLIC = /[а-яё]/i;
const LATIN = /[a-z]/i;
const UZ_MARKERS = /\b(salom|rahmat|iltimos|kerak|xizmat|narx|qancha|qachon|manzil|men|siz|bo\w{0,2}sh|katta|kichkin)/i;

export function detectLang(text: string): Lang {
  if (!text || text.trim().length < 2) return "other";
  const clean = text.slice(0, 400);
  if (KZ_LETTERS.test(clean)) return "kz";
  if (CYRILLIC.test(clean)) return "ru";
  if (LATIN.test(clean)) {
    if (UZ_MARKERS.test(clean)) return "uz";
    return "en";
  }
  return "other";
}

/**
 * Просит Claude сгруппировать вопросы в кластеры. Используется для двух
 * типов инсайтов (faq_suggestion и escalation_pattern) — единственная
 * разница в prompt-обрамлении и целевом действии. `theme` меняет
 * инструкцию, чтобы Claude понимал природу списка.
 */
async function clusterQuestions(
  questions: string[],
  theme: "faq" | "escalation"
): Promise<Array<{ question: string; examples: string[] }>> {
  if (questions.length < MIN_OCCURRENCES) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[insights] ANTHROPIC_API_KEY not set — skipping clustering");
    return [];
  }

  const anthropic = new Anthropic({ apiKey });

  const context =
    theme === "faq"
      ? "Бот не смог ответить на эти вопросы — в базе знаний бизнеса нет нужной информации."
      : "После этих вопросов бот эскалировал разговор менеджеру (передал живому человеку). Значит вопросы повторяющиеся и требуют либо FAQ, либо явного сценария в обучении бота.";

  const prompt = `Проанализируй вопросы клиентов из переписки с AI-ботом бизнеса. ${context}

Сгруппируй похожие вопросы в кластеры. Для каждого кластера сформулируй:
- canonical_question: один общий вопрос, который покрывает все варианты в кластере
- examples: до 3 примеров из исходных вопросов (дословные цитаты)

Минимум ${MIN_OCCURRENCES} повторов в кластере (одиночные не выводи). Выведи только JSON-массив, без markdown:

[{"canonical_question": "...", "examples": ["...", "...", "..."]}, ...]

Если кластеров нет — верни [].

Вопросы клиентов:
${questions.slice(0, 200).map((q, i) => `${i + 1}. ${q}`).join("\n")}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

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
 * Собирает пары "вопрос клиента → ответ бота" одного диалога, если ответ
 * матчится под указанный маркер (dont-know / escalation).
 */
function pairQuestionsWithMarker(
  messages: SimpleMessage[],
  matcher: (assistantContent: string) => boolean
): string[] {
  const questions: string[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const cur = messages[i];
    const next = messages[i + 1];
    if (
      cur.role === "user" &&
      next.role === "assistant" &&
      cur.conversationKey === next.conversationKey &&
      matcher(next.content) &&
      cur.content.trim().length > 5 &&
      cur.content.trim().length < 500
    ) {
      questions.push(cur.content.trim());
    }
  }
  return questions;
}

/**
 * Идемпотентность на уровне бизнеса: возвращает set нормализованных ключей
 * которые уже покрыты недавними инсайтами того же типа. Свежее окно 14 дней.
 */
async function loadRecentInsightKeys(
  businessId: string,
  type: string,
  dataKey: "question" | "language"
): Promise<Set<string>> {
  const rows = await prisma.aiInsight.findMany({
    where: {
      businessId,
      type,
      status: { in: ["new", "accepted"] },
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { data: true },
  });
  return new Set(
    rows
      .map((r) => {
        const val = (r.data as Record<string, unknown> | null)?.[dataKey];
        return typeof val === "string" ? val.trim().toLowerCase() : null;
      })
      .filter((v): v is string => Boolean(v))
  );
}

/**
 * ─── Тип 1: faq_suggestion ─────────────────────────────────────────────
 * Кластеризует "dont-know" вопросы клиентов в кандидатов на FAQ.
 */
async function generateFaqSuggestions(
  businessId: string,
  messages: SimpleMessage[],
  tag: string
): Promise<{ created: number; skipped: number }> {
  const dontKnowQuestions = pairQuestionsWithMarker(messages, isDontKnow);
  console.log(`${tag} faq_suggestion: don't-know questions=${dontKnowQuestions.length}`);

  if (dontKnowQuestions.length < MIN_OCCURRENCES) return { created: 0, skipped: 0 };

  const clusters = await clusterQuestions(dontKnowQuestions, "faq");
  if (clusters.length === 0) return { created: 0, skipped: 0 };

  const existing = await loadRecentInsightKeys(businessId, "faq_suggestion", "question");
  let created = 0;
  let skipped = 0;
  for (const cluster of clusters) {
    const key = cluster.question.trim().toLowerCase();
    if (existing.has(key)) {
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
  return { created, skipped };
}

/**
 * ─── Тип 2: escalation_pattern ─────────────────────────────────────────
 * Кластеризует вопросы после которых бот эскалировал разговор менеджеру
 * ("передам менеджеру"/"свяжется специалист"). Помогает найти темы для
 * дообучения или явных сценариев.
 */
async function generateEscalationPatterns(
  businessId: string,
  messages: SimpleMessage[],
  tag: string
): Promise<{ created: number; skipped: number }> {
  const escalatedQuestions = pairQuestionsWithMarker(messages, isEscalation);
  console.log(`${tag} escalation_pattern: escalated questions=${escalatedQuestions.length}`);

  if (escalatedQuestions.length < MIN_OCCURRENCES) return { created: 0, skipped: 0 };

  const clusters = await clusterQuestions(escalatedQuestions, "escalation");
  if (clusters.length === 0) return { created: 0, skipped: 0 };

  const existing = await loadRecentInsightKeys(businessId, "escalation_pattern", "question");
  let created = 0;
  let skipped = 0;
  for (const cluster of clusters) {
    const key = cluster.question.trim().toLowerCase();
    if (existing.has(key)) {
      skipped++;
      continue;
    }
    await prisma.aiInsight.create({
      data: {
        businessId,
        type: "escalation_pattern",
        title: `Бот часто передаёт менеджеру: ${cluster.question.slice(0, 60)}${cluster.question.length > 60 ? "…" : ""}`,
        description: `За неделю бот ${cluster.examples.length} раз передал менеджеру похожие вопросы. Обучите бота отвечать самостоятельно (добавьте FAQ или сценарий), либо оставьте эскалацию если тема требует человека.`,
        data: {
          question: cluster.question,
          examples: cluster.examples,
          frequency: cluster.examples.length,
        },
      },
    });
    created++;
  }
  return { created, skipped };
}

/**
 * ─── Тип 3: dont_know_pattern ──────────────────────────────────────────
 * Агрегатный инсайт: доля ответов бота = "не знаю". Если >20% и хотя бы
 * 20 ответов в окне — сигнал что база знаний слабая в целом. Не дублирует
 * faq_suggestion: тот про КОНКРЕТНЫЕ вопросы, этот про СИСТЕМНЫЙ уровень.
 */
async function generateDontKnowPatternSummary(
  businessId: string,
  messages: SimpleMessage[],
  tag: string
): Promise<{ created: number; skipped: number }> {
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  if (assistantMsgs.length < DONT_KNOW_MIN_ASSISTANT_MESSAGES) {
    return { created: 0, skipped: 0 };
  }
  const dontKnowCount = assistantMsgs.filter((m) => isDontKnow(m.content)).length;
  const rate = dontKnowCount / assistantMsgs.length;
  console.log(
    `${tag} dont_know_pattern: rate=${(rate * 100).toFixed(1)}% ` +
    `(${dontKnowCount}/${assistantMsgs.length})`
  );

  if (rate < DONT_KNOW_RATE_THRESHOLD) return { created: 0, skipped: 0 };

  // Идемпотентность: за последние 7 дней уже был такой инсайт → не плодим
  const existing = await prisma.aiInsight.findFirst({
    where: {
      businessId,
      type: "dont_know_pattern",
      status: { in: ["new", "accepted"] },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (existing) return { created: 0, skipped: 1 };

  const pct = Math.round(rate * 100);
  await prisma.aiInsight.create({
    data: {
      businessId,
      type: "dont_know_pattern",
      title: `Бот часто говорит "не знаю" — ${pct}% ответов`,
      description:
        `За неделю бот в ${pct}% случаев (${dontKnowCount} из ${assistantMsgs.length} ответов) ` +
        `не смог помочь клиенту и предложил уточнить у менеджера. Норма — ниже 15%. ` +
        `Расширьте FAQ и загрузите документы бизнеса, чтобы бот знал больше.`,
      data: {
        rate,
        dontKnowCount,
        totalAssistantMessages: assistantMsgs.length,
        windowDays: ANALYSIS_WINDOW_DAYS,
      },
    },
  });
  return { created: 1, skipped: 0 };
}

/**
 * ─── Тип 4: language_gap ───────────────────────────────────────────────
 * Клиенты пишут на языке, отличном от того на котором отвечает бот.
 * Пример: бизнес в УЗ, клиенты пишут на узбекском (латиница), бот
 * настроен на русский — клиенты чувствуют "не своего". Раньше это
 * терялось молча.
 */
async function generateLanguageGap(
  businessId: string,
  messages: SimpleMessage[],
  tag: string
): Promise<{ created: number; skipped: number }> {
  const userMsgs = messages.filter((m) => m.role === "user");
  const assistantMsgs = messages.filter((m) => m.role === "assistant");
  if (userMsgs.length < LANGUAGE_GAP_MIN_USER_MESSAGES) {
    return { created: 0, skipped: 0 };
  }

  // Определяем "язык бота" как самый частый среди ответов ассистента
  const asstLangCount = new Map<Lang, number>();
  for (const m of assistantMsgs) {
    const l = detectLang(m.content);
    if (l === "other") continue;
    asstLangCount.set(l, (asstLangCount.get(l) || 0) + 1);
  }
  let botLang: Lang = "other";
  let botLangHits = 0;
  for (const [lang, cnt] of asstLangCount) {
    if (cnt > botLangHits) {
      botLang = lang;
      botLangHits = cnt;
    }
  }
  if (botLang === "other") return { created: 0, skipped: 0 };

  // Считаем клиентов, которые пишут НЕ на языке бота
  const clientLangCount = new Map<Lang, number>();
  let scoredUser = 0;
  for (const m of userMsgs) {
    const l = detectLang(m.content);
    if (l === "other") continue;
    scoredUser++;
    clientLangCount.set(l, (clientLangCount.get(l) || 0) + 1);
  }
  if (scoredUser < LANGUAGE_GAP_MIN_USER_MESSAGES) {
    return { created: 0, skipped: 0 };
  }

  // Самый частый "чужой" язык клиента
  let otherLang: Lang = "other";
  let otherCount = 0;
  for (const [lang, cnt] of clientLangCount) {
    if (lang === botLang) continue;
    if (cnt > otherCount) {
      otherLang = lang;
      otherCount = cnt;
    }
  }
  const otherRate = otherCount / scoredUser;
  console.log(
    `${tag} language_gap: bot=${botLang} vs client-other=${otherLang} ` +
    `(${(otherRate * 100).toFixed(1)}% of ${scoredUser} user msgs)`
  );

  if (otherLang === "other" || otherRate < LANGUAGE_GAP_THRESHOLD) {
    return { created: 0, skipped: 0 };
  }

  // Идемпотентность: за 14 дней такой же mismatch bot=X, client=Y — не дублируем
  const key = `${botLang}→${otherLang}`;
  const existing = await loadRecentInsightKeys(businessId, "language_gap", "language");
  if (existing.has(key)) return { created: 0, skipped: 1 };

  const langNames: Record<Lang, string> = {
    ru: "русском",
    kz: "казахском",
    uz: "узбекском",
    en: "английском",
    other: "неизвестном",
  };

  const pct = Math.round(otherRate * 100);
  await prisma.aiInsight.create({
    data: {
      businessId,
      type: "language_gap",
      title: `Клиенты пишут на ${langNames[otherLang]}, а бот отвечает на ${langNames[botLang]}`,
      description:
        `${pct}% сообщений клиентов за неделю пришли на ${langNames[otherLang]} языке, ` +
        `но бот отвечает на ${langNames[botLang]}. Проверьте что в настройках бота указан ` +
        `правильный язык, либо расширьте инструкции чтобы бот определял язык клиента и ` +
        `отвечал на нём.`,
      data: {
        language: key,
        botLang,
        clientLang: otherLang,
        rate: otherRate,
        userMessagesAnalyzed: scoredUser,
      },
    },
  });
  return { created: 1, skipped: 0 };
}

/**
 * Главная точка входа: анализирует один бизнес по всем 4 типам инсайтов.
 * Ошибка в одном типе не должна ронять остальные — оборачиваем каждый.
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

  let created = 0;
  let skipped = 0;
  const runners: Array<[string, () => Promise<{ created: number; skipped: number }>]> = [
    ["faq_suggestion", () => generateFaqSuggestions(businessId, messages, tag)],
    ["escalation_pattern", () => generateEscalationPatterns(businessId, messages, tag)],
    ["dont_know_pattern", () => generateDontKnowPatternSummary(businessId, messages, tag)],
    ["language_gap", () => generateLanguageGap(businessId, messages, tag)],
  ];

  for (const [name, runner] of runners) {
    try {
      const r = await runner();
      created += r.created;
      skipped += r.skipped;
    } catch (error) {
      console.error(`${tag} ${name} failed:`, error);
    }
  }

  console.log(`${tag} DONE total created=${created} skipped=${skipped}`);
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
