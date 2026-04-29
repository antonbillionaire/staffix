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
}

type Tab = "corrections" | "insights" | "profiles";
type InsightStatus = "new" | "accepted" | "dismissed";

export default function AiLearningPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<Tab>("corrections");
  const [corrections, setCorrections] = useState<BotCorrection[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightFilter, setInsightFilter] = useState<InsightStatus>("new");

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

  const updateInsightStatus = async (id: string, status: "accepted" | "dismissed") => {
    try {
      const res = await fetch(`/api/insights/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setInsights(insights.filter((i) => i.id !== id));
      }
    } catch (error) {
      console.error("Error updating insight:", error);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "suggestion":
        return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      case "warning":
        return <ThumbsDown className="h-5 w-5 text-red-500" />;
      default:
        return <Brain className="h-5 w-5 text-purple-500" />;
    }
  };

  // Insights tab is hidden — generator not implemented yet (model + API + UI ready,
  // missing piece is the analysis job that writes to AiInsight). Re-enable when
  // src/lib/ai-insights.ts is implemented and called from cron/ai-learning.
  const tabs: { key: Tab; labelKey: string; icon: typeof Brain }[] = [
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
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div>
                          <p className={`font-medium ${textPrimary}`}>
                            {insight.title}
                          </p>
                          <p className={`text-sm ${textSecondary} mt-1`}>
                            {insight.description}
                          </p>
                        </div>
                      </div>
                      {insightFilter === "new" && (
                        <div className="flex gap-1 ml-4">
                          <button
                            onClick={() => updateInsightStatus(insight.id, "accepted")}
                            className="p-2 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors"
                            title={t("aiLearning.accept")}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => updateInsightStatus(insight.id, "dismissed")}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                            title={t("aiLearning.dismiss")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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
