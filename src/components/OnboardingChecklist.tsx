"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { CheckCircle2, Circle, ChevronUp, ChevronDown, X, Sparkles, ArrowRight, Rocket } from "lucide-react";
import type { OnboardingProgress, ChecklistItem } from "@/lib/onboarding-progress";

const DISMISS_KEY = "staffix_checklist_dismissed_until";
const COLLAPSED_KEY = "staffix_checklist_collapsed";

export default function OnboardingChecklist() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();

  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedToday, setDismissedToday] = useState(false);
  const [marking, setMarking] = useState(false);

  // Загружаем прогресс при монтировании и при смене страницы
  // (после ~любого действия пользователя статус мог измениться)
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/progress");
      if (!res.ok) return;
      const data: OnboardingProgress = await res.json();
      setProgress(data);
    } catch {
      // тихо — это не критическая фича, не показываем ошибку пользователю
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress, pathname]);

  useEffect(() => {
    // Восстанавливаем состояние свёрнутости и dismiss
    if (typeof window === "undefined") return;
    const collapsedStr = localStorage.getItem(COLLAPSED_KEY);
    if (collapsedStr === "1") setCollapsed(true);
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      setDismissedToday(true);
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  };

  const dismissForToday = () => {
    // 12 часов
    const until = Date.now() + 12 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissedToday(true);
  };

  const markLaunched = async () => {
    setMarking(true);
    try {
      const res = await fetch("/api/onboarding/progress", { method: "POST", body: JSON.stringify({ completed: true }) });
      if (res.ok) {
        const data: OnboardingProgress = await res.json();
        setProgress(data);
      }
    } finally {
      setMarking(false);
    }
  };

  // Не показываем пока загружается / нет данных / dismissed / онбординг полностью завершён
  if (loading || !progress) return null;
  if (dismissedToday) return null;
  // Если все обязательные пройдены И пользователь явно нажал «Запустил» — скрываем навсегда
  if (progress.allDone && progress.launchedAt) return null;

  const requiredProgress = progress.requiredCount > 0
    ? Math.round((progress.doneRequiredCount / progress.requiredCount) * 100)
    : 0;

  const cardBg = isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200";
  const cardText = isDark ? "text-white" : "text-gray-900";
  const cardSubtext = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <div className={`mb-6 rounded-xl border ${cardBg} overflow-hidden`}>
      {/* Заголовок (всегда виден) */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? "bg-blue-500/20" : "bg-blue-50"}`}>
          {progress.allDone ? (
            <Rocket className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
          ) : (
            <Sparkles className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold ${cardText} text-sm`}>
            {progress.allDone
              ? "Всё готово к запуску!"
              : `Запустите Staffix за ${progress.requiredCount} шагов`}
          </div>
          <div className={`text-xs ${cardSubtext} truncate`}>
            {progress.allDone
              ? "Осталось отметить запуск"
              : `${progress.doneRequiredCount} из ${progress.requiredCount} выполнено`}
            {progress.nextStep && !progress.allDone && (
              <> · следующий шаг: <span className={isDark ? "text-blue-300" : "text-blue-600"}>{progress.nextStep.title}</span></>
            )}
          </div>
        </div>

        {/* Прогресс-бар (мини) */}
        <div className="hidden sm:flex items-center gap-2 mr-2">
          <div className={`w-32 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${requiredProgress}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${cardSubtext} tabular-nums`}>{requiredProgress}%</span>
        </div>

        <button
          onClick={toggleCollapsed}
          className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} ${cardSubtext}`}
          aria-label={collapsed ? "Развернуть" : "Свернуть"}
          title={collapsed ? "Развернуть" : "Свернуть"}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <button
          onClick={dismissForToday}
          className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} ${cardSubtext}`}
          aria-label="Скрыть на сегодня"
          title="Скрыть на сегодня"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Список шагов (свёрнут или развёрнут) */}
      {!collapsed && (
        <div className={`border-t ${isDark ? "border-white/10" : "border-gray-100"} divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
          {progress.items.map((item) => (
            <ChecklistRow key={item.key} item={item} isDark={isDark} />
          ))}
          {progress.allDone && !progress.launchedAt && (
            <div className="px-4 py-4 flex items-center gap-3">
              <Rocket className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
              <div className="flex-1">
                <div className={`text-sm font-medium ${cardText}`}>Готовы запустить Staffix?</div>
                <div className={`text-xs ${cardSubtext}`}>Все обязательные шаги пройдены — поздравляем!</div>
              </div>
              <button
                onClick={markLaunched}
                disabled={marking}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {marking ? "Сохраняем…" : "Я запустил Staffix"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistRow({ item, isDark }: { item: ChecklistItem; isDark: boolean }) {
  const titleClass = item.done
    ? `${isDark ? "text-gray-400" : "text-gray-500"} line-through`
    : isDark
      ? "text-white"
      : "text-gray-900";
  const descClass = isDark ? "text-gray-400" : "text-gray-500";
  const optionalLabel = item.optional && !item.done
    ? <span className={`text-[10px] uppercase tracking-wide font-medium ml-2 px-1.5 py-0.5 rounded ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"}`}>опционально</span>
    : null;

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {item.done ? (
          <CheckCircle2 className={`w-5 h-5 ${isDark ? "text-green-400" : "text-green-500"}`} />
        ) : (
          <Circle className={`w-5 h-5 ${isDark ? "text-gray-500" : "text-gray-300"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${titleClass}`}>
          {item.num}. {item.title}
          {optionalLabel}
        </div>
        <div className={`text-xs ${descClass}`}>{item.description}</div>
      </div>
      {!item.done && item.href && item.cta && (
        <Link
          href={item.href}
          className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
            isDark ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
          } transition-colors`}
        >
          {item.cta}
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
