/**
 * Analytics consent — единый источник правды о том, разрешил ли посетитель
 * загрузку сторонних скриптов аналитики (GA4, Meta Pixel, PostHog).
 *
 * ПОЧЕМУ отдельный модуль:
 *   - CookieConsent-баннер и AnalyticsScripts-загрузчик должны общаться через
 *     событие, а не через прямой prop-drilling — они разные branch of tree.
 *   - localStorage читаем только на клиенте — SSR-safe.
 *
 * КОГДА трекаем:
 *   - accepted → скрипты грузятся, страничные хиты идут, PostHog identify
 *   - declined | null → ничего не грузим, никаких запросов на .google/.meta/.posthog
 */

export type ConsentValue = "accepted" | "declined" | null;

const STORAGE_KEY = "cookie-consent";
const STORAGE_DATE_KEY = "cookie-consent-date";
const EVENT_NAME = "staffix:cookie-consent-changed";

/**
 * Читает текущее значение согласия. Только в браузере.
 */
export function getConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "accepted" || v === "declined") return v;
  return null;
}

/**
 * Ставит согласие в localStorage и рассылает событие всем слушателям
 * в тек. вкладке — чтобы AnalyticsScripts мог сразу подгрузить/сбросить.
 */
export function setConsent(value: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
  window.localStorage.setItem(STORAGE_DATE_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
}

/**
 * Подписаться на изменения согласия (в этой же вкладке).
 * Возвращает cleanup-функцию.
 */
export function onConsentChange(cb: (value: ConsentValue) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as "accepted" | "declined";
    cb(detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
