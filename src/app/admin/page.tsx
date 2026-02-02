"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Clock,
  UserPlus,
  CreditCard,
  Zap,
} from "lucide-react";

interface Stats {
  overview: {
    totalUsers: number;
    totalBusinesses: number;
    activeSubscriptions: number;
    mrr: number;
    conversionRate: number;
  };
  subscriptions: {
    trial: number;
    pro: number;
    business: number;
  };
  activity: {
    newUsersToday: number;
    newUsersThisMonth: number;
    totalMessages: number;
    totalBookings: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    createdAt: string;
    businessName: string | null;
    plan: string;
    expiresAt: string | null;
  }>;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/stats");
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-400 py-12">
        Ошибка загрузки данных
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPlanBadge = (plan: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      trial: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Trial" },
      pro: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Pro" },
      business: { bg: "bg-green-500/10", text: "text-green-400", label: "Business" },
      no_subscription: { bg: "bg-gray-500/10", text: "text-gray-400", label: "Нет" },
    };
    const badge = badges[plan] || badges.no_subscription;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Дашборд</h1>
        <p className="text-gray-400">Обзор ключевых метрик Staffix</p>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Всего пользователей"
          value={stats.overview.totalUsers}
          icon={<Users className="h-5 w-5" />}
          change={`+${stats.activity.newUsersToday} сегодня`}
          changeType="positive"
          gradient="from-blue-500 to-cyan-500"
        />
        <MetricCard
          title="MRR"
          value={`$${stats.overview.mrr}`}
          icon={<DollarSign className="h-5 w-5" />}
          change={`${stats.subscriptions.pro + stats.subscriptions.business} платных`}
          changeType="positive"
          gradient="from-green-500 to-emerald-500"
        />
        <MetricCard
          title="Конверсия"
          value={`${stats.overview.conversionRate}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          change="trial → paid"
          changeType="neutral"
          gradient="from-purple-500 to-pink-500"
        />
        <MetricCard
          title="Активные подписки"
          value={stats.overview.activeSubscriptions}
          icon={<CreditCard className="h-5 w-5" />}
          change={`из ${stats.overview.totalBusinesses} бизнесов`}
          changeType="neutral"
          gradient="from-orange-500 to-red-500"
        />
      </div>

      {/* Subscription breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Подписки по планам</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-400">Trial</span>
              </div>
              <span className="text-white font-medium">{stats.subscriptions.trial}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-gray-400">Pro ($50/мес)</span>
              </div>
              <span className="text-white font-medium">{stats.subscriptions.pro}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-400">Business ($100/мес)</span>
              </div>
              <span className="text-white font-medium">{stats.subscriptions.business}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Активность</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="h-4 w-4 text-blue-400" />
                <span className="text-gray-400">Новых сегодня</span>
              </div>
              <span className="text-white font-medium">{stats.activity.newUsersToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-purple-400" />
                <span className="text-gray-400">За месяц</span>
              </div>
              <span className="text-white font-medium">{stats.activity.newUsersThisMonth}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-green-400" />
                <span className="text-gray-400">Сообщений</span>
              </div>
              <span className="text-white font-medium">{stats.activity.totalMessages}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-yellow-400" />
                <span className="text-gray-400">Записей</span>
              </div>
              <span className="text-white font-medium">{stats.activity.totalBookings}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Быстрые действия</h3>
          <div className="space-y-3">
            <Link
              href="/admin/users"
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-gray-300">Все клиенты</span>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </Link>
            <Link
              href="/admin/broadcasts"
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-gray-300">Новая рассылка</span>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </Link>
            <Link
              href="/admin/analytics"
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-gray-300">Аналитика</span>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent users */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Последние регистрации</h3>
          <Link
            href="/admin/users"
            className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
          >
            Все клиенты
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Пользователь</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Бизнес</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">План</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Дата</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-white font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-300">{user.businessName || "—"}</span>
                  </td>
                  <td className="py-3 px-4">
                    {getPlanBadge(user.plan)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">{formatDate(user.createdAt)}</span>
                    </div>
                  </td>
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
  icon,
  change,
  changeType,
  gradient,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change: string;
  changeType: "positive" | "negative" | "neutral";
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
          {change}
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
