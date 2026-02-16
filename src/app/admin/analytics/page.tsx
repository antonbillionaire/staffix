"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  TrendingUp,
  Users,
  DollarSign,
  MessageSquare,
  Calendar,
  Bot,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";

interface Analytics {
  period: number;
  overview: {
    totalUsers: number;
    newUsers: number;
    totalMRR: number;
    mrrByPlan: {
      trial: number;
      pro: number;
      business: number;
    };
    messagesUsed: number;
    messagesLimit: number;
    messagesUtilization: number;
  };
  funnel: {
    registered: number;
    withBusiness: number;
    withBot: number;
    paid: number;
    conversionRate: number;
  };
  subscriptions: {
    byPlan: Record<string, number>;
    activeTrials: number;
    expiredTrials: number;
    churnRate: number;
  };
  activity: {
    totalBookings: number;
    bookingsByStatus: Record<string, number>;
    totalConversations: number;
    totalMessages: number;
  };
  chartData: {
    registrations: Array<{ date: string; count: number }>;
    bookings: Array<{ date: string; count: number }>;
  };
  topBusinesses: Array<{
    id: string;
    name: string;
    plan: string;
    botActive: boolean;
    bookings: number;
    conversations: number;
    messagesUsed: number;
  }>;
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState("30");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`);
      if (res.ok) {
        const analytics = await res.json();
        setData(analytics);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    if (!data) return;
    setExporting(true);

    try {
      // Generate CSV report
      const report = generateCSVReport(data);
      const blob = new Blob([report], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `staffix-report-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  };

  const generateCSVReport = (analytics: Analytics): string => {
    const lines: string[] = [];

    lines.push("STAFFIX ANALYTICS REPORT");
    lines.push(`Generated: ${new Date().toLocaleString("ru-RU")}`);
    lines.push(`Period: ${analytics.period} days`);
    lines.push("");

    lines.push("=== OVERVIEW ===");
    lines.push(`Total Users,${analytics.overview.totalUsers}`);
    lines.push(`New Users (period),${analytics.overview.newUsers}`);
    lines.push(`MRR,$${analytics.overview.totalMRR}`);
    lines.push(`MRR Pro,$${analytics.overview.mrrByPlan.pro}`);
    lines.push(`MRR Business,$${analytics.overview.mrrByPlan.business}`);
    lines.push(`Messages Used,${analytics.overview.messagesUsed}`);
    lines.push(`Messages Limit,${analytics.overview.messagesLimit}`);
    lines.push(`Utilization,${analytics.overview.messagesUtilization}%`);
    lines.push("");

    lines.push("=== CONVERSION FUNNEL ===");
    lines.push(`Registered,${analytics.funnel.registered}`);
    lines.push(`With Business,${analytics.funnel.withBusiness}`);
    lines.push(`With Bot Active,${analytics.funnel.withBot}`);
    lines.push(`Paid Users,${analytics.funnel.paid}`);
    lines.push(`Conversion Rate,${analytics.funnel.conversionRate}%`);
    lines.push("");

    lines.push("=== SUBSCRIPTIONS ===");
    lines.push(`Trial,${analytics.subscriptions.byPlan.trial || 0}`);
    lines.push(`Pro,${analytics.subscriptions.byPlan.pro || 0}`);
    lines.push(`Business,${analytics.subscriptions.byPlan.business || 0}`);
    lines.push(`Active Trials,${analytics.subscriptions.activeTrials}`);
    lines.push(`Expired Trials,${analytics.subscriptions.expiredTrials}`);
    lines.push(`Churn Rate,${analytics.subscriptions.churnRate}%`);
    lines.push("");

    lines.push("=== ACTIVITY ===");
    lines.push(`Total Bookings,${analytics.activity.totalBookings}`);
    lines.push(`Confirmed,${analytics.activity.bookingsByStatus.confirmed || 0}`);
    lines.push(`Pending,${analytics.activity.bookingsByStatus.pending || 0}`);
    lines.push(`Cancelled,${analytics.activity.bookingsByStatus.cancelled || 0}`);
    lines.push(`Total Conversations,${analytics.activity.totalConversations}`);
    lines.push(`Total Messages,${analytics.activity.totalMessages}`);
    lines.push("");

    lines.push("=== TOP BUSINESSES ===");
    lines.push("Name,Plan,Bot Active,Bookings,Conversations,Messages Used");
    analytics.topBusinesses.forEach((b) => {
      lines.push(`"${b.name}",${b.plan},${b.botActive ? "Yes" : "No"},${b.bookings},${b.conversations},${b.messagesUsed}`);
    });
    lines.push("");

    lines.push("=== DAILY REGISTRATIONS ===");
    lines.push("Date,Count");
    analytics.chartData.registrations.forEach((r) => {
      lines.push(`${r.date},${r.count}`);
    });

    return lines.join("\n");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-400 py-12">
        Ошибка загрузки данных
      </div>
    );
  }

  const maxRegistrations = Math.max(...data.chartData.registrations.map((r) => r.count), 1);
  const maxBookings = Math.max(...data.chartData.bookings.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Аналитика</h1>
          <p className="text-gray-400">Детальная статистика Staffix</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="7">7 дней</option>
            <option value="30">30 дней</option>
            <option value="90">90 дней</option>
            <option value="365">1 год</option>
          </select>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportReport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Экспорт
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Всего пользователей"
          value={data.overview.totalUsers}
          change={`+${data.overview.newUsers} за период`}
          changeType="positive"
          icon={<Users className="h-5 w-5" />}
          gradient="from-blue-500 to-cyan-500"
        />
        <MetricCard
          title="MRR"
          value={`$${data.overview.totalMRR}`}
          change={`Pro: $${data.overview.mrrByPlan.pro} | Biz: $${data.overview.mrrByPlan.business}`}
          changeType="neutral"
          icon={<DollarSign className="h-5 w-5" />}
          gradient="from-green-500 to-emerald-500"
        />
        <MetricCard
          title="Конверсия"
          value={`${data.funnel.conversionRate}%`}
          change={`${data.funnel.paid} платных из ${data.funnel.registered}`}
          changeType="neutral"
          icon={<TrendingUp className="h-5 w-5" />}
          gradient="from-purple-500 to-pink-500"
        />
        <MetricCard
          title="Churn Rate"
          value={`${data.subscriptions.churnRate}%`}
          change={`${data.subscriptions.expiredTrials} истекших триалов`}
          changeType={data.subscriptions.churnRate > 30 ? "negative" : "neutral"}
          icon={<Percent className="h-5 w-5" />}
          gradient="from-orange-500 to-red-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registrations Chart */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              Регистрации
            </h3>
            <span className="text-sm text-gray-400">{data.overview.newUsers} за период</span>
          </div>
          <div className="h-48 flex items-end gap-1">
            {data.chartData.registrations.slice(-14).map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                  style={{ height: `${(item.count / maxRegistrations) * 100}%`, minHeight: item.count > 0 ? "4px" : "0" }}
                />
                <span className="text-[10px] text-gray-500 rotate-45 origin-left">
                  {formatDate(item.date)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings Chart */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-400" />
              Записи
            </h3>
            <span className="text-sm text-gray-400">{data.activity.totalBookings} за период</span>
          </div>
          <div className="h-48 flex items-end gap-1">
            {data.chartData.bookings.slice(-14).map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t"
                  style={{ height: `${(item.count / maxBookings) * 100}%`, minHeight: item.count > 0 ? "4px" : "0" }}
                />
                <span className="text-[10px] text-gray-500 rotate-45 origin-left">
                  {formatDate(item.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-400" />
            Воронка конверсии
          </h3>
          <div className="space-y-4">
            <FunnelStep
              label="Регистрация"
              value={data.funnel.registered}
              percentage={100}
              color="bg-blue-500"
            />
            <FunnelStep
              label="Создали бизнес"
              value={data.funnel.withBusiness}
              percentage={data.funnel.registered > 0 ? Math.round((data.funnel.withBusiness / data.funnel.registered) * 100) : 0}
              color="bg-purple-500"
            />
            <FunnelStep
              label="Запустили бота"
              value={data.funnel.withBot}
              percentage={data.funnel.registered > 0 ? Math.round((data.funnel.withBot / data.funnel.registered) * 100) : 0}
              color="bg-orange-500"
            />
            <FunnelStep
              label="Оплатили"
              value={data.funnel.paid}
              percentage={data.funnel.registered > 0 ? Math.round((data.funnel.paid / data.funnel.registered) * 100) : 0}
              color="bg-green-500"
            />
          </div>
        </div>

        {/* Subscriptions by Plan */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-orange-400" />
            Подписки по планам
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-400">Trial</span>
              </div>
              <span className="text-white font-medium">{data.subscriptions.byPlan.trial || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-teal-500" />
                <span className="text-gray-400">Starter ($20/мес)</span>
              </div>
              <span className="text-white font-medium">{data.subscriptions.byPlan.starter || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-gray-400">Pro ($45/мес)</span>
              </div>
              <span className="text-white font-medium">{data.subscriptions.byPlan.pro || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-400">Business ($95/мес)</span>
              </div>
              <span className="text-white font-medium">{data.subscriptions.byPlan.business || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-gray-400">Enterprise ($180/мес)</span>
              </div>
              <span className="text-white font-medium">{data.subscriptions.byPlan.enterprise || 0}</span>
            </div>
            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Активных триалов</span>
                <span className="text-green-400">{data.subscriptions.activeTrials}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-500">Истекших триалов</span>
                <span className="text-red-400">{data.subscriptions.expiredTrials}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-400" />
            Активность
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                <span className="text-gray-400">Записей</span>
              </div>
              <span className="text-white font-medium">{data.activity.totalBookings}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-400" />
                <span className="text-gray-400">Диалогов</span>
              </div>
              <span className="text-white font-medium">{data.activity.totalConversations}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-400" />
                <span className="text-gray-400">Сообщений</span>
              </div>
              <span className="text-white font-medium">{data.activity.totalMessages}</span>
            </div>
            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 mb-2">Статусы записей</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Подтверждено</span>
                  <span className="text-green-400">{data.activity.bookingsByStatus.confirmed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ожидает</span>
                  <span className="text-yellow-400">{data.activity.bookingsByStatus.pending || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Отменено</span>
                  <span className="text-red-400">{data.activity.bookingsByStatus.cancelled || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Завершено</span>
                  <span className="text-blue-400">{data.activity.bookingsByStatus.completed || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Utilization */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Использование сообщений</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                style={{ width: `${data.overview.messagesUtilization}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-medium">{data.overview.messagesUtilization}%</p>
            <p className="text-xs text-gray-500">
              {data.overview.messagesUsed.toLocaleString()} / {data.overview.messagesLimit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Top Businesses */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Топ бизнесы по активности</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Бизнес</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">План</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Бот</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Записи</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Диалоги</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Сообщения</th>
              </tr>
            </thead>
            <tbody>
              {data.topBusinesses.map((business) => (
                <tr key={business.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4 text-white">{business.name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      business.plan === "business"
                        ? "bg-green-500/10 text-green-400"
                        : business.plan === "pro"
                        ? "bg-purple-500/10 text-purple-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}>
                      {business.plan}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Bot className={`h-4 w-4 ${business.botActive ? "text-green-400" : "text-gray-500"}`} />
                  </td>
                  <td className="py-3 px-4 text-gray-300">{business.bookings}</td>
                  <td className="py-3 px-4 text-gray-300">{business.conversations}</td>
                  <td className="py-3 px-4 text-gray-300">{business.messagesUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  changeType,
  icon,
  gradient,
}: {
  title: string;
  value: string | number;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs ${
          changeType === "positive" ? "text-green-400" :
          changeType === "negative" ? "text-red-400" :
          "text-gray-400"
        }`}>
          {changeType === "positive" && <ArrowUpRight className="h-3 w-3" />}
          {changeType === "negative" && <ArrowDownRight className="h-3 w-3" />}
          <span className="truncate max-w-[100px]">{change}</span>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: number;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-sm text-white">{value} ({percentage}%)</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
