"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Brain,
  ThumbsDown,
  Lightbulb,
  Users,
  Trash2,
  Check,
  X,
  Loader2,
  UserCog,
  HelpCircle,
  Languages,
} from "lucide-react";

interface BotCorrection {
  id: string;
  originalQuestion: string;
  wrongAnswer: string;
  correctAnswer: string;
  usageCount: number;
  isActive: boolean;
}

interface AiInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  data?: {
    question?: string;
    answer?: string;
    examples?: string[];
    frequency?: number;
  } | null;
}

type Tab = "corrections" | "insights" | "profiles";
type InsightStatus = "new" | "accepted" | "dismissed";

export default function AiLearningPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<Tab>("insights");
  const [corrections, setCorrections] = useState<BotCorrection[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightFilter, setInsightFilter] = useState<InsightStatus>("new");
  // Состояние формы для принятия инсайта как FAQ:
  // ключ — id инсайта, значение — { question, answer, saving }
  const [editingInsights, setEditingInsights] = useState<
    Record<string, { question: string; answer: string; saving: boolean }>
  >({});

  // Theme classes
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "insights") {
      loadInsights();
    }
  }, [insightFilter, activeTab]);

  const loadData = async () => {
    try {
      const res = await fetch("/api/corrections");
      if (res.ok) {
        const data = await res.json();
        setCorrections(data.corrections || []);
      }
    } catch (error) {
      console.error("Error loading corrections:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    try {
      const res = await fetch(`/api/insights?status=${insightFilter}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error("Error loading insights:", error);
    }
  };

  const deleteCorrection = async (id: string) => {
    try {
      const res = await fetch(`/api/corrections/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCorrections(corrections.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error("Error deleting correction:", error);
    }
  };

  const toggleCorrection = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/corrections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        setCorrections(
          corrections.map((c) =>
            c.id === id ? { ...c, isActive: !isActive } : c
          )
        );
      }
    } catch (error) {
      console.error("Error toggling correction:", error);
    }
  };

  const dismissInsight = async (id: string) => {
    try {
      const res = await fetch(`/api/insights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "dismissed" }),
      });
      if (res.ok) {
        setInsights(insights.filter((i) => i.id !== id));
      }
    } catch (error) {
      console.error("Error dismissing insight:", error);
    }
  };

  const startEditingInsight = (insight: AiInsight) => {
    setEditingInsights((prev) => ({
      ...prev,
      [insight.id]: {
        question: insight.data?.question || "",
        answer: insight.data?.answer || "",
        saving: false,
      },
    }));
  };

  const cancelEditingInsight = (id: string) => {
    setEditingInsights((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const acceptInsightAsFaq = async (id: string) => {
    const form = editingInsights[id];
    if (!form) return;
    if (!form.question.trim() || !form.answer.trim()) {
      alert("Заполните вопрос и ответ перед сохранением");
      return;
    }
    setEditingInsights((prev) => ({
      ...prev,
      [id]: { ...form, saving: true },
    }));
    try {
      const res = await fetch(`/api/insights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "accepted",
          question: form.question,
          answer: form.answer,
        }),
      });
      if (res.ok) {
        setInsights(insights.filter((i) => i.id !== id));
        cancelEditingInsight(id);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Не удалось сохранить FAQ");
        setEditingInsights((prev) => ({
          ...prev,
          [id]: { ...form, saving: false },
        }));
      }
    } catch (error) {
      console.error("Error accepting insight:", error);
      setEditingInsights((prev) => ({
        ...prev,
        [id]: { ...form, saving: false },
      }));
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "suggestion":
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      case "warning":
        return <ThumbsDown className="h-5 w-5 text-red-500" />;
      // Sprint 4C: 4 типа генерируем в insights-generator.ts
      case "faq_suggestion":
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      case "escalation_pattern":
        return <UserCog className="h-5 w-5 text-orange-500" />;
      case "dont_know_pattern":
        return <HelpCircle className="h-5 w-5 text-red-500" />;
      case "language_gap":
        return <Languages className="h-5 w-5 text-blue-500" />;
      default:
        return <Brain className="h-5 w-5 text-purple-500" />;
    }
  };

  // Insights tab включён — генератор работает через cron /api/cron/insights-weekly
  // (раз в неделю, понедельник 9:00 UTC). При создании новых инсайтов владелец
  // получает уведомление в Telegram + бейдж в дашборде.
  const tabs: { key: Tab; labelKey: string; icon: typeof Brain }[] = [
    { key: "insights", labelKey: "aiLearning.insights", icon: Lightbulb },
    { key: "corrections", labelKey: "aiLearning.corrections", icon: ThumbsDown },
    { key: "profiles", labelKey: "aiLearning.clientProfiles", icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary}`}>
          {t("aiLearning.title")}
        </h1>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? isDark
                    ? "bg-white/10 text-white"
                    : "bg-white text-gray-900 shadow-sm"
                  : isDark
                  ? "text-gray-400 hover:text-gray-300"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "corrections" && (
        <section>
          <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
            {corrections.length === 0 ? (
              <div className="p-8 text-center">
                <ThumbsDown className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                <p className={textSecondary}>{t("aiLearning.noCorrections")}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {corrections.map((correction) => (
                  <div
                    key={correction.id}
                    className="p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <p className={`font-medium ${textPrimary}`}>
                          {correction.originalQuestion}
                        </p>
                        <p className={`text-sm line-through ${isDark ? "text-red-400/60" : "text-red-500/60"}`}>
                          {correction.wrongAnswer}
                        </p>
                        <p className={`text-sm ${isDark ? "text-green-400" : "text-green-600"}`}>
                          {correction.correctAnswer}
                        </p>
                        {correction.usageCount > 0 && (
                          <p className={`text-xs ${textSecondary}`}>
                            {t("aiLearning.usedTimes", { count: correction.usageCount })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {/* Active toggle */}
                        <button
                          onClick={() => toggleCorrection(correction.id, correction.isActive)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            correction.isActive
                              ? "bg-green-500"
                              : isDark
                              ? "bg-white/10"
                              : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              correction.isActive ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => deleteCorrection(correction.id)}
                          className={`${textSecondary} hover:text-red-500 p-2 transition-colors`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "insights" && (
        <section className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2">
            {(["new", "accepted", "dismissed"] as InsightStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setInsightFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  insightFilter === status
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    : isDark
                    ? "bg-white/5 text-gray-400 hover:bg-white/10"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {status === "new" && t("aiLearning.statusNew")}
                {status === "accepted" && t("aiLearning.statusAccepted")}
                {status === "dismissed" && t("aiLearning.statusDismissed")}
              </button>
            ))}
          </div>

          <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
            {insights.length === 0 ? (
              <div className="p-8 text-center">
                <Lightbulb className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                <p className={textSecondary}>{t("aiLearning.noInsights")}</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {insights.map((insight) => {
                  const editing = editingInsights[insight.id];
                  const isFaqType = insight.type === "faq_suggestion";
                  const examples = insight.data?.examples || [];
                  return (
                    <div
                      key={insight.id}
                      className="p-4 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="mt-0.5 flex-shrink-0">
                            {getInsightIcon(insight.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${textPrimary}`}>
                              {insight.title}
                            </p>
                            <p className={`text-sm ${textSecondary} mt-1`}>
                              {insight.description}
                            </p>
                            {examples.length > 0 && !editing && (
                              <div className={`mt-2 text-xs ${textSecondary}`}>
                                <div className="font-medium mb-1">Примеры из переписки:</div>
                                <ul className="space-y-1 pl-3">
                                  {examples.slice(0, 3).map((ex, i) => (
                                    <li key={i} className="italic">
                                      «{ex}»
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        {insightFilter === "new" && !editing && (
                          <div className="flex gap-1 flex-shrink-0">
                            {isFaqType && (
                              <button
                                onClick={() => startEditingInsight(insight)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                              >
                                Заполнить и принять
                              </button>
                            )}
                            <button
                              onClick={() => dismissInsight(insight.id)}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Не актуально"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Inline-форма для создания FAQ из инсайта */}
                      {editing && (
                        <div className="mt-4 ml-8 space-y-3 p-4 rounded-lg border border-white/10 bg-white/5">
                          <div>
                            <label className={`text-xs font-medium ${textSecondary} block mb-1`}>
                              Вопрос (можете отредактировать)
                            </label>
                            <input
                              type="text"
                              value={editing.question}
                              onChange={(e) =>
                                setEditingInsights((prev) => ({
                                  ...prev,
                                  [insight.id]: { ...editing, question: e.target.value },
                                }))
                              }
                              className={`w-full px-3 py-2 rounded-lg ${bgCard} border ${borderColor} ${textPrimary} text-sm`}
                            />
                          </div>
                          <div>
                            <label className={`text-xs font-medium ${textSecondary} block mb-1`}>
                              Ответ (заполните что бот должен отвечать)
                            </label>
                            <textarea
                              value={editing.answer}
                              onChange={(e) =>
                                setEditingInsights((prev) => ({
                                  ...prev,
                                  [insight.id]: { ...editing, answer: e.target.value },
                                }))
                              }
                              rows={3}
                              placeholder="Напишите ответ который бот будет давать клиентам на этот вопрос…"
                              className={`w-full px-3 py-2 rounded-lg ${bgCard} border ${borderColor} ${textPrimary} text-sm`}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => cancelEditingInsight(insight.id)}
                              disabled={editing.saving}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${textSecondary} hover:bg-white/5`}
                            >
                              Отмена
                            </button>
                            <button
                              onClick={() => acceptInsightAsFaq(insight.id)}
                              disabled={editing.saving}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {editing.saving ? "Сохраняем…" : "Сохранить как FAQ"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "profiles" && (
        <section>
          <div className={`${bgCard} rounded-xl border ${borderColor} p-8 text-center`}>
            <Users className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
            <p className={textPrimary + " font-medium mb-2"}>
              {t("aiLearning.clientProfilesInfo")}
            </p>
            <p className={`text-sm ${textSecondary}`}>
              {t("aiLearning.clientProfilesDesc")}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
