"use client";

/**
 * /dashboard/activity — журнал активности AI-сотрудника для бизнеса.
 *
 * Заменяет необходимость давать клиенту доступ к Vercel-логам:
 *  - изоляция: API возвращает события только этого бизнеса
 *  - real-time: polling каждые 3 секунды добавляет новые события сверху
 *  - debug-mode: toggle «Технические детали» показывает technical JSON
 *  - фильтры: тип события, severity (только ошибки)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Activity,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Search,
  MessageCircle,
  Bot,
  Wrench,
  Bell,
  UserPlus,
  Calendar,
  ShoppingCart,
  CreditCard,
  Loader2,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  severity: "info" | "warn" | "error";
  summary: string;
  technical: Record<string, unknown> | null;
  channel: string | null;
  clientId: string | null;
  staffId: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  message_received: { icon: MessageCircle, color: "text-blue-400", label: "Сообщение клиента" },
  message_sent: { icon: MessageCircle, color: "text-cyan-400", label: "Отправлено клиенту" },
  ai_response: { icon: Bot, color: "text-purple-400", label: "AI ответил" },
  tool_called: { icon: Wrench, color: "text-yellow-400", label: "AI вызвал инструмент" },
  notification_sent: { icon: Bell, color: "text-green-400", label: "Уведомление" },
  client_assigned: { icon: UserPlus, color: "text-pink-400", label: "Назначен клиент" },
  booking_created: { icon: Calendar, color: "text-emerald-400", label: "Создана запись" },
  order_created: { icon: ShoppingCart, color: "text-teal-400", label: "Создан заказ" },
  payment_received: { icon: CreditCard, color: "text-green-400", label: "Платёж" },
  error: { icon: AlertCircle, color: "text-red-400", label: "Ошибка" },
};

const TYPE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Все события" },
  { value: "message_received", label: "Сообщения клиентов" },
  { value: "ai_response", label: "Ответы AI" },
  { value: "tool_called", label: "Вызовы инструментов" },
  { value: "notification_sent", label: "Уведомления" },
  { value: "error", label: "Только ошибки" },
];

const SEVERITY_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Любой уровень" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warning" },
  { value: "error", label: "Error" },
];

const POLL_INTERVAL_MS = 3000;

export default function ActivityLogPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const lastSinceRef = useRef<string | null>(null);
  const itemsRef = useRef<ActivityItem[]>([]);
  itemsRef.current = items;

  const buildParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p = new URLSearchParams();
      if (filterType) p.set("type", filterType);
      if (filterSeverity) p.set("severity", filterSeverity);
      if (search.trim()) p.set("q", search.trim());
      for (const [k, v] of Object.entries(overrides)) p.set(k, v);
      return p.toString();
    },
    [filterType, filterSeverity, search]
  );

  // Initial load + reload on filters change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard/activity-log?${buildParams({ limit: "50" })}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Ошибка загрузки");
        }
        const data = await res.json();
        if (!cancelled) {
          setItems(data.items || []);
          if (data.items?.[0]) lastSinceRef.current = data.items[0].createdAt;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [buildParams]);

  // Poll for new items
  useEffect(() => {
    const interval = setInterval(async () => {
      const since = lastSinceRef.current;
      if (!since) return;
      try {
        const res = await fetch(`/api/dashboard/activity-log?${buildParams({ since, limit: "50" })}`);
        if (!res.ok) return;
        const data = await res.json();
        const fresh: ActivityItem[] = data.items || [];
        if (fresh.length === 0) return;
        // newest first уже в порядке desc от API
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const dedup = fresh.filter((f) => !seen.has(f.id));
          if (dedup.length === 0) return prev;
          return [...dedup, ...prev].slice(0, 500); // ограничение чтобы DOM не пух
        });
        if (fresh[0]) lastSinceRef.current = fresh[0].createdAt;
      } catch {
        // тихо проглатываем — следующий tick попробует снова
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [buildParams]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  // Group by date
  const groups: Array<{ date: string; items: ActivityItem[] }> = [];
  for (const item of items) {
    const date = fmtDate(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a1a] text-white" : "bg-gray-50 text-gray-900"} p-4 md:p-6`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Журнал бота</h1>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                Что AI-сотрудник делал в реальном времени · обновляется автоматически
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${
                loading ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> {loading ? "Загрузка" : "LIVE"}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} border rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2`}
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по содержимому..."
              className={`w-full pl-8 pr-3 py-1.5 text-sm rounded-lg ${
                isDark ? "bg-white/5 border border-white/10 text-white placeholder-gray-500" : "bg-gray-50 border border-gray-200"
              } focus:outline-none focus:border-blue-500`}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              isDark ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
            } focus:outline-none focus:border-blue-500`}
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value} className={isDark ? "bg-[#12122a]" : ""}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              isDark ? "bg-white/5 border border-white/10 text-white" : "bg-gray-50 border border-gray-200"
            } focus:outline-none focus:border-blue-500`}
          >
            {SEVERITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value} className={isDark ? "bg-[#12122a]" : ""}>
                {f.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={showTechnical}
              onChange={(e) => setShowTechnical(e.target.checked)}
              className="rounded"
            />
            <span className={isDark ? "text-gray-300" : "text-gray-700"}>Технические детали</span>
          </label>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* List */}
        {items.length === 0 && !loading ? (
          <div
            className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} border rounded-xl p-12 text-center`}
          >
            <Activity className={`h-10 w-10 mx-auto mb-3 ${isDark ? "text-gray-600" : "text-gray-400"}`} />
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Пока нет событий. Активность появится когда AI-сотрудник начнёт работать с клиентами.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.date}>
                <div className={`text-xs font-medium mb-2 ${isDark ? "text-gray-500" : "text-gray-400"} uppercase tracking-wide`}>
                  {group.date}
                </div>
                <div
                  className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} border rounded-xl divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}
                >
                  {group.items.map((item) => {
                    const meta = TYPE_META[item.type] || {
                      icon: Info,
                      color: "text-gray-400",
                      label: item.type,
                    };
                    const Icon = meta.icon;
                    const sevColor =
                      item.severity === "error"
                        ? "text-red-400"
                        : item.severity === "warn"
                          ? "text-yellow-400"
                          : meta.color;
                    const SevIcon =
                      item.severity === "error" ? AlertCircle : item.severity === "warn" ? AlertTriangle : Icon;
                    const expanded = expandedIds.has(item.id);
                    const hasTech =
                      item.technical && typeof item.technical === "object" && Object.keys(item.technical).length > 0;
                    const expandable = hasTech || (showTechnical && hasTech);

                    return (
                      <div key={item.id} className="px-3 py-2.5">
                        <div
                          className={`flex items-start gap-3 ${expandable ? "cursor-pointer" : ""}`}
                          onClick={() => expandable && toggleExpand(item.id)}
                        >
                          <SevIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${sevColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-mono ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                {fmtTime(item.createdAt)}
                              </span>
                              <span className={`text-xs ${sevColor}`}>{meta.label}</span>
                              {item.channel && (
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {item.channel}
                                </span>
                              )}
                            </div>
                            <div className={`text-sm mt-0.5 ${isDark ? "text-white" : "text-gray-900"}`}>
                              {item.summary}
                            </div>
                            {(showTechnical || expanded) && hasTech && (
                              <pre
                                className={`mt-2 text-xs font-mono p-2 rounded overflow-x-auto ${
                                  isDark ? "bg-black/30 text-gray-400" : "bg-gray-50 text-gray-700"
                                }`}
                              >
                                {JSON.stringify(item.technical, null, 2)}
                              </pre>
                            )}
                          </div>
                          {expandable && (
                            <button
                              className={`flex-shrink-0 mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}
                              aria-label="Развернуть"
                            >
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {loading && items.length > 0 && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className={`h-5 w-5 animate-spin ${isDark ? "text-gray-500" : "text-gray-400"}`} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
