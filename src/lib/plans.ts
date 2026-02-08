// Unified plan configuration for Staffix
// This is the single source of truth for all plan-related data

export type PlanId = "trial" | "starter" | "pro" | "business" | "enterprise";

export interface PlanFeatures {
  // Limits
  messagesLimit: number;
  aiEmployeesLimit: number;

  // All plans have same features
  analytics: boolean;
  customLogo: boolean;
  fileUpload: boolean;
  automations: boolean;
  crm: boolean;
  broadcasts: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: PlanFeatures;
  featuresList: string[]; // For display on pricing page
  popular?: boolean;
  isTrial?: boolean;
}

// Message pack add-ons
export interface MessagePack {
  id: string;
  name: string;
  messages: number;
  price: number;
  pricePerMessage: number;
}

export const MESSAGE_PACKS: MessagePack[] = [
  { id: "pack_100", name: "+100 сообщений", messages: 100, price: 5, pricePerMessage: 0.05 },
  { id: "pack_500", name: "+500 сообщений", messages: 500, price: 20, pricePerMessage: 0.04 },
  { id: "pack_1000", name: "+1000 сообщений", messages: 1000, price: 35, pricePerMessage: 0.035 },
];

// All features available to all plans
const ALL_FEATURES: PlanFeatures = {
  messagesLimit: 0, // Will be overwritten per plan
  aiEmployeesLimit: 1,
  analytics: true,
  customLogo: true,
  fileUpload: true,
  automations: true,
  crm: true,
  broadcasts: true,
};

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Пробный",
    description: "14 дней бесплатно — все функции",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      ...ALL_FEATURES,
      messagesLimit: 100,
    },
    featuresList: [
      "14 дней бесплатно",
      "100 сообщений",
      "Все функции платных планов",
    ],
    isTrial: true,
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "Идеален для индивидуальных мастеров и фрилансеров",
    monthlyPrice: 20,
    yearlyPrice: 192,
    features: {
      ...ALL_FEATURES,
      messagesLimit: 200,
    },
    featuresList: [
      "200 сообщений в месяц",
      "AI-сотрудник 24/7",
      "Онлайн-запись клиентов",
      "CRM с базой клиентов",
      "Рассылки в Telegram",
      "Автоматические напоминания",
      "Сбор отзывов",
      "Реактивация клиентов",
      "Аналитика и статистика",
      "Управление услугами",
      "Управление сотрудниками",
      "База знаний для AI",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Для салонов, клиник и растущих бизнесов",
    monthlyPrice: 45,
    yearlyPrice: 432,
    features: {
      ...ALL_FEATURES,
      messagesLimit: 1000,
    },
    featuresList: [
      "1 000 сообщений в месяц",
      "AI-сотрудник 24/7",
      "Онлайн-запись клиентов",
      "CRM с базой клиентов",
      "Рассылки в Telegram",
      "Автоматические напоминания",
      "Сбор отзывов",
      "Реактивация клиентов",
      "Аналитика и статистика",
      "Управление услугами",
      "Управление сотрудниками",
      "База знаний для AI",
    ],
    popular: true,
  },
  business: {
    id: "business",
    name: "Business",
    description: "Для компаний с большим потоком клиентов",
    monthlyPrice: 95,
    yearlyPrice: 912,
    features: {
      ...ALL_FEATURES,
      messagesLimit: 3000,
    },
    featuresList: [
      "3 000 сообщений в месяц",
      "AI-сотрудник 24/7",
      "Онлайн-запись клиентов",
      "CRM с базой клиентов",
      "Рассылки в Telegram",
      "Автоматические напоминания",
      "Сбор отзывов",
      "Реактивация клиентов",
      "Аналитика и статистика",
      "Управление услугами",
      "Управление сотрудниками",
      "База знаний для AI",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Для сетей и крупного бизнеса — без ограничений",
    monthlyPrice: 180,
    yearlyPrice: 1730,
    features: {
      ...ALL_FEATURES,
      messagesLimit: 999999, // Unlimited
    },
    featuresList: [
      "Безлимит сообщений",
      "AI-сотрудник 24/7",
      "Онлайн-запись клиентов",
      "CRM с базой клиентов",
      "Рассылки в Telegram",
      "Автоматические напоминания",
      "Сбор отзывов",
      "Реактивация клиентов",
      "Аналитика и статистика",
      "Управление услугами",
      "Управление сотрудниками",
      "База знаний для AI",
    ],
  },
};

// Helper functions
export function getPlan(planId: string): Plan {
  return PLANS[planId as PlanId] || PLANS.trial;
}

export function getPlanFeatures(planId: string): PlanFeatures {
  return getPlan(planId).features;
}

export function getMessagesLimit(planId: string): number {
  return getPlanFeatures(planId).messagesLimit;
}

export function isUnlimited(planId: string): boolean {
  return getMessagesLimit(planId) >= 999999;
}

// All plans have the same features, only difference is message limits
export function hasMenuAccess(_userPlan: PlanId, _requiredPlan?: PlanId): boolean {
  // All plans have access to all features
  return true;
}

// For backwards compatibility - all plans have all features
export function canUseAutomations(_planId: string): boolean {
  return true;
}

export function canUploadLogo(_planId: string): boolean {
  return true;
}

export function canUploadFiles(_planId: string): boolean {
  return true;
}

export function canExportAnalytics(_planId: string): boolean {
  return true;
}

export function hasFullAnalytics(_planId: string): boolean {
  return true;
}
