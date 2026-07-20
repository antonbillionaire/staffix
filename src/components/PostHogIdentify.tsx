"use client";

/**
 * PostHogIdentify — привязывает анонимного PostHog-посетителя к конкретному
 * User после успешной авторизации.
 *
 * Использование: смонтировать один раз в layout дашборда. Читает session из
 * next-auth и, если посетитель принял cookie-consent + PostHog загружен —
 * зовёт posthog.identify(email, {name, id}).
 *
 * Если консент не дан или PostHog не сконфигурирован — тихо no-op'ит.
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getConsent, onConsentChange } from "@/lib/analytics-consent";

// posthog.js в скрипт-заглушке инициализируется на window — этого достаточно
// чтобы вызвать identify (метод queue'ится до полной загрузки настоящего SDK).
declare global {
  interface Window {
    posthog?: {
      identify: (id: string, props?: Record<string, unknown>) => void;
      reset: () => void;
    };
  }
}

export default function PostHogIdentify() {
  const { data: session } = useSession();

  useEffect(() => {
    const user = session?.user;
    if (!user?.email) return;

    const applyIdentify = () => {
      if (getConsent() !== "accepted") return;
      if (typeof window === "undefined" || !window.posthog) return;
      window.posthog.identify(user.email!, {
        email: user.email,
        name: user.name || undefined,
        userId: user.id || undefined,
      });
    };

    // Пытаемся сразу — если PostHog уже загружен и консент есть.
    applyIdentify();

    // Плюс на случай если пользователь примет консент позже (пока сидит на сайте) —
    // AnalyticsScripts подгрузит PostHog, а мы тут же его identify'ем.
    const off = onConsentChange((v) => {
      if (v === "accepted") {
        // Задержка минимальная — даём Script'у из AnalyticsScripts запуститься.
        setTimeout(applyIdentify, 300);
      } else if (v === "declined" && window.posthog) {
        window.posthog.reset();
      }
    });
    return off;
  }, [session]);

  return null;
}
