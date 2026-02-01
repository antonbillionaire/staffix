// Unified plan configuration for Staffix
// This is the single source of truth for all plan-related data

export type PlanId = "trial" | "pro" | "business";

export interface PlanFeatures {
  // Limits
  messagesLimit: number;
  aiEmployeesLimit: number;

  // Features
  basicAnalytics: boolean;
  fullAnalytics: boolean;
  exportAnalytics: boolean;
  customLogo: boolean;
  fileUpload: boolean;
  automations: boolean;
  prioritySupport: boolean;
  personalManager: boolean;

  // Support response time
  supportResponseHours: number | null; // null = standard (24-48h)
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

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Пробный",
    description: "14 дней бесплатно — все функции Pro",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      // Trial = все функции Pro на 14 дней
      messagesLimit: 500,
      aiEmployeesLimit: 1,
      basicAnalytics: true,
      fullAnalytics: true,
      exportAnalytics: false,
      customLogo: true,
      fileUpload: true,
      automations: true,
      prioritySupport: false,
      personalManager: false,
      supportResponseHours: null,
    },
    featuresList: [
      "14 дней бесплатно",
      "Все функции Pro плана",
      "500 сообщений",
      "Полная аналитика",
      "Автоматизации",
      "Загрузка файлов",
    ],
    isTrial: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Для малого и среднего бизнеса",
    monthlyPrice: 50,
    yearlyPrice: 480,
    features: {
      messagesLimit: 500,
      aiEmployeesLimit: 1,
      basicAnalytics: true,
      fullAnalytics: true,
      exportAnalytics: false,
      customLogo: true,
      fileUpload: true,
      automations: true,
      prioritySupport: true,
      personalManager: false,
      supportResponseHours: 4,
    },
    featuresList: [
      "500 сообщений в месяц",
      "1 AI-сотрудник",
      "Полная аналитика",
      "Загрузка файлов для обучения",
      "Приоритетная поддержка (2-4ч)",
      "Загрузка собственного логотипа",
      "Автоматизации (напоминания, отзывы)",
      "Интеграция с Telegram",
    ],
    popular: true,
  },
  business: {
    id: "business",
    name: "Business",
    description: "Для растущих компаний",
    monthlyPrice: 100,
    yearlyPrice: 960,
    features: {
      messagesLimit: 999999, // Unlimited
      aiEmployeesLimit: 2,
      basicAnalytics: true,
      fullAnalytics: true,
      exportAnalytics: true,
      customLogo: true,
      fileUpload: true,
      automations: true,
      prioritySupport: true,
      personalManager: true,
      supportResponseHours: 2,
    },
    featuresList: [
      "Безлимит сообщений",
      "2 AI-сотрудника",
      "Полная аналитика + экспорт",
      "Персональный менеджер",
      "Приоритетная поддержка (до 2ч)",
      "Загрузка собственного логотипа",
      "Все автоматизации",
      "Все интеграции",
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

export function isFeatureAvailable(planId: string, feature: keyof PlanFeatures): boolean {
  const features = getPlanFeatures(planId);
  return !!features[feature];
}

export function getMessagesLimit(planId: string): number {
  return getPlanFeatures(planId).messagesLimit;
}

// Feature check helpers for specific features
export function canUseAutomations(planId: string): boolean {
  return isFeatureAvailable(planId, "automations");
}

export function canUploadLogo(planId: string): boolean {
  return isFeatureAvailable(planId, "customLogo");
}

export function canUploadFiles(planId: string): boolean {
  return isFeatureAvailable(planId, "fileUpload");
}

export function canExportAnalytics(planId: string): boolean {
  return isFeatureAvailable(planId, "exportAnalytics");
}

export function hasFullAnalytics(planId: string): boolean {
  return isFeatureAvailable(planId, "fullAnalytics");
}

// Dashboard menu items configuration
export interface MenuItem {
  name: string;
  href: string;
  icon: string; // Icon name from lucide-react
  requiredPlan?: PlanId; // Minimum plan required, undefined = available to all
  badge?: string; // Optional badge text like "Pro"
}

export const DASHBOARD_MENU: MenuItem[] = [
  { name: "Главная", href: "/dashboard", icon: "LayoutDashboard" },
  { name: "AI-сотрудник", href: "/dashboard/bot", icon: "Brain" },
  { name: "Статистика", href: "/dashboard/statistics", icon: "BarChart3" },
  { name: "Услуги", href: "/dashboard/services", icon: "Scissors" },
  { name: "Команда", href: "/dashboard/staff", icon: "Users" },
  { name: "База знаний", href: "/dashboard/faq", icon: "FileText" },
  { name: "Записи", href: "/dashboard/bookings", icon: "Calendar" },
  { name: "Автоматизация", href: "/dashboard/automation", icon: "Zap", requiredPlan: "pro", badge: "Pro" },
  { name: "Сообщения", href: "/dashboard/messages", icon: "Mail" },
  { name: "Настройки", href: "/dashboard/settings", icon: "Settings" },
  { name: "Помощь", href: "/dashboard/support", icon: "HelpCircle" },
];

// Check if user has access to a menu item
export function hasMenuAccess(userPlan: PlanId, requiredPlan?: PlanId): boolean {
  if (!requiredPlan) return true;

  const planOrder: PlanId[] = ["trial", "pro", "business"];
  const userPlanIndex = planOrder.indexOf(userPlan);
  const requiredPlanIndex = planOrder.indexOf(requiredPlan);

  return userPlanIndex >= requiredPlanIndex;
}

// Get available menu items for a user's plan
export function getAvailableMenuItems(userPlan: PlanId): MenuItem[] {
  return DASHBOARD_MENU.filter(item => hasMenuAccess(userPlan, item.requiredPlan));
}

// Get locked menu items for upgrade prompts
export function getLockedMenuItems(userPlan: PlanId): MenuItem[] {
  return DASHBOARD_MENU.filter(item => !hasMenuAccess(userPlan, item.requiredPlan));
}
