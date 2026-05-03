/**
 * Auto-detection прогресса онбординга по состоянию БД.
 * Используется чек-листом в дашборде — пользователь видит что сделано и что осталось.
 *
 * Шаги сверяются с теми же ключами что и в onboarding-steps.ts (используются Виктором).
 */

import { prisma } from "@/lib/prisma";
import { ONBOARDING_STEPS, type OnboardingStepKey } from "./onboarding-steps";

export interface ChecklistItem {
  key: OnboardingStepKey;
  num: number;
  title: string;
  description: string;
  done: boolean;
  optional: boolean;     // некоторые шаги (доп. каналы) не обязательны для запуска
  href?: string;         // куда вести по кнопке «Перейти»
  cta?: string;          // текст кнопки
}

export interface OnboardingProgress {
  items: ChecklistItem[];
  doneCount: number;
  requiredCount: number;       // сколько обязательных шагов всего
  doneRequiredCount: number;   // сколько обязательных уже сделано
  nextStep: ChecklistItem | null;
  allDone: boolean;            // все обязательные шаги пройдены
  launchedAt: Date | null;     // когда пользователь явно нажал «Запустил»
}

/** Возвращает прогресс онбординга для бизнеса. */
export async function getOnboardingProgress(businessId: string): Promise<OnboardingProgress> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      dashboardMode: true,
      botToken: true,
      waActive: true,
      fbActive: true,
      igActive: true,
      aiTone: true,
      botDisplayName: true,
      onboardingCompleted: true,
      updatedAt: true,
    },
  });

  if (!business) {
    return emptyProgress();
  }

  // Параллельные подсчёты по связанным таблицам
  const [staffCount, serviceCount, productCount, faqCount, docCount, conversationCount, channelConvCount, automationSettings] =
    await Promise.all([
      prisma.staff.count({ where: { businessId } }),
      prisma.service.count({ where: { businessId } }),
      prisma.product.count({ where: { businessId } }),
      prisma.fAQ.count({ where: { businessId } }),
      prisma.document.count({ where: { businessId } }),
      prisma.conversation.count({ where: { businessId } }),
      prisma.channelConversation.count({ where: { businessId } }),
      prisma.automationSettings.findUnique({ where: { businessId }, select: { reminder24hEnabled: true, reviewEnabled: true } }),
    ]);

  const isSales = business.dashboardMode === "sales";
  const catalogCount = isSales ? productCount : serviceCount;
  const totalConversations = conversationCount + channelConvCount;

  const items: ChecklistItem[] = [
    {
      ...stepMeta("registered"),
      done: true, // если пользователь видит дашборд — он зарегистрирован
      optional: false,
    },
    {
      ...stepMeta("business_profile"),
      done: !!business.name && !!business.dashboardMode,
      optional: false,
      href: "/dashboard/settings",
      cta: "Заполнить профиль",
    },
    {
      ...stepMeta("telegram_bot"),
      done: !!business.botToken,
      optional: false,
      href: "/dashboard/bot",
      cta: "Подключить бота",
    },
    {
      ...stepMeta("extra_channels"),
      done: !!business.waActive || !!business.fbActive || !!business.igActive,
      optional: true,
      href: "/dashboard/channels",
      cta: "Подключить каналы",
    },
    {
      ...stepMeta("team"),
      done: staffCount > 0,
      optional: false,
      href: "/dashboard/staff",
      cta: "Добавить команду",
    },
    {
      ...stepMeta("catalog"),
      done: catalogCount > 0,
      optional: false,
      href: isSales ? "/dashboard/products" : "/dashboard/services",
      cta: isSales ? "Добавить товары" : "Добавить услуги",
    },
    {
      ...stepMeta("knowledge_base"),
      done: faqCount > 0 || docCount > 0,
      optional: false,
      href: "/dashboard/faq",
      cta: "Загрузить базу знаний",
    },
    {
      ...stepMeta("ai_settings"),
      done: !!business.aiTone || !!business.botDisplayName,
      optional: true,
      href: "/dashboard/bot",
      cta: "Настроить AI",
    },
    {
      ...stepMeta("automations"),
      done: !!automationSettings && (automationSettings.reminder24hEnabled || automationSettings.reviewEnabled),
      optional: true,
      href: "/dashboard/automation",
      cta: "Включить автоматизации",
    },
    {
      ...stepMeta("tested"),
      done: totalConversations > 0,
      optional: false,
      href: "/dashboard/messages",
      cta: "Проверить диалоги",
    },
    {
      ...stepMeta("launched"),
      done: !!business.onboardingCompleted,
      optional: false,
      href: undefined,
      cta: "Отметить как запущенный",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const requiredItems = items.filter((i) => !i.optional);
  const requiredCount = requiredItems.length;
  const doneRequiredCount = requiredItems.filter((i) => i.done).length;
  const nextStep = items.find((i) => !i.done) || null;
  const allDone = doneRequiredCount === requiredCount;

  return {
    items,
    doneCount,
    requiredCount,
    doneRequiredCount,
    nextStep,
    allDone,
    launchedAt: business.onboardingCompleted ? business.updatedAt : null,
  };
}

function stepMeta(key: OnboardingStepKey): { key: OnboardingStepKey; num: number; title: string; description: string } {
  const step = ONBOARDING_STEPS.find((s) => s.key === key);
  if (!step) throw new Error(`Unknown onboarding step key: ${key}`);
  return { key, num: step.num, title: step.title, description: step.description };
}

function emptyProgress(): OnboardingProgress {
  return {
    items: [],
    doneCount: 0,
    requiredCount: 0,
    doneRequiredCount: 0,
    nextStep: null,
    allDone: false,
    launchedAt: null,
  };
}
