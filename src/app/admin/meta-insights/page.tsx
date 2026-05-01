"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  Activity,
  Play,
} from "lucide-react";

interface MetaInsight {
  id: string;
  type: string;
  severity: "info" | "warn" | "critical";
  title: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
  data: Record<string, unknown> | null;
  business: {
    id: string;
    name: string;
    country: string | null;
    dashboardMode: string | null;
  } | null;
}

interface Counts {
  new: number;
  resolved: number;
  dismissed: number;
}

const SEVERITY_META: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  critical: {
    label: "Критично",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    icon: "🔴",
  },
  warn: {
    label: "Внимание",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    icon: "🟡",
  },
  info: {
    label: "Инфо",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    icon: "🟢",
  },
};

const TYPE_LABELS: Record<string, string> = {
  dont_know_frequency: "Бот часто не знает ответ",
  stuck_conversation: "Застрявшие диалоги",
  quota_pressure: "Лимит сообщений",
  escalation_spike: "Много эскалаций",
  faq_ignored: "FAQ игнорируется",
  tool_failure: "Ошибки инструментов",
  language_gap: "Языковые проблемы",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "только что";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export default function AdminMetaInsightsPage() {
  const [insights, setInsights] = useState<MetaInsight[]>([]);
  const [counts, setCounts] = useState<Counts>({ new: 0, resolved: 0, dismissed: 0 });
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"new" | "resolved" | "dismissed" | "all">("new");

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/meta-insights?status=${filter}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setInsights(data.insights || []);
      setCounts(data.counts || { new: 0, resolved: 0, dismissed: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const runDetectors = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/meta-insights?run=1");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      alert(
        `Прогон детекторов завершён. Создано инсайтов: ${data.created}\n${
          Object.keys(data.byType || {})
            .map((t) => `  ${t}: ${data.byType[t]}`)
            .join("\n")
        }`
      );
      fetchInsights();
    } catch (e) {
      console.error(e);
      alert("Ошибка при прогоне детекторов");
    } finally {
      setRunning(false);
    }
  };

  const updateInsight = async (id: string, action: "resolve" | "dismiss") => {
    try {
      const res = await fetch("/api/admin/meta-insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        setInsights((prev) => prev.filter((i) => i.id !== id));
        setCounts((prev) => ({
          ...prev,
          new: Math.max(0, prev.new - 1),
          [action === "resolve" ? "resolved" : "dismissed"]:
            prev[action === "resolve" ? "resolved" : "dismissed"] + 1,
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="h-7 w-7 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">Meta Insights</h1>
              <p className="text-sm text-zinc-400">
                Системные паттерны на платформе. Daily digest приходит в Telegram, тут — детали.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runDetectors}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Прогнать сейчас
            </button>
            <button
              onClick={fetchInsights}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Обновить
            </button>
          </div>
        </div>

        {/* Фильтр статусов */}
        <div className="flex gap-2 mb-4">
          {(
            [
              { key: "new", label: `Новые (${counts.new})` },
              { key: "resolved", label: `Решены (${counts.resolved})` },
              { key: "dismissed", label: `Отклонены (${counts.dismissed})` },
              { key: "all", label: "Все" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === f.key
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  : "bg-zinc-900 border border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Список */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : insights.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/60" />
            <p className="text-zinc-400">Системных проблем не обнаружено</p>
            <p className="text-xs text-zinc-600 mt-1">
              Cron бежит ежедневно в 7:00 UTC. Можешь нажать "Прогнать сейчас" чтобы запустить вручную.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => {
              const sev = SEVERITY_META[insight.severity] || SEVERITY_META.info;
              return (
                <div
                  key={insight.id}
                  className={`bg-zinc-900/50 border rounded-xl p-4 ${sev.border}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${sev.bg} ${sev.text}`}>
                          {sev.icon} {sev.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-300">
                          {TYPE_LABELS[insight.type] || insight.type}
                        </span>
                        {insight.business && (
                          <a
                            href={`/admin/conversations`}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 inline-flex items-center gap-1"
                          >
                            <Building2 className="h-3 w-3" />
                            {insight.business.name}
                          </a>
                        )}
                        <span className="text-[10px] text-zinc-500 ml-auto">
                          {fmtDate(insight.createdAt)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm mb-1">{insight.title}</h3>
                      <p className="text-sm text-zinc-400 leading-relaxed">{insight.description}</p>
                      {insight.notes && (
                        <p className="mt-2 text-xs text-zinc-500 italic">
                          Заметка: {insight.notes}
                        </p>
                      )}
                      {insight.resolvedBy && (
                        <p className="mt-1 text-[10px] text-zinc-500">
                          {insight.status === "resolved" ? "✓ Решено" : "✕ Отклонено"} —{" "}
                          {insight.resolvedBy}
                        </p>
                      )}
                    </div>
                    {insight.status === "new" && (
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => updateInsight(insight.id, "resolve")}
                          className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition"
                          title="Решено"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => updateInsight(insight.id, "dismiss")}
                          className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 transition"
                          title="Отклонить"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-xs text-zinc-500 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            Daily digest идёт в Telegram через <code className="bg-zinc-800 px-1 rounded">SUPPORT_BOT_TOKEN</code> →{" "}
            <code className="bg-zinc-800 px-1 rounded">SUPPORT_CHAT_ID</code> (тот же бот и чат, где приходят support-тикеты).
            Если хочешь отправлять в отдельный чат — поставь{" "}
            <code className="bg-zinc-800 px-1 rounded">ADMIN_TELEGRAM_CHAT_ID</code> (имеет приоритет, можно несколько через запятую).
          </p>
        </div>
      </div>
    </div>
  );
}
