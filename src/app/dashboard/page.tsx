"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Brain,
  MessageSquare,
  Calendar,
  Users,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Scissors,
  Package,
  FileText,
  Globe,
  Send,
  BarChart3,
} from "lucide-react";

type Period = "day" | "week" | "month" | "all";

interface StatsData {
  period: Period;
  stats: {
    bookings: number;
    orders: number;
    clients: number;
    messages: number;
  };
  channels: {
    telegram: boolean;
    whatsapp: boolean;
    instagram: boolean;
  };
  readiness: {
    telegram: boolean;
    team: boolean;
    services: boolean;
    products: boolean;
    knowledge: boolean;
  };
}

interface BizData {
  name: string;
  botActive: boolean;
  botUsername?: string;
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [bizData, setBizData] = useState<BizData | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-400";

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setShowPaymentSuccess(true);
      window.history.replaceState({}, "", "/dashboard");
      const timer = setTimeout(() => setShowPaymentSuccess(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchBiz = async () => {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          if (data.business) {
            setBizData({
              name: data.business.name,
              botActive: data.business.botActive || false,
              botUsername: data.business.botUsername,
            });
          }
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetchBiz();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const res = await fetch(`/api/dashboard/stats?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setStatsData(data);
        }
      } catch {}
      finally { setStatsLoading(false); }
    };
    fetchStats();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const periods: { id: Period; key: string }[] = [
    { id: "day", key: "dashboard.today" },
    { id: "week", key: "dashboard.week" },
    { id: "month", key: "dashboard.month" },
    { id: "all", key: "dashboard.all" },
  ];

  const readinessItems = [
    {
      key: "telegram",
      label: t("nav.telegram"),
      href: "/dashboard/bot",
      icon: MessageSquare,
      done: statsData?.readiness.telegram,
    },
    {
      key: "team",
      label: t("nav.myTeam"),
      href: "/dashboard/staff",
      icon: Users,
      done: statsData?.readiness.team,
    },
    {
      key: "services",
      label: t("nav.myServices"),
      href: "/dashboard/services",
      icon: Scissors,
      done: statsData?.readiness.services,
    },
    {
      key: "products",
      label: t("nav.myProducts"),
      href: "/dashboard/products",
      icon: Package,
      done: statsData?.readiness.products,
    },
    {
      key: "knowledge",
      label: t("nav.knowledge"),
      href: "/dashboard/faq",
      icon: FileText,
      done: statsData?.readiness.knowledge,
    },
  ];

  const readinessDone = readinessItems.filter(r => r.done).length;
  const readinessTotal = readinessItems.length;
  const readinessPct = Math.round((readinessDone / readinessTotal) * 100);

  return (
    <div className="space-y-6">
      {/* Payment success banner */}
      {showPaymentSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-green-400 font-semibold">Оплата прошла успешно!</p>
            <p className={`text-sm ${textSecondary}`}>Ваша подписка активирована. Спасибо за покупку!</p>
          </div>
          <button onClick={() => setShowPaymentSuccess(false)} className="ml-auto text-gray-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary} mb-1`}>{t("dashboard.welcomeTitle")}</h1>
        <p className={textSecondary}>{t("dashboard.welcomeSubtitle")}</p>
      </div>

      {/* ── CHANNELS ── */}
      <div>
        <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted} mb-3`}>
          {t("dashboard.channels")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Telegram */}
          <Link
            href="/dashboard/bot"
            className={`${cardBg} border ${bizData?.botActive ? "border-green-500/30 hover:border-green-500/50" : `${borderColor} hover:border-blue-500/30`} rounded-xl p-4 flex items-center gap-3 transition-all group`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bizData?.botActive ? "bg-green-500/20" : isDark ? "bg-white/5" : "bg-gray-100"}`}>
              <MessageSquare className={`h-5 w-5 ${bizData?.botActive ? "text-green-400" : textMuted}`} />
            </div>
            <div className="flex-1">
              <p className={`font-medium ${textPrimary}`}>{t("nav.telegram")}</p>
              <p className={`text-xs ${bizData?.botActive ? "text-green-400" : textMuted}`}>
                {bizData?.botActive
                  ? bizData.botUsername ? `@${bizData.botUsername}` : t("dashboard.connected")
                  : t("dashboard.notConnected")}
              </p>
            </div>
            {bizData?.botActive
              ? <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
              : <ArrowRight className={`h-4 w-4 ${textMuted} group-hover:text-blue-400 transition-colors flex-shrink-0`} />
            }
          </Link>

          {/* WhatsApp */}
          <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex items-center gap-3 opacity-60`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
              <Globe className={`h-5 w-5 ${textMuted}`} />
            </div>
            <div className="flex-1">
              <p className={`font-medium ${textPrimary}`}>{t("nav.whatsapp")}</p>
              <p className={`text-xs ${textMuted}`}>{t("dashboard.comingSoon")}</p>
            </div>
            <Clock className={`h-4 w-4 ${textMuted} flex-shrink-0`} />
          </div>

          {/* Instagram */}
          <div className={`${cardBg} border ${borderColor} rounded-xl p-4 flex items-center gap-3 opacity-60`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
              <Send className={`h-5 w-5 ${textMuted}`} />
            </div>
            <div className="flex-1">
              <p className={`font-medium ${textPrimary}`}>{t("nav.instagram")}</p>
              <p className={`text-xs ${textMuted}`}>{t("dashboard.comingSoon")}</p>
            </div>
            <Clock className={`h-4 w-4 ${textMuted} flex-shrink-0`} />
          </div>
        </div>
      </div>

      {/* ── STATISTICS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMuted}`}>
            <BarChart3 className="inline h-4 w-4 mr-1" />{t("nav.statistics")}
          </h2>
          {/* Period switcher */}
          <div className={`flex items-center gap-1 p-1 ${isDark ? "bg-white/5" : "bg-gray-100"} rounded-xl`}>
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p.id
                    ? "bg-blue-500 text-white shadow"
                    : `${textSecondary} hover:${textPrimary}`
                }`}
              >
                {t(p.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t("dashboard.messages"), value: statsData?.stats.messages ?? 0, icon: MessageSquare, gradient: "from-cyan-500 to-blue-500" },
            { label: t("dashboard.bookings"), value: statsData?.stats.bookings ?? 0, icon: Calendar, gradient: "from-green-500 to-emerald-500" },
            { label: t("dashboard.orders"), value: statsData?.stats.orders ?? 0, icon: Package, gradient: "from-orange-500 to-amber-500" },
            { label: t("dashboard.clients"), value: statsData?.stats.clients ?? 0, icon: Users, gradient: "from-purple-500 to-pink-500" },
          ].map((item) => (
            <div key={item.label} className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
              <div className={`w-9 h-9 bg-gradient-to-br ${item.gradient} rounded-lg flex items-center justify-center text-white mb-3`}>
                <item.icon className="h-4 w-4" />
              </div>
              <p className={`text-xs ${textMuted} mb-1`}>{item.label}</p>
              {statsLoading ? (
                <div className={`h-7 w-12 ${isDark ? "bg-white/5" : "bg-gray-100"} rounded animate-pulse`} />
              ) : (
                <p className={`text-2xl font-bold ${textPrimary}`}>{item.value.toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── READINESS CHECKLIST ── */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`font-semibold ${textPrimary}`}>{t("dashboard.readiness")}</h2>
          <span className={`text-sm font-medium ${readinessPct === 100 ? "text-green-400" : textSecondary}`}>
            {readinessDone}/{readinessTotal}
          </span>
        </div>

        {/* Progress bar */}
        <div className={`h-1.5 ${isDark ? "bg-white/10" : "bg-gray-100"} rounded-full overflow-hidden mb-4`}>
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${readinessPct}%` }}
          />
        </div>

        <div className="space-y-2">
          {readinessItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                item.done
                  ? isDark ? "bg-green-500/5 border border-green-500/20" : "bg-green-50 border border-green-100"
                  : `${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"} border border-transparent`
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                item.done ? "bg-green-500/20" : isDark ? "bg-white/5" : "bg-gray-100"
              }`}>
                <item.icon className={`h-4 w-4 ${item.done ? "text-green-400" : textMuted}`} />
              </div>
              <span className={`flex-1 text-sm font-medium ${item.done ? "text-green-400" : textSecondary}`}>
                {item.label}
              </span>
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className={`h-5 w-5 ${textMuted} flex-shrink-0`} />
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
