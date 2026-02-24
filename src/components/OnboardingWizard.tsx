"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Rocket,
  MessageSquare,
  Scissors,
  Users,
  BookOpen,
  Brain,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface OnboardingStatus {
  botConnected: boolean;
  hasCatalog: boolean;
  hasStaff: boolean;
  hasKnowledge: boolean;
  hasPrompt: boolean;
}

const STEPS = [
  {
    id: "bot",
    title: "Telegram бот",
    desc: "Подключите бота",
    href: "/dashboard/bot",
    key: "botConnected" as keyof OnboardingStatus,
    icon: MessageSquare,
    color: "blue",
  },
  {
    id: "catalog",
    title: "Услуги / товары",
    desc: "Добавьте каталог",
    href: "/dashboard/services",
    key: "hasCatalog" as keyof OnboardingStatus,
    icon: Scissors,
    color: "purple",
  },
  {
    id: "staff",
    title: "Команда",
    desc: "Добавьте сотрудников",
    href: "/dashboard/staff",
    key: "hasStaff" as keyof OnboardingStatus,
    icon: Users,
    color: "pink",
  },
  {
    id: "knowledge",
    title: "База знаний",
    desc: "Загрузите FAQ или файлы",
    href: "/dashboard/faq",
    key: "hasKnowledge" as keyof OnboardingStatus,
    icon: BookOpen,
    color: "orange",
  },
  {
    id: "prompt",
    title: "AI-сотрудник",
    desc: "Настройте промпт",
    href: "/dashboard/bot",
    key: "hasPrompt" as keyof OnboardingStatus,
    icon: Brain,
    color: "green",
  },
];

export default function OnboardingWizard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden, show after fetch
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem("onboarding_dismissed") === "true";
    const isCollapsed = localStorage.getItem("onboarding_collapsed") === "true";

    if (isDismissed) {
      setDismissed(true);
      setLoading(false);
      return;
    }

    setCollapsed(isCollapsed);

    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data: OnboardingStatus) => {
        setStatus(data);
        setDismissed(false);
      })
      .catch(() => setDismissed(true))
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("onboarding_dismissed", "true");
    setDismissed(true);
  };

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("onboarding_collapsed", String(next));
  };

  if (loading || dismissed || !status) return null;

  const completedCount = STEPS.filter((s) => status[s.key]).length;
  const allDone = completedCount === STEPS.length;
  const progress = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div
      className={`mx-4 md:mx-8 mt-4 rounded-2xl border overflow-hidden transition-all ${
        isDark
          ? "bg-[#12122a] border-white/10"
          : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        {/* Icon */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
            allDone ? "bg-green-500/20" : "bg-blue-500/20"
          }`}
        >
          <Rocket
            className={`h-4 w-4 ${allDone ? "text-green-400" : "text-blue-400"}`}
          />
        </div>

        {/* Title + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {allDone
                ? "🎉 Staffix полностью настроен!"
                : `Настройка Staffix — ${completedCount} из ${STEPS.length} шагов`}
            </span>
            <span
              className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                allDone
                  ? "bg-green-500/20 text-green-400"
                  : isDark
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              {progress}%
            </span>
          </div>
          {/* Mini progress bar */}
          <div
            className={`mt-1.5 h-1 rounded-full ${
              isDark ? "bg-white/10" : "bg-gray-100"
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                allDone
                  ? "bg-green-500"
                  : "bg-gradient-to-r from-blue-500 to-purple-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleToggle}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            title={collapsed ? "Развернуть" : "Свернуть"}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleDismiss}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }`}
            title="Скрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Steps grid — shown when expanded */}
      {!collapsed && (
        <div
          className={`px-5 pb-4 grid grid-cols-1 sm:grid-cols-5 gap-2 border-t ${
            isDark ? "border-white/5" : "border-gray-100"
          }`}
          style={{ paddingTop: "12px" }}
        >
          {STEPS.map((step, idx) => {
            const done = status[step.key];
            const Icon = step.icon;

            return (
              <Link
                key={step.id}
                href={step.href}
                className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  done
                    ? isDark
                      ? "bg-green-500/10 border border-green-500/30"
                      : "bg-green-50 border border-green-200"
                    : isDark
                    ? "bg-white/3 border border-white/8 hover:bg-white/8 hover:border-white/15"
                    : "bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                {/* Step number or checkmark */}
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done
                      ? "bg-green-500 text-white"
                      : isDark
                      ? "bg-white/10 text-gray-400 group-hover:bg-blue-500/30 group-hover:text-blue-300"
                      : "bg-gray-200 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </span>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-xs font-semibold truncate ${
                      done
                        ? isDark
                          ? "text-green-400"
                          : "text-green-700"
                        : isDark
                        ? "text-gray-300 group-hover:text-white"
                        : "text-gray-600 group-hover:text-gray-900"
                    }`}
                  >
                    {step.title}
                  </p>
                  {!done && (
                    <p
                      className={`text-[10px] truncate mt-0.5 ${
                        isDark ? "text-gray-500" : "text-gray-400"
                      }`}
                    >
                      {step.desc}
                    </p>
                  )}
                </div>

                {/* Icon */}
                <Icon
                  className={`h-4 w-4 flex-shrink-0 ${
                    done
                      ? isDark
                        ? "text-green-400"
                        : "text-green-600"
                      : isDark
                      ? "text-gray-500 group-hover:text-blue-400"
                      : "text-gray-400 group-hover:text-blue-500"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
