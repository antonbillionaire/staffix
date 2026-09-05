"use client";

import { useEffect, useState } from "react";

/**
 * Возвращает true когда пользователь скроллит ВНИЗ и надо спрятать
 * плавающий элемент (FAB, sticky панель). Возвращает false когда:
 *  - страница около верха (y < THRESHOLD_TOP)
 *  - юзер скроллит вверх
 *
 * Добавлено 5 сентября 2026 по запросу Anton'а — floating-кнопки чата
 * поддержки и AI-помощника перекрывали формы на мобиле. Автоскрытие
 * при скролле — классический FAB-паттерн (Material Design guidance).
 *
 * Пороги подобраны консервативно:
 *  - THRESHOLD_TOP = 100 px — на первой прокрутке кнопки видны, не мигают
 *  - DELTA = 6 px — микро-джиттер тач-скролла игнорируется, срабатывает
 *    только реальное направленное движение
 *
 * Работает и на десктопе, и на мобиле — везде оба FAB'а могут мешать.
 */
const THRESHOLD_TOP = 100;
const DELTA = 6;

export function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;

      // Около верха страницы — всегда показываем.
      if (y < THRESHOLD_TOP) {
        setHidden(false);
        lastY = y;
        return;
      }

      const dy = y - lastY;
      if (dy > DELTA) {
        setHidden(true);
        lastY = y;
      } else if (dy < -DELTA) {
        setHidden(false);
        lastY = y;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
