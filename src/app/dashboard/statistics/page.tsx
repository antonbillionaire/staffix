"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  BarChart3,
  MessageSquare,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  Loader2,
  HelpCircle,
  Crown,
  Sparkles,
  Moon,
  DollarSign,
  Send,
  Star,
  ShoppingCart,
  Package,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  dashboardMode?: string;
  totalMessages: number;
  totalBookings: number;
  totalClients: number;
  avgResponseTime: number;
  conversionRate: number;
  popularQuestions: { question: string; count: number }[];
  messagesByDay: { date: string; count: number }[];
  // Лиды переданные ботом (notify_manager эскалации)
  leadsEscalated?: number;
  // Trends (% change vs previous period)
  trends?: { messages: number; bookings: number; clients: number; orders?: number; leadsEscalated?: number };
  // Enhanced stats
  customerSegments?: { vip: number; active: number; inactive: number };
  bookingsByStatus?: { pending: number; confirmed: number; completed: number; cancelled: number };
  totalRevenue?: number;
  broadcastsSent?: number;
  avgRating?: number;
  // Messages by channel
  messagesByChannel?: Record<string, number>;
  // Order statistics (for sales/shop businesses)
  totalOrders?: number;
  ordersByStatus?: Record<string, number>;
  orderRevenue?: number;
  avgOrderValue?: number;
  ordersByDay?: { date: string; count: number }[];
  popularProducts?: { name: string; count: number; revenue: number }[];
  dealFunnel?: {
    counts: { lead: number; consultation_booked: number; consultation_done: number; client: number; lost: number };
    total: number;
    revenue: number;
    closedDeals: number;
    conversion: { leadToBooked: number; bookedToDone: number; doneToClient: number; leadToClient: number };
  };
  // NEW (июль 2026)
  messagesByHour?: { hour: number; count: number }[];
  topConversations?: {
    id: string;
    clientName: string;
    clientPhone: string | null;
    channel: string;
    messageCount: number;
    lastActivityAt: string;
  }[];
  heavyConversationsCount?: number;
  heavyConversationsThreshold?: number;
  leadsByChannel?: { channel: string; count: number }[];
}

