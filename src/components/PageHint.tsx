"use client";

/**
 * <PageHint id="services" /> — contextual banner на странице.
 *
 * Тексты и авто-детекция выполнения — в src/lib/onboarding-hints.ts.
 * Компонент только рендерит + слушает состояние + скрывает.
 *
 * Логика показа:
 *   1. Fetch /api/onboarding/hints-state (кэш 30 сек — safe для клика)
 *   2. Если state.done ИЛИ state.dismissed → не рендерим ничего
 *   3. Иначе — красивый баннер с заголовком, описанием, инструкцией и
 *      кнопкой «Понятно, скрыть»
 *
 * Fail-safe: если API упал — не рендерим ничего (не хочу видеть в дашборде
 * "loading hint..." или сообщение об ошибке — контекстный баннер это
 * приятное дополнение, а не критичный UI).
 */

import { useState, useEffect } from "react";
import { X, Info } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { HINTS, type PageHintId } from "@/lib/onboarding-hints";

interface HintState {
  states: Record<string, { done: boolean; dismissed: boolean }>;
}

let cachedState: HintState | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

async function fetchHintsState(): Promise<HintState | null> {
  const now = Date.now();
  if (cachedState && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedState;
  }
  try {
    const res = await fetch("/api/onboarding/hints-state");
    if (!res.ok) return null;
    const data = (await res.json()) as HintState;
    cachedState = data;
    cacheTimestamp = now;
    return data;
  } catch {
    return null;
  }
}

/** Инвалидирует кэш — вызывать после dismiss или значимых мутаций. */
function invalidateHintsCache() {
  cachedState = null;
  cacheTimestamp = 0;
}

/**
 * Минимальный markdown-парсер: **bold**, `code`, \n → <br>. Без внешних
 * зависимостей чтобы не тащить react-markdown ради 3 фич.
 */
function renderMarkdown(text: string): React.ReactNode {
  // Разбиваем на строки, каждую строку рендерим отдельно
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Обрабатываем **bold** и `code` внутри строки
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const codeMatch = remaining.match(/`([^`]+)`/);
      const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
      const codeIdx = codeMatch ? remaining.indexOf(codeMatch[0]) : -1;
      const useBold = boldIdx !== -1 && (codeIdx === -1 || boldIdx < codeIdx);
      const useCode = !useBold && codeIdx !== -1;
      if (useBold && boldMatch) {
        if (boldIdx > 0) parts.push(remaining.substring(0, boldIdx));
        parts.push(<strong key={`b${i}-${key++}`}>{boldMatch[1]}</strong>);
        remaining = remaining.substring(boldIdx + boldMatch[0].length);
      } else if (useCode && codeMatch) {
        if (codeIdx > 0) parts.push(remaining.substring(0, codeIdx));
        parts.push(
          <code
            key={`c${i}-${key++}`}
            className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.9em] font-mono"
          >
            {codeMatch[1]}
          </code>
        );
        remaining = remaining.substring(codeIdx + codeMatch[0].length);
      } else {
        parts.push(remaining);
        remaining = "";
      }
    }
    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

interface Props {
  id: PageHintId;
}

export default function PageHint({ id }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const hint = HINTS[id];

  useEffect(() => {
    let cancelled = false;
    fetchHintsState().then((state) => {
      if (cancelled) return;
      const s = state?.states[id];
      // Показываем только если !done И !dismissed. Пока грузим — не рендерим
      // (loaded=false), чтобы не мигать баннером у уже настроенных клиентов.
      setVisible(!!s && !s.done && !s.dismissed);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDismiss() {
    setDismissing(true);
    // Оптимистично прячем — визуально мгновенно, request в фоне.
    setVisible(false);
    invalidateHintsCache();
    try {
      await fetch("/api/onboarding/dismiss-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id }),
      });
    } catch {
      // Если не удалось сохранить — при следующем открытии страницы
      // баннер вернётся. Не критично.
    }
    setDismissing(false);
  }

  if (!loaded || !visible || !hint) return null;

  const bg = isDark
    ? "bg-blue-950/40 border-blue-500/30"
    : "bg-blue-50 border-blue-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-300" : "text-gray-700";

  return (
    <div
      className={`${bg} border rounded-xl p-4 md:p-5 mb-4 relative animate-in fade-in duration-300`}
    >
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label="Скрыть подсказку"
        className={`absolute top-3 right-3 ${textSecondary} hover:${textPrimary} opacity-60 hover:opacity-100 transition-opacity`}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Info className="h-4 w-4 text-blue-500" />
          </div>
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <h3 className={`text-base font-semibold ${textPrimary} mb-1.5`}>
            {hint.title}
          </h3>
          <p className={`text-sm ${textSecondary} mb-2 leading-relaxed`}>
            {renderMarkdown(hint.description)}
          </p>
          {hint.howTo && (
            <div className={`text-sm ${textSecondary} leading-relaxed`}>
              <span className={`font-medium ${textPrimary}`}>Как: </span>
              {renderMarkdown(hint.howTo)}
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className={`text-xs ${textSecondary} hover:${textPrimary} underline underline-offset-2 opacity-70 hover:opacity-100 disabled:opacity-40`}
            >
              Понятно, скрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
