/**
 * Канонические шаги онбординга Staffix.
 * Используются:
 *   - Sales-ботом Виктором (SalesLead.onboardingStep) для лидов до и в процессе регистрации
 *   - Dashboard checklist'ом для платящих пользователей после входа в кабинет
 */

export type OnboardingStepKey =
  | "not_started"
  | "registered"
  | "business_profile"
  | "telegram_bot"
  | "extra_channels"
  | "team"
  | "catalog"
  | "knowledge_base"
  | "ai_settings"
  | "automations"
  | "tested"
  | "launched";

export interface OnboardingStep {
  num: number;          // 0-11
  key: OnboardingStepKey;
  title: string;        // короткое название для UI
  description: string;  // что нужно сделать на этом шаге
  victorHint: string;   // как Виктор должен описывать этот шаг лиду
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    num: 0,
    key: "not_started",
    title: "Ещё не начал",
    description: "Лид только узнаёт о Staffix",
    victorHint: "Расскажи о Staffix кратко и предложи начать с регистрации на staffix.io",
  },
  {
    num: 1,
    key: "registered",
    title: "Зарегистрировался",
    description: "Создан аккаунт на staffix.io",
    victorHint: "Лид зарегистрировался. Дальше предложи заполнить профиль бизнеса (название, тип, страна).",
  },
  {
    num: 2,
    key: "business_profile",
    title: "Профиль бизнеса заполнен",
    description: "Указаны название, тип (сервис/продажи), страна, таймзона",
    victorHint: "Профиль заполнен. Дальше — подключить Telegram-бота через @BotFather и вставить токен в Staffix.",
  },
  {
    num: 3,
    key: "telegram_bot",
    title: "Telegram-бот подключён",
    description: "Токен от @BotFather введён в Staffix, webhook зарегистрирован",
    victorHint: "Бот подключён. Напомни что владелец должен сам сделать /start своему боту, чтобы получать уведомления. Дальше — опциональные каналы (WA/IG/FB) или сразу команда.",
  },
  {
    num: 4,
    key: "extra_channels",
    title: "Дополнительные каналы",
    description: "WhatsApp / Instagram / Facebook подключены (опционально)",
    victorHint: "Доп. каналы либо подключены, либо лид решил пока без них. Дальше — добавить команду (Staff).",
  },
  {
    num: 5,
    key: "team",
    title: "Команда добавлена",
    description: "Сотрудники с ролями добавлены, расписание настроено",
    victorHint: "Команда есть. Дальше — наполнить каталог: услуги (для сервиса) или товары (для продаж).",
  },
  {
    num: 6,
    key: "catalog",
    title: "Каталог наполнен",
    description: "Услуги или товары добавлены (вручную или импортом)",
    victorHint: "Каталог готов. Самый важный шаг впереди — загрузить базу знаний (прайс, FAQ, описания), без неё AI отвечает абстрактно.",
  },
  {
    num: 7,
    key: "knowledge_base",
    title: "База знаний загружена",
    description: "PDF/Word/Excel/TXT с прайсом, FAQ, описаниями загружены",
    victorHint: "База знаний загружена — AI стал умнее. Дальше — настроить тон AI и приветственное сообщение.",
  },
  {
    num: 8,
    key: "ai_settings",
    title: "AI настроен",
    description: "Тон, приветствие, имя бота, основной язык выбраны",
    victorHint: "AI настроен. Дальше — включить автоматизации (напоминания, сбор отзывов, реактивация).",
  },
  {
    num: 9,
    key: "automations",
    title: "Автоматизации включены",
    description: "Напоминания за 24ч/2ч, сбор отзывов, реактивация",
    victorHint: "Автоматизации работают. Дальше — протестировать: владелец сам пишет своему боту и смотрит как работает.",
  },
  {
    num: 10,
    key: "tested",
    title: "Протестировано",
    description: "Прошёл тестовый диалог, владелец получил уведомление",
    victorHint: "Тест пройден. Финальный шаг — разместить ссылку на бота на сайте/в bio/в рекламе и начать привлекать клиентов.",
  },
  {
    num: 11,
    key: "launched",
    title: "Запущено",
    description: "Staffix работает в реальных условиях, идут клиенты",
    victorHint: "Staffix запущен. Поддерживай связь — спрашивай как идут дела, предлагай помощь с тарифом если 14 дней триала подходят к концу.",
  },
];

export function getOnboardingStep(num: number | null | undefined): OnboardingStep | null {
  if (num === null || num === undefined) return null;
  return ONBOARDING_STEPS.find((s) => s.num === num) || null;
}

/** Краткий обзор текущего шага для подстановки в системный промпт Виктора. */
export function formatOnboardingContextForVictor(
  step: number | null | undefined,
  notes: string | null | undefined
): string {
  const current = getOnboardingStep(step);
  if (!current) {
    return `Шаг настройки лида: неизвестен (ещё не начали или лид сам не сообщал). Спроси сначала на каком моменте находится — зарегистрирован ли уже на staffix.io?`;
  }
  const next = ONBOARDING_STEPS.find((s) => s.num === current.num + 1);
  const notesLine = notes ? `\nЗаметки по контексту: ${notes}` : "";
  const nextLine = next
    ? `\nСледующий шаг: ${next.num}. ${next.title} — ${next.description}`
    : "\nВсе шаги пройдены — Staffix запущен.";
  return (
    `Шаг настройки лида: ${current.num}/11 — ${current.title}. ` +
    `${current.victorHint}` +
    nextLine +
    notesLine +
    `\n\nКогда лид подтвердит что сделал следующий шаг — вызови tool update_onboarding_step с новым номером.`
  );
}