export default function StatisticsPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    totalBookings: 0,
    totalClients: 0,
    avgResponseTime: 0,
    conversionRate: 0,
    popularQuestions: [],
    messagesByDay: [],
  });

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  const isSalesMode = stats.dashboardMode === "sales";

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/statistics?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [period]);

  const exportToExcel = () => {
    // Create CSV content
    const headers = [t("statistics.csvDate"), t("statistics.csvMessages")];
    const rows = stats.messagesByDay.map(d => [d.date, d.count.toString()]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `statistics_${period}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>{t("statistics.title")}</h1>
          <p className={textSecondary}>{t("statistics.subtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className={`flex ${cardBg} rounded-lg border ${borderColor} p-1`}>
            {[
              { id: "week", label: t("statistics.periodWeek") },
              { id: "month", label: t("statistics.periodMonth") },
              { id: "all", label: t("statistics.periodAll") },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as "week" | "month" | "all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p.id
                    ? "bg-blue-600 text-white"
                    : `${textSecondary} hover:${textPrimary}`
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Staff statistics link (service businesses only) */}
          {!isSalesMode && (
            <Link
              href="/dashboard/staff/statistics"
              className={`flex items-center gap-2 px-4 py-2 ${cardBg} border ${borderColor} rounded-lg text-sm font-medium ${textSecondary} hover:text-blue-500 transition-colors`}
            >
              <Users className="h-4 w-4" />
              {t("nav.myTeam")}
            </Link>
          )}

          {/* Export button */}
          <button
            onClick={exportToExcel}
            className={`flex items-center gap-2 px-4 py-2 ${cardBg} border ${borderColor} rounded-lg text-sm font-medium ${textSecondary} hover:${textPrimary} transition-colors`}
          >
            <Download className="h-4 w-4" />
            {t("statistics.export")}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            {stats.trends && stats.trends.messages !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${stats.trends.messages > 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.trends.messages > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {stats.trends.messages > 0 ? "+" : ""}{stats.trends.messages}%
              </div>
            )}
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.totalMessages}</p>
          <p className={textSecondary}>{t("statistics.totalMessages")}</p>
        </div>

        {/* Sales mode: orders card / Service mode: bookings card */}
        {isSalesMode ? (
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-green-500" />
              </div>
              {stats.trends?.orders !== undefined && stats.trends.orders !== 0 && (
                <div className={`flex items-center gap-1 text-sm ${stats.trends.orders > 0 ? "text-green-500" : "text-red-500"}`}>
                  {stats.trends.orders > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {stats.trends.orders > 0 ? "+" : ""}{stats.trends.orders}%
                </div>
              )}
            </div>
            <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.totalOrders || 0}</p>
            <p className={textSecondary}>{t("statistics.orders")}</p>
          </div>
        ) : (
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-500" />
              </div>
              {stats.trends && stats.trends.bookings !== 0 && (
                <div className={`flex items-center gap-1 text-sm ${stats.trends.bookings > 0 ? "text-green-500" : "text-red-500"}`}>
                  {stats.trends.bookings > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {stats.trends.bookings > 0 ? "+" : ""}{stats.trends.bookings}%
                </div>
              )}
            </div>
            <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.totalBookings}</p>
            <p className={textSecondary}>{t("statistics.bookings")}</p>
          </div>
        )}

        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-500" />
            </div>
            {stats.trends && stats.trends.clients !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${stats.trends.clients > 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.trends.clients > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {stats.trends.clients > 0 ? "+" : ""}{stats.trends.clients}%
              </div>
            )}
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.totalClients}</p>
          <p className={textSecondary}>{t("statistics.clients")}</p>
        </div>

        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>
            {stats.avgResponseTime <= 1 ? t("statistics.lessThan1s") : `${stats.avgResponseTime}${t("statistics.seconds")}`}
          </p>
          <p className={textSecondary}>{t("statistics.avgResponseTime")}</p>
        </div>

        {/* Лиды переданные ботом (notify_manager эскалации) — метрика которую Right Flight
            хотел видеть: сколько лидов бот реально прислал владельцу вручную */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-orange-500" />
            </div>
            {stats.trends?.leadsEscalated !== undefined && stats.trends.leadsEscalated !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${stats.trends.leadsEscalated > 0 ? "text-green-500" : "text-red-500"}`}>
                {stats.trends.leadsEscalated > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {stats.trends.leadsEscalated > 0 ? "+" : ""}{stats.trends.leadsEscalated}%
              </div>
            )}
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.leadsEscalated ?? 0}</p>
          <p className={textSecondary}>Лидов передано владельцу</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Messages chart */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.messagesByDay")}</h3>
          <div className="h-48 sm:h-64 flex items-end gap-1 sm:gap-2">
            {stats.messagesByDay.length > 0 ? (
              stats.messagesByDay.map((day, idx) => {
                const maxCount = Math.max(...stats.messagesByDay.map(d => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-blue-500/20 rounded-t-lg relative" style={{ height: `${height}%`, minHeight: "4px" }}>
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg" />
                    </div>
                    <span className={`text-xs ${textSecondary}`}>
                      {new Date(day.date).toLocaleDateString("ru", { weekday: "short" })}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="w-full flex items-center justify-center">
                <p className={textSecondary}>{t("statistics.noDataForPeriod")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Messages by channel — count + share% of total */}
        {stats.messagesByChannel && Object.keys(stats.messagesByChannel).length > 0 && (
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.messagesByChannel")}</h3>
            <div className="space-y-3">
              {(() => {
                const channels = stats.messagesByChannel!;
                // Доли считаем от ОБЩЕГО числа канальных сообщений (а не от лидера).
                // Так бары визуально складываются в 100% и читаются как «вклад
                // каждого канала», а не «отставание от лидера». Используем
                // totalChannel, а не stats.totalMessages, потому что totalMessages
                // включает Telegram-Message-таблицу которая не лежит в этой
                // разбивке (TG считается отдельно через ChannelMessage только
                // если у бота заведена строка в ChannelMessage — у текущей TG-
                // интеграции этого нет).
                const totalChannel = Object.values(channels).reduce((a, b) => a + b, 0);
                const channelMeta: Record<string, { label: string; color: string }> = {
                  telegram: { label: "Telegram", color: "bg-blue-500" },
                  whatsapp: { label: "WhatsApp", color: "bg-green-500" },
                  instagram: { label: "Instagram", color: "bg-pink-500" },
                  facebook: { label: "Facebook", color: "bg-blue-600" },
                };
                return Object.entries(channels)
                  .sort(([, a], [, b]) => b - a)
                  .map(([channel, count]) => {
                    const meta = channelMeta[channel] || { label: channel, color: "bg-gray-500" };
                    const sharePct = totalChannel > 0
                      ? Math.round((count / totalChannel) * 1000) / 10  // 1 знак после запятой
                      : 0;
                    return (
                      <div key={channel} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-medium ${textPrimary}`}>{meta.label}</span>
                          <span className={`text-sm ${textSecondary}`}>
                            {count} <span className={`ml-1 font-medium ${textPrimary}`}>{sharePct}%</span>
                          </span>
                        </div>
                        <div className={`h-2 rounded-full ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                          <div
                            className={`h-full rounded-full ${meta.color} transition-all`}
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </div>
        )}

        {/* Popular questions */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.popularQuestions")}</h3>
          <div className="space-y-3">
            {stats.popularQuestions.length > 0 ? (
              stats.popularQuestions.map((q, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${textPrimary} truncate`}>{q.question}</p>
                    <p className={`text-xs ${textSecondary}`}>{q.count} {t("statistics.times")}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className={textSecondary}>{t("statistics.noQuestionsData")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Heavy conversations alert — предупреждаем если есть диалоги >30 сообщений
          (бот может тратить лишние сообщения из подписки — стоит проверить)
          NEW июль 2026 по запросу Антона */}
      {stats.heavyConversationsCount !== undefined && stats.heavyConversationsCount > 0 && (
        <div className={`rounded-xl border p-4 flex items-start gap-3 ${
          isDark
            ? "bg-orange-500/10 border-orange-500/30"
            : "bg-orange-50 border-orange-200"
        }`}>
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-5 w-5 text-orange-500" />
          </div>
          <div className="flex-1">
            <p className={`font-semibold ${textPrimary}`}>
              Внимание — «дорогие» диалоги ({stats.heavyConversationsCount})
            </p>
            <p className={`text-sm ${textSecondary} mt-1`}>
              У вас {stats.heavyConversationsCount} {stats.heavyConversationsCount === 1 ? "диалог" : "диалога"} с {stats.heavyConversationsThreshold || 30}+ сообщений.
              Это может значить что бот застрял или клиент задаёт вопросы, на которые бот не может ответить.
              Проверьте их ниже в «Топ диалогов по сообщениям».
            </p>
          </div>
        </div>
      )}

      {/* Загруженность по часам — messagesByHour.
          NEW июль 2026: показывает в какие часы (по timezone бизнеса) бот больше
          всего работает. Полезно для понимания когда клиенты пишут — можно
          настроить working hours / приоритизировать эскалации. */}
      {stats.messagesByHour && stats.messagesByHour.length > 0 && (() => {
        const maxHourCount = Math.max(...stats.messagesByHour.map((h) => h.count));
        if (maxHourCount === 0) return null; // нет данных за период → не рендерим
        return (
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Загруженность по часам</h3>
              <span className={`text-xs ${textSecondary}`}>в часовом поясе бизнеса</span>
            </div>
            <div className="h-40 sm:h-48 flex items-end gap-0.5 sm:gap-1">
              {stats.messagesByHour.map((h) => {
                const height = maxHourCount > 0 ? (h.count / maxHourCount) * 100 : 0;
                // Подсвечиваем «рабочие» часы 8-22 сильнее, ночные — приглушённо
                const isBusinessHour = h.hour >= 8 && h.hour < 22;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className={`w-full rounded-t relative ${
                        isBusinessHour
                          ? "bg-gradient-to-t from-purple-600 to-purple-400"
                          : "bg-gradient-to-t from-purple-800/50 to-purple-500/40"
                      }`}
                      style={{ height: `${height}%`, minHeight: h.count > 0 ? "3px" : "1px" }}
                      title={`${h.hour}:00 — ${h.count} сообщ.`}
                    />
                    {(h.hour % 3 === 0) && (
                      <span className={`text-[10px] ${textSecondary}`}>
                        {h.hour.toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className={`text-xs ${textSecondary} mt-3`}>
              Час пик: <span className={`font-medium ${textPrimary}`}>
                {(() => {
                  const peak = [...(stats.messagesByHour || [])].sort((a, b) => b.count - a.count)[0];
                  return peak && peak.count > 0 ? `${peak.hour}:00 — ${peak.count} сообщ.` : "нет данных";
                })()}
              </span>
            </p>
          </div>
        );
      })()}

      {/* Топ диалогов по сообщениям — topConversations.
          NEW июль 2026: топ-20 диалогов отсортированные по количеству сообщений.
          Полезно для (1) видеть «дорогих» клиентов, (2) находить где бот застрял,
          (3) понимать какие темы требуют много общения. */}
      {stats.topConversations && stats.topConversations.length > 0 && (
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${textPrimary}`}>Топ диалогов по сообщениям</h3>
            <span className={`text-xs ${textSecondary}`}>
              Порог: {stats.heavyConversationsThreshold || 30}+ сообщений
            </span>
          </div>
          <div className="space-y-2">
            {stats.topConversations.slice(0, 10).map((c) => {
              const isHeavy = c.messageCount >= (stats.heavyConversationsThreshold || 30);
              const channelColor: Record<string, string> = {
                telegram: "text-blue-500 bg-blue-500/10",
                whatsapp: "text-green-500 bg-green-500/10",
                instagram: "text-pink-500 bg-pink-500/10",
                facebook: "text-blue-600 bg-blue-600/10",
              };
              const channelBadge = channelColor[c.channel] || "text-gray-500 bg-gray-500/10";
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isDark ? "bg-white/[0.02] hover:bg-white/5" : "bg-gray-50 hover:bg-gray-100"
                  } transition-colors ${
                    isHeavy ? (isDark ? "border border-orange-500/30" : "border border-orange-200") : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${textPrimary} truncate`}>{c.clientName}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${channelBadge}`}>
                        {c.channel}
                      </span>
                      {isHeavy && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500">
                          дорогой
                        </span>
                      )}
                    </div>
                    {c.clientPhone && (
                      <p className={`text-xs ${textSecondary} mt-0.5`}>{c.clientPhone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${textPrimary}`}>{c.messageCount}</p>
                    <p className={`text-[10px] ${textSecondary}`}>сообщ.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Лиды по каналам — leadsByChannel.
          NEW июль 2026: разбивка эскалаций к менеджеру по источнику канала. */}
      {stats.leadsByChannel && stats.leadsByChannel.length > 0 && (() => {
        const totalLeads = stats.leadsByChannel!.reduce((sum, l) => sum + l.count, 0);
        if (totalLeads === 0) return null;
        return (
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
              Лиды по каналам
            </h3>
            <div className="space-y-3">
              {stats.leadsByChannel!.map((l) => {
                const sharePct = totalLeads > 0
                  ? Math.round((l.count / totalLeads) * 1000) / 10
                  : 0;
                const channelMeta: Record<string, { label: string; color: string }> = {
                  telegram: { label: "Telegram", color: "bg-blue-500" },
                  whatsapp: { label: "WhatsApp", color: "bg-green-500" },
                  instagram: { label: "Instagram", color: "bg-pink-500" },
                  facebook: { label: "Facebook", color: "bg-blue-600" },
                };
                const meta = channelMeta[l.channel] || { label: l.channel, color: "bg-gray-500" };
                return (
                  <div key={l.channel}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${textPrimary}`}>{meta.label}</span>
                      <span className={`text-sm ${textSecondary}`}>
                        {l.count} <span className={`ml-1 font-medium ${textPrimary}`}>{sharePct}%</span>
                      </span>
                    </div>
                    <div className={`h-2 rounded-full ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                      <div
                        className={`h-full rounded-full ${meta.color} transition-all`}
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Conversion */}
      <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${textPrimary}`}>
            {isSalesMode ? t("statistics.conversionToOrders") : t("statistics.conversionToBookings")}
          </h3>
          <span className={`text-2xl font-bold ${textPrimary}`}>{stats.conversionRate}%</span>
        </div>
        <div className={`h-3 ${isDark ? "bg-white/10" : "bg-gray-200"} rounded-full overflow-hidden`}>
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${Math.min(stats.conversionRate, 100)}%` }}
          />
        </div>
        <p className={`text-sm ${textSecondary} mt-2`}>
          {isSalesMode ? t("statistics.conversionOrdersDescription") : t("statistics.conversionDescription")}
        </p>
      </div>

      {/* Order Analytics (sales mode only) */}
      {isSalesMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Orders by Status */}
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.ordersByStatus")}</h3>
            {stats.ordersByStatus ? (
              <div className="space-y-3">
                {[
                  { key: "new", label: t("statistics.orderStatusNew"), color: "yellow" },
                  { key: "confirmed", label: t("statistics.orderStatusConfirmed"), color: "blue" },
                  { key: "processing", label: t("statistics.orderStatusProcessing"), color: "purple" },
                  { key: "shipped", label: t("statistics.orderStatusShipped"), color: "cyan" },
                  { key: "delivered", label: t("statistics.orderStatusDelivered"), color: "green" },
                  { key: "cancelled", label: t("statistics.orderStatusCancelled"), color: "red" },
                ].map(({ key, label, color }) => {
                  const count = stats.ordersByStatus![key] || 0;
                  if (count === 0 && key !== "new") return null;
                  return (
                    <div key={key} className={`flex items-center justify-between p-3 bg-${color}-500/10 rounded-lg`}>
                      <span className={`text-${color}-400`}>{label}</span>
                      <span className={`font-bold ${textPrimary}`}>{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={textSecondary}>{t("statistics.noData")}</p>
            )}
          </div>

          {/* Order Revenue & Avg */}
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.orderRevenue")}</h3>
            <div className="space-y-4">
              <div className={`p-4 rounded-xl ${isDark ? "bg-green-500/10" : "bg-green-50"}`}>
                <p className={`text-sm ${textSecondary}`}>{t("statistics.totalRevenue")}</p>
                <p className={`text-2xl font-bold text-green-500`}>
                  {(stats.orderRevenue || 0).toLocaleString()}
                </p>
              </div>
              <div className={`p-4 rounded-xl ${isDark ? "bg-blue-500/10" : "bg-blue-50"}`}>
                <p className={`text-sm ${textSecondary}`}>{t("statistics.avgCheck")}</p>
                <p className={`text-2xl font-bold text-blue-500`}>
                  {(stats.avgOrderValue || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Popular Products */}
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.popularProducts")}</h3>
            {stats.popularProducts && stats.popularProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.popularProducts.slice(0, 5).map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${textPrimary} truncate`}>{p.name}</p>
                      <p className={`text-xs ${textSecondary}`}>{p.count} {t("statistics.pcs")} — {p.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={textSecondary}>{t("statistics.noProductsData")}</p>
            )}
          </div>
        </div>
      )}

      {/* Deal Funnel */}
      {stats.dealFunnel && stats.dealFunnel.total > 0 && (
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className={`text-lg font-semibold ${textPrimary}`}>{t("statistics.dealFunnel")}</h3>
            {stats.dealFunnel.revenue > 0 && (
              <div className={`text-sm ${textSecondary}`}>
                {t("statistics.dealFunnelRevenue").replace("{value}", stats.dealFunnel.revenue.toLocaleString()).replace("{count}", String(stats.dealFunnel.closedDeals))}
              </div>
            )}
          </div>
          {(() => {
            const stages: Array<{ key: keyof typeof stats.dealFunnel.counts; label: string; color: string }> = [
              { key: "lead", label: t("statistics.stageLead"), color: "bg-gray-400" },
              { key: "consultation_booked", label: t("statistics.stageBooked"), color: "bg-blue-500" },
              { key: "consultation_done", label: t("statistics.stageDone"), color: "bg-indigo-500" },
              { key: "client", label: t("statistics.stageClient"), color: "bg-green-500" },
            ];
            // For the bar widths, we anchor on funnelTotal so the lead stage is full-width.
            const total = stats.dealFunnel!.total;
            const lostCount = stats.dealFunnel!.counts.lost;
            return (
              <div className="space-y-3">
                {stages.map((s, i) => {
                  // "Reached this stage" = sum of this stage and everything past it.
                  const counts = stats.dealFunnel!.counts;
                  const reached =
                    s.key === "lead" ? total - lostCount :
                    s.key === "consultation_booked" ? counts.consultation_booked + counts.consultation_done + counts.client :
                    s.key === "consultation_done" ? counts.consultation_done + counts.client :
                    counts.client;
                  const width = total > 0 ? (reached / total) * 100 : 0;
                  // Conversion from previous stage to this one — for the right-side label.
                  const conv = stats.dealFunnel!.conversion;
                  const fromPrev = i === 0 ? null : i === 1 ? conv.leadToBooked : i === 2 ? conv.bookedToDone : conv.doneToClient;
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className={textSecondary}>{s.label}</span>
                        <span className={textPrimary}>
                          {reached}
                          {fromPrev !== null && (
                            <span className={`ml-2 text-xs ${textSecondary}`}>({fromPrev}%)</span>
                          )}
                        </span>
                      </div>
                      <div className={`h-3 ${isDark ? "bg-white/5" : "bg-gray-100"} rounded-full overflow-hidden`}>
                        <div className={`h-full ${s.color} transition-all`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
                {lostCount > 0 && (
                  <div className={`flex items-center justify-between text-xs ${textSecondary} pt-2 border-t ${borderColor}`}>
                    <span>{t("statistics.stageLost")}</span>
                    <span>{lostCount}</span>
                  </div>
                )}
                <div className={`flex items-center justify-between pt-3 mt-3 border-t ${borderColor}`}>
                  <span className={`text-sm font-medium ${textPrimary}`}>{t("statistics.overallConversion")}</span>
                  <span className={`text-lg font-bold text-green-400`}>{stats.dealFunnel!.conversion.leadToClient}%</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* CRM Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Customer Segments */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.customerSegments")}</h3>
          {stats.customerSegments ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  <span className={textSecondary}>{t("statistics.vipClients")}</span>
                </div>
                <span className={`font-bold ${textPrimary}`}>{stats.customerSegments.vip}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(stats.customerSegments.vip / stats.totalClients) * 100}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-400" />
                  <span className={textSecondary}>{t("statistics.activeClients")}</span>
                </div>
                <span className={`font-bold ${textPrimary}`}>{stats.customerSegments.active}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(stats.customerSegments.active / stats.totalClients) * 100}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-gray-400" />
                  <span className={textSecondary}>{t("statistics.inactiveClients")}</span>
                </div>
                <span className={`font-bold ${textPrimary}`}>{stats.customerSegments.inactive}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(stats.customerSegments.inactive / stats.totalClients) * 100}%` }} />
              </div>
            </div>
          ) : (
            <p className={textSecondary}>{t("statistics.noSegmentsData")}</p>
          )}
        </div>

        {/* Bookings by Status (service mode only) */}
        {!isSalesMode && (
          <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.bookingsByStatus")}</h3>
            {stats.bookingsByStatus ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
                  <span className="text-yellow-400">{t("statistics.bookingsPending")}</span>
                  <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.pending}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                  <span className="text-blue-400">{t("statistics.bookingsConfirmed")}</span>
                  <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.confirmed}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                  <span className="text-green-400">{t("statistics.bookingsCompleted")}</span>
                  <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.completed}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                  <span className="text-red-400">{t("statistics.bookingsCancelled")}</span>
                  <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.cancelled}</span>
                </div>
              </div>
            ) : (
              <p className={textSecondary}>{t("statistics.noBookingsData")}</p>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>{t("statistics.additional")}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-400" />
                <span className={textSecondary}>{t("statistics.revenue")}</span>
              </div>
              <span className={`font-bold ${textPrimary}`}>
                {(isSalesMode ? (stats.orderRevenue || 0) : (stats.totalRevenue || 0)).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-400" />
                <span className={textSecondary}>{t("statistics.broadcasts")}</span>
              </div>
              <span className={`font-bold ${textPrimary}`}>
                {stats.broadcastsSent || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <span className={textSecondary}>{t("statistics.avgRating")}</span>
              </div>
              <span className={`font-bold ${textPrimary}`}>
                {stats.avgRating?.toFixed(1) || "—"}
              </span>
            </div>
          </div>

          <Link
            href="/dashboard/customers"
            className={`mt-4 flex items-center justify-center gap-2 w-full py-3 ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg text-sm ${textPrimary} font-medium transition-colors`}
          >
            <Users className="h-4 w-4" />
            {t("statistics.manageCustomers")}
          </Link>
        </div>
      </div>
    </div>
  );
}
