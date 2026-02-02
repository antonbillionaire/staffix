"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
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
  Info,
  Lock,
  Crown,
  Sparkles,
  Moon,
  DollarSign,
  Send,
  Star,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  totalMessages: number;
  totalBookings: number;
  totalClients: number;
  avgResponseTime: number;
  conversionRate: number;
  popularQuestions: { question: string; count: number }[];
  messagesByDay: { date: string; count: number }[];
  // Enhanced stats
  customerSegments?: { vip: number; active: number; inactive: number };
  bookingsByStatus?: { pending: number; confirmed: number; completed: number; cancelled: number };
  totalRevenue?: number;
  broadcastsSent?: number;
  avgRating?: number;
}

export default function StatisticsPage() {
  const { theme } = useTheme();
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
    const headers = ["Дата", "Сообщений"];
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
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Статистика</h1>
          <p className={textSecondary}>Аналитика работы вашего AI-сотрудника</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className={`flex ${cardBg} rounded-lg border ${borderColor} p-1`}>
            {[
              { id: "week", label: "Неделя" },
              { id: "month", label: "Месяц" },
              { id: "all", label: "Всё время" },
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

          {/* Export button */}
          <button
            onClick={exportToExcel}
            className={`flex items-center gap-2 px-4 py-2 ${cardBg} border ${borderColor} rounded-lg text-sm font-medium ${textSecondary} hover:${textPrimary} transition-colors`}
          >
            <Download className="h-4 w-4" />
            Экспорт
          </button>
        </div>
      </div>

      {/* Analytics disclaimer */}
      <div className={`${cardBg} rounded-xl border ${borderColor} p-4 mb-2`}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm ${textPrimary} font-medium mb-1`}>Уровень аналитики</p>
            <p className={`text-sm ${textSecondary}`}>
              <span className="text-blue-400">Базовая аналитика (Pro):</span> сообщения, записи, клиенты, время ответа
            </p>
            <p className={`text-sm ${textSecondary}`}>
              <span className="text-purple-400">Полная аналитика (Business):</span> + популярные вопросы, конверсия, экспорт данных
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex items-center gap-1 text-green-500 text-sm">
              <TrendingUp className="h-4 w-4" />
              +12%
            </div>
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.totalMessages}</p>
          <p className={textSecondary}>Всего сообщений</p>
        </div>

        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
              <Calendar className="h-6 w-6 text-green-500" />
            </div>
            <div className="flex items-center gap-1 text-green-500 text-sm">
              <TrendingUp className="h-4 w-4" />
              +8%
            </div>
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.totalBookings}</p>
          <p className={textSecondary}>Записей</p>
        </div>

        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-500" />
            </div>
            <div className="flex items-center gap-1 text-green-500 text-sm">
              <TrendingUp className="h-4 w-4" />
              +15%
            </div>
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.totalClients}</p>
          <p className={textSecondary}>Клиентов</p>
        </div>

        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
          </div>
          <p className={`text-3xl font-bold ${textPrimary} mt-4`}>{stats.avgResponseTime}с</p>
          <p className={textSecondary}>Среднее время ответа</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Messages chart */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Сообщения по дням</h3>
          <div className="h-64 flex items-end gap-2">
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
                <p className={textSecondary}>Нет данных за этот период</p>
              </div>
            )}
          </div>
        </div>

        {/* Popular questions */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Популярные вопросы</h3>
          <div className="space-y-3">
            {stats.popularQuestions.length > 0 ? (
              stats.popularQuestions.map((q, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${textPrimary} truncate`}>{q.question}</p>
                    <p className={`text-xs ${textSecondary}`}>{q.count} раз</p>
                  </div>
                </div>
              ))
            ) : (
              <p className={textSecondary}>Пока нет данных о вопросах</p>
            )}
          </div>
        </div>
      </div>

      {/* Conversion */}
      <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${textPrimary}`}>Конверсия в записи</h3>
          <span className={`text-2xl font-bold ${textPrimary}`}>{stats.conversionRate}%</span>
        </div>
        <div className={`h-3 ${isDark ? "bg-white/10" : "bg-gray-200"} rounded-full overflow-hidden`}>
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${stats.conversionRate}%` }}
          />
        </div>
        <p className={`text-sm ${textSecondary} mt-2`}>
          Процент пользователей, которые записались после общения с AI-сотрудником
        </p>
      </div>

      {/* CRM Analytics */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Customer Segments */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Сегменты клиентов</h3>
          {stats.customerSegments ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  <span className={textSecondary}>VIP клиенты</span>
                </div>
                <span className={`font-bold ${textPrimary}`}>{stats.customerSegments.vip}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(stats.customerSegments.vip / stats.totalClients) * 100}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-green-400" />
                  <span className={textSecondary}>Активные</span>
                </div>
                <span className={`font-bold ${textPrimary}`}>{stats.customerSegments.active}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(stats.customerSegments.active / stats.totalClients) * 100}%` }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-gray-400" />
                  <span className={textSecondary}>Неактивные</span>
                </div>
                <span className={`font-bold ${textPrimary}`}>{stats.customerSegments.inactive}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(stats.customerSegments.inactive / stats.totalClients) * 100}%` }} />
              </div>
            </div>
          ) : (
            <p className={textSecondary}>Нет данных о сегментах</p>
          )}
        </div>

        {/* Bookings by Status */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Записи по статусам</h3>
          {stats.bookingsByStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
                <span className="text-yellow-400">Ожидают</span>
                <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.pending}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                <span className="text-blue-400">Подтверждены</span>
                <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.confirmed}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                <span className="text-green-400">Завершены</span>
                <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.completed}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                <span className="text-red-400">Отменены</span>
                <span className={`font-bold ${textPrimary}`}>{stats.bookingsByStatus.cancelled}</span>
              </div>
            </div>
          ) : (
            <p className={textSecondary}>Нет данных о записях</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>Дополнительно</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-400" />
                <span className={textSecondary}>Выручка</span>
              </div>
              <span className={`font-bold ${textPrimary}`}>
                {stats.totalRevenue?.toLocaleString() || 0}₸
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-400" />
                <span className={textSecondary}>Рассылок</span>
              </div>
              <span className={`font-bold ${textPrimary}`}>
                {stats.broadcastsSent || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <span className={textSecondary}>Средний рейтинг</span>
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
            Управление клиентами
          </Link>
        </div>
      </div>
    </div>
  );
}
