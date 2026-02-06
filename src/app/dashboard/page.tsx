"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Theme-aware styles
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-500" : "text-gray-500";

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
                bookingsToday: result.stats?.bookingsToday || 0,
                totalClients: result.stats?.totalClients || 0,
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
        <h1 className={`text-2xl font-bold ${textPrimary} mb-2`}>
          {t("dashboard.welcomeTitle")}
        </h1>
        <p className={textSecondary}>
          {t("dashboard.welcomeSubtitle")}
        </p>
      </div>

      {/* Alert if bot not connected */}
      {!botConnected && (
        <div className={`${isDark ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10" : "bg-yellow-50"} border border-yellow-500/30 rounded-xl p-5 flex items-start gap-4`}>
          <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${textPrimary} mb-1`}>{t("dashboard.aiNotActive")}</h3>
            <p className={`text-sm ${textSecondary} mb-3`}>
              {t("dashboard.aiNotActiveDesc")}
            </p>
            <Link
              href="/dashboard/bot"
              className="inline-flex items-center gap-2 text-sm font-medium text-yellow-600 hover:text-yellow-500 transition-colors"
            >
              {t("dashboard.activateEmployee")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Brain className="h-5 w-5" />}
          title={t("dashboard.aiEmployee")}
          value={botConnected ? t("dashboard.active") : t("dashboard.inactive")}
          subtitle={botConnected ? `@${data?.business.botUsername}` : t("dashboard.needsSetup")}
          gradient="from-blue-500 to-purple-500"
          status={botConnected ? "success" : "warning"}
          cardBg={cardBg}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textTertiary={textTertiary}
          t={t}
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          title={t("dashboard.messages")}
          value={`${data?.subscription.messagesUsed || 0}`}
          subtitle={t("dashboard.ofAvailable", { limit: data?.subscription.messagesLimit || 100 })}
          gradient="from-cyan-500 to-blue-500"
          progress={(data?.subscription.messagesUsed || 0) / (data?.subscription.messagesLimit || 100) * 100}
          cardBg={cardBg}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textTertiary={textTertiary}
          t={t}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          title={t("dashboard.bookingsToday")}
          value={data?.stats.bookingsToday?.toString() || "0"}
          subtitle={t("dashboard.newBookings")}
          gradient="from-green-500 to-emerald-500"
          cardBg={cardBg}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textTertiary={textTertiary}
          t={t}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          title={t("dashboard.customers")}
          value={data?.stats.totalClients?.toString() || "0"}
          subtitle={t("dashboard.totalRequests")}
          gradient="from-purple-500 to-pink-500"
          cardBg={cardBg}
          borderColor={borderColor}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textTertiary={textTertiary}
          t={t}
        />
      </div>

      {/* Quick Setup */}
      <div>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
          <Sparkles className="h-5 w-5 text-yellow-400" />
          {t("dashboard.quickSetup")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SetupCard
            href="/dashboard/bot"
            icon={<Brain className="h-6 w-6" />}
            title={t("dashboard.activateAI")}
            description={t("dashboard.connectTelegram")}
            completed={botConnected}
            step={1}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            isDark={isDark}
          />
          <SetupCard
            href="/dashboard/services"
            icon={<span className="text-2xl">💇</span>}
            title={t("dashboard.addServices")}
            description={t("dashboard.specifyPrices")}
            completed={false}
            step={2}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            isDark={isDark}
          />
          <SetupCard
            href="/dashboard/staff"
            icon={<Users className="h-6 w-6" />}
            title={t("dashboard.addTeam")}
            description={t("dashboard.setupMasters")}
            completed={false}
            step={3}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            isDark={isDark}
          />
          <SetupCard
            href="/dashboard/faq"
            icon={<FileText className="h-6 w-6" />}
            title={t("dashboard.knowledgeBase")}
            description={t("dashboard.addFAQ")}
            completed={false}
            step={4}
            cardBg={cardBg}
            borderColor={borderColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            isDark={isDark}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent bookings */}
        <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>{t("dashboard.recentBookings")}</h3>
            <Link href="/dashboard/bookings" className="text-sm text-blue-500 hover:text-blue-400">
              {t("dashboard.allBookings")} →
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className={`h-12 w-12 ${isDark ? "text-gray-600" : "text-gray-400"} mb-3`} />
            <p className={textSecondary}>{t("dashboard.noBookingsYet")}</p>
            <p className={`text-sm ${textTertiary} mt-1`}>
              {t("dashboard.bookingsWillAppear")}
            </p>
          </div>
        </div>

        {/* Activity feed */}
        <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-semibold ${textPrimary}`}>{t("dashboard.activity")}</h3>
            <span className={`text-sm ${textTertiary}`}>{t("dashboard.last7Days")}</span>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className={`h-12 w-12 ${isDark ? "text-gray-600" : "text-gray-400"} mb-3`} />
            <p className={textSecondary}>{t("dashboard.noDataPeriod")}</p>
            <p className={`text-sm ${textTertiary} mt-1`}>
              {t("dashboard.statsAfterActivation")}
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
  cardBg,
  borderColor,
  textPrimary,
  textSecondary,
  textTertiary,
  t,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  gradient: string;
  status?: "success" | "warning";
  progress?: number;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  t: (key: string) => string;
}) {
  return (
    <div className={`${cardBg} border ${borderColor} rounded-xl p-5 hover:border-blue-500/20 transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center text-white`}>
          {icon}
        </div>
        {status && (
          <div className={`flex items-center gap-1.5 text-xs ${
            status === "success" ? "text-green-500" : "text-yellow-500"
          }`}>
            {status === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {status === "success" ? t("dashboard.online") : t("dashboard.offline")}
          </div>
        )}
      </div>
      <p className={`text-sm ${textSecondary} mb-1`}>{title}</p>
      <p className={`text-2xl font-bold ${textPrimary} mb-1`}>{value}</p>
      <p className={`text-xs ${textTertiary}`}>{subtitle}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
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
  cardBg,
  borderColor,
  textPrimary,
  textSecondary,
  isDark,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  completed: boolean;
  step: number;
  cardBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  isDark: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative ${cardBg} border rounded-xl p-5 transition-all group ${
        completed
          ? "border-green-500/30 hover:border-green-500/50"
          : `${borderColor} hover:border-blue-500/30`
      }`}
    >
      {/* Step badge */}
      <div className="absolute -top-2 -right-2">
        {completed ? (
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        ) : (
          <div className={`w-6 h-6 ${isDark ? "bg-gray-700" : "bg-gray-200"} rounded-full flex items-center justify-center text-xs font-bold ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {step}
          </div>
        )}
      </div>

      <div className={`mb-3 ${completed ? "text-green-500" : `${textSecondary} group-hover:text-blue-500`} transition-colors`}>
        {icon}
      </div>
      <h3 className={`font-medium mb-1 ${completed ? "text-green-500" : textPrimary}`}>
        {title}
      </h3>
      <p className={`text-sm ${textSecondary}`}>{description}</p>
    </Link>
  );
}
