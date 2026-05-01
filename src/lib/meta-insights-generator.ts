/**
 * Meta-Insights Generator — Уровень 2 (для Staffix-админа Антона)
 *
 * Раз в день анализирует все бизнесы и платформу в целом, ищет системные
 * проблемы и пишет в `MetaInsight`. Цель — поймать баги/тренды до того,
 * как клиенты начнут жаловаться (FAQ игнорируется ботом, эскалации копятся,
 * бизнесы упираются в лимит сообщений и т.п.).
 *
 * Детекторы максимально дешёвые (regex/SQL aggregates), без Claude-вызовов.
 * Если в будущем понадобится сентимент-классификация — добавим отдельный
 * детектор с Claude.
 */

import { prisma } from "@/lib/prisma";
import { maskName } from "@/lib/admin-mask";

const ANALYSIS_WINDOW_HOURS = 24;
const STUCK_CONVERSATION_MSG_THRESHOLD = 20;
const DONT_KNOW_RATIO_THRESHOLD = 0.3; // если >30% ответов "не знаю" → проблема
const QUOTA_PRESSURE_RATIO = 0.85;
const TOOL_FAILURE_THRESHOLD = 5;

interface DetectorResult {
  type: string;
  severity: "info" | "warn" | "critical";
  title: string;
  description: string;
  businessId?: string;
  data?: Record<string, unknown>;
}

const DONT_KNOW_PATTERNS = [
  /не\s*знаю/i,
  /уточн[иь]те\s+у\s+менеджер/i,
  /уточнить\s+у\s+наших/i,
  /у\s+меня\s+нет\s+информации/i,
  /не\s+могу\s+ответ/i,
  /к\s+сожалению,?\s+(у\s+меня|я\s+не)/i,
  /свяжитесь\s+с\s+менеджер/i,
  /пока\s+не\s+загружен/i,
];

function isDontKnow(text: string): boolean {
  if (!text) return false;
  return DONT_KNOW_PATTERNS.some((re) => re.test(text));
}

// ─── Детектор 1: бизнесы где бот часто говорит "не знаю" ────────────────
async function detectFrequentDontKnow(since: Date): Promise<DetectorResult[]> {
  const out: DetectorResult[] = [];

  // Берём все бизнесы с активной перепиской и считаем долю dont-know ответов
  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { conversations: { some: { updatedAt: { gte: since } } } },
        { channelConversations: { some: { updatedAt: { gte: since } } } },
      ],
    },
    select: { id: true, name: true },
  });

  for (const biz of businesses) {
    // Основной TG-бот
    const tgMessages = await prisma.message.findMany({
      where: {
        conversation: { businessId: biz.id },
        role: "assistant",
        createdAt: { gte: since },
      },
      select: { content: true },
      take: 500,
    });

    const channelConvs = await prisma.channelConversation.findMany({
      where: { businessId: biz.id, updatedAt: { gte: since } },
      select: { history: true },
    });

    const channelAssistant = channelConvs.flatMap((c) => {
      const hist = (c.history as Array<{ role: string; content: string }>) || [];
      return hist
        .filter((m) => m.role === "assistant")
        .map((m) => ({ content: m.content }));
    });

    const allBotReplies = [...tgMessages, ...channelAssistant];
    if (allBotReplies.length < 10) continue; // мало данных для оценки

    const dontKnowCount = allBotReplies.filter((m) => isDontKnow(m.content)).length;
    const ratio = dontKnowCount / allBotReplies.length;

    if (ratio >= DONT_KNOW_RATIO_THRESHOLD && dontKnowCount >= 5) {
      out.push({
        type: "dont_know_frequency",
        severity: ratio >= 0.5 ? "warn" : "info",
        title: `${biz.name}: бот часто отвечает "не знаю" (${Math.round(ratio * 100)}%)`,
        description: `За последние 24ч ${dontKnowCount} из ${allBotReplies.length} ответов бота — отказ ("не знаю", "уточните у менеджера"). База знаний неполная или промпт не использует FAQ. Откройте /admin/conversations → бизнес → переписки чтобы посмотреть на каких вопросах бот теряется.`,
        businessId: biz.id,
        data: {
          businessName: biz.name,
          totalReplies: allBotReplies.length,
          dontKnowCount,
          ratio,
        },
      });
    }
  }

  return out;
}

// ─── Детектор 2: застрявшие диалоги (>20 сообщений без записи/заказа) ───
async function detectStuckConversations(since: Date): Promise<DetectorResult[]> {
  const out: DetectorResult[] = [];

  // TG-conversation: считаем большие messageCount без booking за период
  const stuckTg = await prisma.conversation.findMany({
    where: {
      messageCount: { gte: STUCK_CONVERSATION_MSG_THRESHOLD },
      updatedAt: { gte: since },
      outcome: null, // не достигнут результат
    },
    select: {
      id: true,
      businessId: true,
      messageCount: true,
      clientName: true,
      business: { select: { name: true } },
    },
    take: 50,
  });

  // Группируем по бизнесу
  const byBiz = new Map<string, { name: string; convs: typeof stuckTg }>();
  for (const c of stuckTg) {
    const entry = byBiz.get(c.businessId);
    if (entry) entry.convs.push(c);
    else byBiz.set(c.businessId, { name: c.business.name, convs: [c] });
  }

  for (const [businessId, { name, convs }] of byBiz) {
    if (convs.length < 2) continue; // одиночный случай — не паттерн
    out.push({
      type: "stuck_conversation",
      severity: convs.length >= 5 ? "warn" : "info",
      title: `${name}: ${convs.length} клиентов крутятся в диалоге без результата`,
      description: `За 24ч у ${name} ${convs.length} диалогов прошли больше ${STUCK_CONVERSATION_MSG_THRESHOLD} сообщений и не закончились ни записью, ни эскалацией. Бот не довёл клиента до конца. Возможно, нужно поправить инструкции или добавить кнопку "связать с менеджером" в неоднозначных ситуациях.`,
      businessId,
      data: {
        businessName: name,
        stuckCount: convs.length,
        examples: convs.slice(0, 5).map((c) => ({
          conversationId: c.id,
          clientName: maskName(c.clientName), // PII: маскируем имена конечных клиентов
          messageCount: c.messageCount,
        })),
      },
    });
  }

  return out;
}

