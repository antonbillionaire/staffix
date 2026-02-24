"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Calendar,
  Users,
  ShoppingBag,
  Mail,
  BarChart3,
  Send,
  Zap,
  CalendarDays,
  Loader2,
  TrendingUp,
  ArrowRight,
  Package,
} from "lucide-react";

type Period = "day" | "week" | "month" | "all";

interface StatsData {
  stats: {
    bookings: number;
    orders: number;
    clients: number;
    messages: number;
  };
}

export default function BusinessPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("week");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-400";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/stats?period=${period}`);
        if (res.ok) setStats(await res.json());
      } catch {}
      finally { setLoading(false); }
    };
    fetch_();
  }, [period]);

  const periods: { id: Period; key: string }[] = [
    { id: "day", key: "dashboard.today" },
    { id: "week", key: "dashboard.week" },
    { id: "month", key: "dashboard.month" },
    { id: "all", key: "dashboard.all" },
  ];

  const sections = [
    { label: t("nav.myBookings"), href: "/dashboard/bookings", icon: Calendar, value: stats?.stats.bookings ?? 0, gradient: "from-green-500 to-emerald-500" },
    { label: t("nav.myClients"), href: "/dashboard/customers", icon: Users, value: stats?.stats.clients ?? 0, gradient: "from-blue-500 to-cyan-500" },
    { label: t("nav.myCalendar"), href: "/dashboard/calendar", icon: CalendarDays, value: null, gradient: "from-indigo-500 to-blue-500" },
    { label: t("nav.myOrders"), href: "/dashboard/orders", icon: ShoppingBag, value: stats?.stats.orders ?? 0, gradient: "from-orange-500 to-amber-500" },
    { label: t("nav.myMessages"), href: "/dashboard/messages", icon: Mail, value: stats?.stats.messages ?? 0, gradient: "from-cyan-500 to-blue-500" },
    { label: t("nav.myStats"), href: "/dashboard/statistics", icon: BarChart3, value: null, gradient: "from-purple-500 to-pink-500" },
    { label: t("nav.myBroadcasts"), href: "/dashboard/broadcasts", icon: Send, value: null, gradient: "from-rose-500 to-pink-500" },
    { label: t("nav.myAutomation"), href: "/dashboard/automation", icon: Zap, value: null, gradient: "from-yellow-500 to-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary} mb-1`}>{t("nav.myBusiness")}</h1>
        <p className={textSecondary}>Записи, клиенты, заказы и аналитика</p>
      </div>

      {/* Period + Summary */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            <h2 className={`font-semibold ${textPrimary}`}>{t("nav.myStats")}</h2>
          </div>
          <div className={`flex items-center gap-1 p-1 ${isDark ? "bg-white/5" : "bg-gray-100"} rounded-xl`}>
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p.id ? "bg-blue-500 text-white shadow" : `${textSecondary} hover:${textPrimary}`
                }`}
              >
                {t(p.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("dashboard.bookings"), value: stats?.stats.bookings ?? 0, icon: Calendar, color: "text-green-400" },
            { label: t("dashboard.orders"), value: stats?.stats.orders ?? 0, icon: Package, color: "text-orange-400" },
            { label: t("dashboard.clients"), value: stats?.stats.clients ?? 0, icon: Users, color: "text-blue-400" },
            { label: t("dashboard.messages"), value: stats?.stats.messages ?? 0, icon: Mail, color: "text-cyan-400" },
          ].map(item => (
            <div key={item.label} className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-xl p-3 text-center`}>
              <item.icon className={`h-5 w-5 ${item.color} mx-auto mb-1`} />
              <p className={`text-xs ${textMuted} mb-1`}>{item.label}</p>
              {loading ? (
                <div className={`h-6 w-10 mx-auto ${isDark ? "bg-white/10" : "bg-gray-200"} rounded animate-pulse`} />
              ) : (
                <p className={`text-xl font-bold ${textPrimary}`}>{item.value.toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick navigation grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className={`${cardBg} border ${borderColor} rounded-xl p-4 ${hoverBg} hover:border-blue-500/30 transition-all group`}
          >
            <div className={`w-10 h-10 bg-gradient-to-br ${section.gradient} rounded-xl flex items-center justify-center text-white mb-3`}>
              <section.icon className="h-5 w-5" />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-xs ${textMuted} mb-0.5`}>{section.label}</p>
                {section.value !== null ? (
                  loading ? (
                    <div className={`h-5 w-8 ${isDark ? "bg-white/10" : "bg-gray-200"} rounded animate-pulse`} />
                  ) : (
                    <p className={`text-lg font-bold ${textPrimary}`}>{section.value.toLocaleString()}</p>
                  )
                ) : (
                  <p className={`text-sm font-medium ${textSecondary}`}>→</p>
                )}
              </div>
              <ArrowRight className={`h-4 w-4 ${textMuted} group-hover:text-blue-400 transition-colors`} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
