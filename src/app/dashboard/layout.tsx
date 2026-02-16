"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages } from "@/lib/translations";
import {
  Brain,
  LayoutDashboard,
  Settings,
  Scissors,
  Users,
  Calendar,
  CalendarDays,
  LogOut,
  Menu,
  X,
  Loader2,
  FileText,
  ChevronRight,
  Sparkles,
  CreditCard,
  HelpCircle,
  Mail,
  BarChart3,
  BookOpen,
  PlayCircle,
  AlertTriangle,
  Zap,
  Lock,
  UserCircle,
  Send,
  MessageSquare,
  Globe,
  ChevronDown,
  Bell,
  type LucideIcon,
} from "lucide-react";
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), { ssr: false });
import TrialExpiredBanner from "@/components/TrialExpiredBanner";
import { type PlanId, hasMenuAccess } from "@/lib/plans";

interface NavItem {
  nameKey: string;
  href: string;
  icon: LucideIcon;
  requiredPlan?: PlanId;
  badge?: string;
}

const navigation: NavItem[] = [
  { nameKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { nameKey: "nav.aiEmployee", href: "/dashboard/bot", icon: Brain },
  { nameKey: "nav.channels", href: "/dashboard/channels", icon: MessageSquare },
  { nameKey: "nav.statistics", href: "/dashboard/statistics", icon: BarChart3 },
  { nameKey: "nav.services", href: "/dashboard/services", icon: Scissors },
  { nameKey: "nav.team", href: "/dashboard/staff", icon: Users },
  { nameKey: "nav.knowledge", href: "/dashboard/faq", icon: FileText },
  { nameKey: "nav.bookings", href: "/dashboard/bookings", icon: Calendar },
  { nameKey: "nav.calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { nameKey: "nav.customers", href: "/dashboard/customers", icon: UserCircle },
  { nameKey: "nav.broadcasts", href: "/dashboard/broadcasts", icon: Send },
  { nameKey: "nav.automation", href: "/dashboard/automation", icon: Zap },
  { nameKey: "nav.messages", href: "/dashboard/messages", icon: Mail },
  { nameKey: "nav.settings", href: "/dashboard/settings", icon: Settings },
  { nameKey: "nav.help", href: "/dashboard/support", icon: HelpCircle },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string;
  }>>([]);
  const [subscription, setSubscription] = useState({
    plan: "trial",
    messagesUsed: 0,
    messagesLimit: 100,
    daysLeft: 14,
    isExpired: false,
  });

  // Theme-based classes
  const isDark = theme === "dark";
  const bgMain = isDark ? "bg-[#0a0a1a]" : "bg-gray-50";
  const bgSidebar = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-400";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-100";

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // Fetch business data and unread messages in parallel
        const [res, msgRes] = await Promise.all([
          fetch("/api/business"),
          fetch("/api/support/unread").catch(() => null),
        ]);

        if (res.ok) {
          const data = await res.json();
          if (data.business) {
            if (!data.business.onboardingCompleted) {
              router.push("/onboarding");
              return;
            }
            setBusinessName(data.business.name);
            if (data.business.subscription) {
              const sub = data.business.subscription;
              const expiresAt = new Date(sub.expiresAt);
              const now = new Date();
              const daysLeft = Math.max(0, Math.ceil(
                (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              ));
              const isExpired = expiresAt < now;
              setSubscription({
                plan: sub.plan,
                messagesUsed: sub.messagesUsed,
                messagesLimit: sub.messagesLimit,
                daysLeft,
                isExpired,
              });
            }
          } else {
            router.push("/onboarding");
            return;
          }
        } else if (res.status === 404) {
          router.push("/onboarding");
          return;
        }

        // Process unread messages
        if (msgRes?.ok) {
          const msgData = await msgRes.json();
          setUnreadMessages(msgData.count || 0);
        }
      } catch (error) {
        console.error("Error checking onboarding:", error);
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();

    // Fetch unread notifications count
    const fetchNotifCount = async () => {
      try {
        const res = await fetch("/api/notifications/unread");
        if (res.ok) {
          const data = await res.json();
          setUnreadNotifications(data.count || 0);
        }
      } catch {}
    };
    fetchNotifCount();
    const notifInterval = setInterval(fetchNotifCount, 30000);
    return () => clearInterval(notifInterval);
  }, [router]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const currentLang = languages.find(l => l.id === language) || languages[0];

  if (loading) {
    return (
      <div className={`min-h-screen ${bgMain} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgMain}`}>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 ${bgSidebar} border-r ${borderColor} transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        {/* Logo */}
        <div className={`flex items-center justify-between h-16 px-5 border-b ${borderColor} flex-shrink-0`}>
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className={`text-xl font-bold ${textPrimary}`}>Staffix</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden ${textSecondary} ${hoverBg} p-1 rounded`}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Business name */}
        {businessName && (
          <div className={`px-5 py-4 border-b ${borderColor} flex-shrink-0`}>
            <p className={`text-xs ${textMuted} uppercase tracking-wider`}>{t("sidebar.yourBusiness")}</p>
            <p className={`text-sm font-medium ${textPrimary} truncate mt-1`}>{businessName}</p>
          </div>
        )}

        {/* Navigation - scrollable area */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const isMessages = item.href === "/dashboard/messages";
            const userPlan = subscription.plan as PlanId;
            const hasAccess = hasMenuAccess(userPlan, item.requiredPlan);
            const isLocked = !hasAccess;
            const itemName = t(item.nameKey);

            // For locked items, show upgrade prompt instead of navigating
            if (isLocked) {
              return (
                <Link
                  key={item.nameKey}
                  href="/pricing"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${textMuted} ${hoverBg} group`}
                >
                  <item.icon className="h-5 w-5 opacity-50" />
                  <span className="opacity-50">{itemName}</span>
                  {item.badge && (
                    <span className="ml-auto flex items-center gap-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      <Lock className="h-3 w-3" />
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            }

            return (
              <Link
                key={item.nameKey}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-500 border border-blue-500/30"
                    : `${textSecondary} ${hoverBg} hover:${textPrimary}`
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-500' : ''}`} />
                {itemName}
                {isMessages && unreadMessages > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {unreadMessages}
                  </span>
                )}
                {isActive && !isMessages && <ChevronRight className="h-4 w-4 ml-auto text-blue-500" />}
              </Link>
            );
          })}

          {/* Resources section */}
          <div className={`mt-4 pt-4 border-t ${borderColor}`}>
            <p className={`px-4 mb-2 text-xs font-medium uppercase tracking-wider ${textMuted}`}>
              {t("nav.resources")}
            </p>
            {[
              { nameKey: "nav.docs", href: "/docs", icon: FileText },
              { nameKey: "nav.tutorials", href: "/tutorials", icon: PlayCircle },
              { nameKey: "nav.publicFaq", href: "/faq", icon: BookOpen },
            ].map((item) => (
              <Link
                key={item.nameKey}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${textSecondary} ${hoverBg}`}
              >
                <item.icon className="h-4 w-4" />
                {t(item.nameKey)}
              </Link>
            ))}
          </div>
        </nav>

        {/* Subscription card - fixed at bottom */}
        <div className={`flex-shrink-0 p-4 border-t ${borderColor}`}>
          <div className={`bg-gradient-to-br from-blue-600/20 to-purple-600/20 border ${borderColor} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className={`text-sm font-medium ${textPrimary}`}>
                {t(`plan.${subscription.plan}`)}
              </span>
            </div>

            {/* Messages progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className={textSecondary}>{t("sidebar.messages")}</span>
                <span className={textPrimary}>{subscription.messagesUsed}/{subscription.messagesLimit}</span>
              </div>
              <div className={`h-1.5 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.min(100, (subscription.messagesUsed / subscription.messagesLimit) * 100)}%` }}
                />
              </div>
            </div>

            {subscription.plan === 'trial' && (
              <p className={`text-xs ${textSecondary} mb-3`}>
                {t("sidebar.daysLeft", { days: subscription.daysLeft })}
              </p>
            )}

            <Link
              href="/pricing"
              className={`flex items-center justify-center gap-2 w-full py-2 ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} rounded-lg text-sm ${textPrimary} font-medium transition-colors`}
            >
              <CreditCard className="h-4 w-4" />
              {t("sidebar.choosePlan")}
            </Link>
          </div>
        </div>

        {/* Logout */}
        <div className={`flex-shrink-0 p-4 border-t ${borderColor}`}>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium ${textSecondary} ${hoverBg} transition-all`}
          >
            <LogOut className="h-5 w-5" />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className={`sticky top-0 z-30 h-16 ${isDark ? 'bg-[#0a0a1a]/80' : 'bg-white/80'} backdrop-blur-xl border-b ${borderColor} flex items-center justify-between px-4 lg:px-8`}>
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden ${textSecondary} mr-4`}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className={`text-lg font-semibold ${textPrimary}`}>
              {t(navigation.find((item) => item.href === pathname)?.nameKey || "dashboard.title")}
            </h1>
          </div>

          <div className="flex items-center gap-2">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={async () => {
                setNotifMenuOpen(!notifMenuOpen);
                if (!notifMenuOpen) {
                  try {
                    const res = await fetch("/api/notifications");
                    if (res.ok) {
                      const data = await res.json();
                      setNotifications(data.notifications || []);
                    }
                  } catch {}
                }
              }}
              className={`relative p-2 rounded-lg ${hoverBg} ${textSecondary} transition-colors`}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>

            {notifMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifMenuOpen(false)} />
                <div className={`absolute right-0 mt-2 w-80 ${bgSidebar} border ${borderColor} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
                    <span className={`text-sm font-medium ${textPrimary}`}>{t("notifications.title")}</span>
                    {unreadNotifications > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch("/api/notifications", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ markAll: true }),
                            });
                            setUnreadNotifications(0);
                            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
                          } catch {}
                        }}
                        className="text-xs text-blue-500 hover:text-blue-400"
                      >
                        {t("notifications.markAllRead")}
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className={`text-sm ${textMuted} text-center py-6`}>{t("notifications.empty")}</p>
                    ) : (
                      notifications.slice(0, 10).map((notif) => (
                        <div
                          key={notif.id}
                          onClick={async () => {
                            if (!notif.isRead) {
                              try {
                                await fetch("/api/notifications", {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: notif.id }),
                                });
                                setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                                setUnreadNotifications(Math.max(0, unreadNotifications - 1));
                              } catch {}
                            }
                          }}
                          className={`px-4 py-3 border-b ${borderColor} cursor-pointer ${hoverBg} transition-colors ${!notif.isRead ? (isDark ? 'bg-blue-500/5' : 'bg-blue-50') : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-sm mt-0.5">
                              {notif.type === "new_booking" ? "📅" : notif.type === "cancellation" ? "❌" : "🔄"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${textPrimary} truncate`}>{notif.title}</p>
                              <p className={`text-xs ${textMuted} mt-0.5 line-clamp-2`}>{notif.message.replace(/<[^>]*>/g, '')}</p>
                              <p className={`text-[10px] ${textMuted} mt-1`}>
                                {new Date(notif.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {!notif.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${hoverBg} ${textSecondary} transition-colors`}
            >
              <Globe className="h-4 w-4" />
              <span className="text-lg">{currentLang.flag}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {langMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangMenuOpen(false)}
                />
                <div className={`absolute right-0 mt-2 w-48 ${bgSidebar} border ${borderColor} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  {languages.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => {
                        setLanguage(lang.id);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm ${
                        language === lang.id
                          ? 'bg-blue-500/20 text-blue-500'
                          : `${textSecondary} ${hoverBg}`
                      } transition-colors`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.name}</span>
                      {language === lang.id && (
                        <span className="ml-auto text-blue-500">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          </div>
        </header>

        {/* Trial expired banner */}
        {subscription.plan === "trial" && subscription.isExpired && (
          <TrialExpiredBanner />
        )}

        {/* Low messages warning */}
        {subscription.messagesLimit - subscription.messagesUsed <= 50 && (
          <div className={`mx-4 md:mx-8 mt-4 p-4 rounded-xl border ${
            subscription.messagesLimit - subscription.messagesUsed <= 10
              ? "bg-red-500/10 border-red-500/30"
              : "bg-yellow-500/10 border-yellow-500/30"
          }`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                subscription.messagesLimit - subscription.messagesUsed <= 10
                  ? "text-red-500"
                  : "text-yellow-500"
              }`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${textPrimary}`}>
                  {subscription.messagesLimit - subscription.messagesUsed <= 10
                    ? t("warning.messagesAlmostOut")
                    : t("warning.lowMessages")}
                </p>
                <p className={`text-xs ${textSecondary}`}>
                  {t("warning.remaining", {
                    count: subscription.messagesLimit - subscription.messagesUsed,
                    total: subscription.messagesLimit
                  })}{" "}
                  <Link href="/pricing" className="text-blue-400 hover:text-blue-300">
                    {t("warning.upgradePlan")}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="p-4 md:p-8">{children}</main>

        {/* Chat Widget */}
        <ChatWidget />
      </div>
    </div>
  );
}
