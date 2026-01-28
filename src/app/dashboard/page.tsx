"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Brain,
  MessageSquare,
  Calendar,
  Users,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  Clock,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface DashboardData {
  business: {
    name: string;
    botActive: boolean;
    botUsername?: string;
  };
  subscription: {
    messagesUsed: number;
    messagesLimit: number;
    daysLeft: number;
  };
  stats: {
    bookingsToday: number;
    totalClients: number;
    totalMessages: number;
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const result = await res.json();
          if (result.business) {
            const sub = result.business.subscription;
            const daysLeft = sub ? Math.max(0, Math.ceil(
              (new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )) : 14;

            setData({
              business: {
                name: result.business.name,
                botActive: result.business.botActive || false,
                botUsername: result.business.botUsername,
              },
              subscription: {
                messagesUsed: sub?.messagesUsed || 0,
                messagesLimit: sub?.messagesLimit || 100,
                daysLeft,
              },
              stats: {
                bookingsToday: 0, // TODO: fetch from API
                totalClients: 0,
                totalMessages: sub?.messagesUsed || 0,
              },
            });
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const botConnected = data?.business.botActive || false;

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Добро пожаловать в Staffix! 👋
        </h1>
        <p className="text-gray-400">
          Управляйте своим AI-сотрудником и отслеживайте эффективность
        </p>
      </div>

      {/* Alert if bot not connected */}
      {!botConnected && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">AI-сотрудник не активирован</h3>
            <p className="text-sm text-gray-400 mb-3">
              Подключите Telegram бота, чтобы ваш AI-сотрудник начал отвечать клиентам.
            </p>
            <Link
              href="/dashboard/bot"
              className="inline-flex items-center gap-2 text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Активировать сотрудника <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Brain className="h-5 w-5" />}
          title="AI-сотрудник"
          value={botConnected ? "Активен" : "Не активен"}
          subtitle={botConnected ? `@${data?.business.botUsername}` : "требуется настройка"}
          gradient="from-blue-500 to-purple-500"
          status={botConnected ? "success" : "warning"}
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="Сообщений"
          value={`${data?.subscription.messagesUsed || 0}`}
          subtitle={`из ${data?.subscription.messagesLimit || 100} доступных`}
          gradient="from-cyan-500 to-blue-500"
          progress={(data?.subscription.messagesUsed || 0) / (data?.subscription.messagesLimit || 100) * 100}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          title="Записей сегодня"
          value={data?.stats.bookingsToday?.toString() || "0"}
          subtitle="новых записей"
          gradient="from-green-500 to-emerald-500"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          title="Клиентов"
          value={data?.stats.totalClients?.toString() || "0"}
          subtitle="всего обращений"
          gradient="from-purple-500 to-pink-500"
        />
      </div>

      {/* Quick Setup */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-400" />
          Быстрая настройка
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SetupCard
            href="/dashboard/bot"
            icon={<Brain className="h-6 w-6" />}
            title="Активировать AI"
            description="Подключите Telegram бота"
            completed={botConnected}
            step={1}
          />
          <SetupCard
            href="/dashboard/services"
            icon={<span className="text-2xl">💇</span>}
            title="Добавить услуги"
            description="Укажите услуги и цены"
            completed={false}
            step={2}
          />
          <SetupCard
            href="/dashboard/staff"
            icon={<Users className="h-6 w-6" />}
            title="Добавить команду"
            description="Настройте мастеров"
            completed={false}
            step={3}
          />
          <SetupCard
            href="/dashboard/faq"
            icon={<FileText className="h-6 w-6" />}
            title="База знаний"
            description="Добавьте FAQ"
            completed={false}
            step={4}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent bookings */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Последние записи</h3>
            <Link href="/dashboard/bookings" className="text-sm text-blue-400 hover:text-blue-300">
              Все записи →
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-12 w-12 text-gray-600 mb-3" />
            <p className="text-gray-400">Пока нет записей</p>
            <p className="text-sm text-gray-500 mt-1">
              Записи появятся, когда клиенты начнут бронировать через AI
            </p>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Активность</h3>
            <span className="text-sm text-gray-500">Последние 7 дней</span>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="h-12 w-12 text-gray-600 mb-3" />
            <p className="text-gray-400">Нет данных за этот период</p>
            <p className="text-sm text-gray-500 mt-1">
              Статистика появится после активации AI-сотрудника
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  gradient,
  status,
  progress,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  gradient: string;
  status?: "success" | "warning";
  progress?: number;
}) {
  return (
    <div className="bg-[#12122a] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
        {status && (
          <div className={`flex items-center gap-1.5 text-xs ${
            status === "success" ? "text-green-400" : "text-yellow-400"
          }`}>
            {status === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {status === "success" ? "Онлайн" : "Офлайн"}
          </div>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function SetupCard({
  href,
  icon,
  title,
  description,
  completed,
  step,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  completed: boolean;
  step: number;
}) {
  return (
    <Link
      href={href}
      className={`relative bg-[#12122a] border rounded-xl p-5 transition-all group ${
        completed
          ? "border-green-500/30 hover:border-green-500/50"
          : "border-white/5 hover:border-white/20"
      }`}
    >
      {/* Step badge */}
      <div className="absolute -top-2 -right-2">
        {completed ? (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        ) : (
          <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-400">
            {step}
          </div>
        )}
      </div>

      <div className={`mb-3 ${completed ? "text-green-400" : "text-gray-400 group-hover:text-white"} transition-colors`}>
        {icon}
      </div>
      <h3 className={`font-medium mb-1 ${completed ? "text-green-400" : "text-white"}`}>
        {title}
      </h3>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
