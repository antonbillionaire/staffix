/**
 * Какие инсайты владелец может превратить в FAQ (17 сентября 2026).
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ. До этого список был продублирован: страница
 * `/dashboard/ai-learning` решала, показывать ли кнопку, а `/api/insights`
 * отдельно решал, создавать ли FAQ. Совпадали они случайно и разошлись:
 * кнопка и создание работали только для `faq_suggestion`, а у OLLEE все шесть
 * инсайтов — `escalation_pattern`. Владелец видел «бот часто передаёт
 * менеджеру: какова цена товара» и мог только отклонить.
 *
 * Итог по всей базе: 0 FAQ у OLLEE, 3 коррекции на все бизнесы. Научить бота
 * было физически нечем.
 *
 * Все три типа ниже значат одно и то же — бот не смог ответить — и несут
 * `data.question`, на который владелец может дать ответ.
 */
export const TEACHABLE_INSIGHT_TYPES = [
  /** Клиенты часто спрашивают, а ответа в базе знаний нет */
  "faq_suggestion",
  /** Бот регулярно эскалирует однотипный вопрос вместо ответа */
  "escalation_pattern",
  /** Бот регулярно отвечает «не знаю» */
  "dont_know_pattern",
] as const;

export type TeachableInsightType = (typeof TEACHABLE_INSIGHT_TYPES)[number];

export function isTeachableInsight(type: string | null | undefined): boolean {
  return !!type && (TEACHABLE_INSIGHT_TYPES as readonly string[]).includes(type);
}