// ─── Детектор 3: бизнесы у предельной квоты сообщений ──────────────────
async function detectQuotaPressure(): Promise<DetectorResult[]> {
  const out: DetectorResult[] = [];

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      messagesLimit: { gt: 0 },
    },
    select: {
      messagesUsed: true,
      messagesLimit: true,
      plan: true,
      business: { select: { id: true, name: true } },
    },
  });

  for (const sub of subscriptions) {
    if (!sub.business) continue;
    if (sub.messagesLimit <= 0) continue;
    const ratio = sub.messagesUsed / sub.messagesLimit;
    if (ratio >= QUOTA_PRESSURE_RATIO) {
      out.push({
        type: "quota_pressure",
        severity: ratio >= 0.95 ? "critical" : "warn",
        title: `${sub.business.name}: квота сообщений ${Math.round(ratio * 100)}% (${sub.messagesUsed}/${sub.messagesLimit})`,
        description: `Тариф ${sub.plan} почти исчерпан. Если не апгрейдиться — бот перестанет отвечать. Хорошее время связаться и предложить апгрейд / докупить пакет сообщений.`,
        businessId: sub.business.id,
        data: {
          businessName: sub.business.name,
          plan: sub.plan,
          used: sub.messagesUsed,
          limit: sub.messagesLimit,
          ratio,
        },
      });
    }
  }

  return out;
}

// ─── Детектор 4: эскалации к менеджеру по конкретному бизнесу ───────────
async function detectEscalationSpikes(since: Date): Promise<DetectorResult[]> {
  const out: DetectorResult[] = [];

  // notify_manager сейчас создаёт Notification type=manager_escalation —
  // считаем их по бизнесам.
  const escalations = await prisma.notification.groupBy({
    by: ["businessId"],
    where: {
      type: "manager_escalation",
      createdAt: { gte: since },
    },
    _count: true,
  });

  const sorted = escalations
    .filter((e) => e._count >= 5) // 5+ эскалаций в день — паттерн
    .sort((a, b) => b._count - a._count);

  if (sorted.length === 0) return out;

  const businessIds = sorted.map((e) => e.businessId);
  const businesses = await prisma.business.findMany({
    where: { id: { in: businessIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(businesses.map((b) => [b.id, b.name]));

  for (const e of sorted) {
    const name = nameMap.get(e.businessId) || "(без имени)";
    out.push({
      type: "escalation_spike",
      severity: e._count >= 15 ? "warn" : "info",
      title: `${name}: ${e._count} эскалаций менеджеру за сутки`,
      description: `Бот ${e._count} раз передал клиентов живому менеджеру. Возможно, в FAQ не хватает важной информации, или бот эскалирует слишком агрессивно. Посмотрите /admin/conversations для деталей.`,
      businessId: e.businessId,
      data: { businessName: name, escalationCount: e._count },
    });
  }

  return out;
}

// ─── Главная точка входа ────────────────────────────────────────────────
export async function generateMetaInsights(): Promise<{
  created: number;
  byType: Record<string, number>;
}> {
  const since = new Date(Date.now() - ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000);
  console.log(`[meta-insights] window=${ANALYSIS_WINDOW_HOURS}h since=${since.toISOString()}`);

  // Запускаем все детекторы параллельно
  const detectorBatches = await Promise.all([
    detectFrequentDontKnow(since).catch((e) => {
      console.error("[meta-insights] detectFrequentDontKnow failed:", e);
      return [] as DetectorResult[];
    }),
    detectStuckConversations(since).catch((e) => {
      console.error("[meta-insights] detectStuckConversations failed:", e);
      return [] as DetectorResult[];
    }),
    detectQuotaPressure().catch((e) => {
      console.error("[meta-insights] detectQuotaPressure failed:", e);
      return [] as DetectorResult[];
    }),
    detectEscalationSpikes(since).catch((e) => {
      console.error("[meta-insights] detectEscalationSpikes failed:", e);
      return [] as DetectorResult[];
    }),
  ]);

  const all = detectorBatches.flat();
  console.log(`[meta-insights] detectors produced ${all.length} candidates`);

  // Идемпотентность: не плодим дубли — для каждой пары (type, businessId)
  // не создаём новый инсайт если за последние 12ч уже есть со статусом new.
  const recent = await prisma.metaInsight.findMany({
    where: {
      status: "new",
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    },
    select: { type: true, businessId: true },
  });
  const recentSet = new Set(recent.map((r) => `${r.type}|${r.businessId || ""}`));

  const byType: Record<string, number> = {};
  let created = 0;
  for (const d of all) {
    const key = `${d.type}|${d.businessId || ""}`;
    if (recentSet.has(key)) continue;
    await prisma.metaInsight.create({
      data: {
        type: d.type,
        severity: d.severity,
        title: d.title,
        description: d.description,
        data: (d.data ?? {}) as object,
        businessId: d.businessId,
      },
    });
    created++;
    byType[d.type] = (byType[d.type] || 0) + 1;
  }

  console.log(`[meta-insights] created=${created}`, byType);
  return { created, byType };
}
