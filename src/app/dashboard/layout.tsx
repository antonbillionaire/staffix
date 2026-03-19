"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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
  ArrowLeftRight,
  MessageSquare,
  Globe,
  ChevronDown,
  Bell,
  Link2,
  Package,
  ShoppingBag,
  Building2,
  Briefcase,
  Gift,
  Truck,
  Warehouse,
  Instagram,
  Facebook,
  Phone,
  Target,
  type LucideIcon,
} from "lucide-react";
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), { ssr: false });
const OnboardingWizard = dynamic(() => import("@/components/OnboardingWizard"), { ssr: false });
import TrialExpiredBanner from "@/components/TrialExpiredBanner";
import { type PlanId, hasMenuAccess } from "@/lib/plans";

interface NavChild {
  nameKey: string;
  href: string;
  icon: LucideIcon;
  requiredPlan?: PlanId;
  badge?: "messages";
  children?: NavChild[];
}

interface NavGroup {
  nameKey: string;
  href: string;
  icon: LucideIcon;
  children: NavChild[];
}

interface NavSingle {
  nameKey: string;
  href: string;
  icon: LucideIcon;
  single: true;
}

type NavEntry = NavGroup | NavSingle;

// Detect if business is in sales mode using explicit dashboardMode field
function isSalesDashboard(dashboardMode: string | null): boolean {
  return dashboardMode === "sales";
}

function buildNavConfig(isSales: boolean): NavEntry[] {
  return [
    { nameKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard, single: true },
    {
      nameKey: "nav.aiEmployeeGroup",
      href: "/dashboard/channels",
      icon: Brain,
      children: [
        {
          nameKey: "nav.channelsGroup",
          href: "/dashboard/channels",
          icon: Globe,
          children: [
            { nameKey: "nav.telegram", href: "/dashboard/channels/telegram", icon: MessageSquare },
            { nameKey: "nav.whatsapp", href: "/dashboard/channels/whatsapp", icon: Phone },
            { nameKey: "nav.instagramFacebook", href: "/dashboard/channels/meta", icon: Instagram },
          ],
        },
        { nameKey: "nav.knowledge", href: "/dashboard/knowledge", icon: FileText },
      ],
    },
    {
      nameKey: "nav.myCompany",
      href: "/dashboard/company",
      icon: Building2,
      children: [
        { nameKey: "nav.myTeam", href: "/dashboard/staff", icon: Users },
        ...(!isSales ? [{ nameKey: "nav.myServices", href: "/dashboard/services", icon: Scissors }] : []),
        ...(isSales ? [{ nameKey: "nav.myProducts", href: "/dashboard/products", icon: Package }] : []),
      ],
    },
    {
      nameKey: "nav.myBusiness",
      href: "/dashboard/business",
      icon: Briefcase,
      children: [
        ...(!isSales ? [
          { nameKey: "nav.myBookings", href: "/dashboard/bookings", icon: Calendar },
          { nameKey: "nav.myCalendar", href: "/dashboard/calendar", icon: CalendarDays },
        ] : []),
        ...(isSales ? [
          { nameKey: "nav.myOrders", href: "/dashboard/orders", icon: ShoppingBag },
          { nameKey: "nav.myInventory", href: "/dashboard/inventory", icon: Warehouse },
          { nameKey: "nav.myDelivery", href: "/dashboard/delivery", icon: Truck },
        ] : []),
        { nameKey: "nav.myLeads", href: "/dashboard/leads", icon: Target },
        { nameKey: "nav.myClients", href: "/dashboard/customers", icon: UserCircle },
        { nameKey: "nav.myMessages", href: "/dashboard/messages", icon: Mail, badge: "messages" as const },
        { nameKey: "nav.myStats", href: "/dashboard/statistics", icon: BarChart3 },
        { nameKey: "nav.myBroadcasts", href: "/dashboard/broadcasts", icon: Send },
        { nameKey: "nav.myAutomation", href: "/dashboard/automation", icon: Zap },
        { nameKey: "nav.myLoyalty", href: "/dashboard/loyalty", icon: Gift },
        { nameKey: "nav.payments", href: "/dashboard/payments", icon: CreditCard },
      ],
    },
    { nameKey: "nav.integrations", href: "/dashboard/integrations", icon: Link2, single: true },
    { nameKey: "nav.settings", href: "/dashboard/settings", icon: Settings, single: true },
    { nameKey: "nav.help", href: "/dashboard/support", icon: HelpCircle, single: true },
  ];
}

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
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
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

  // Build nav config based on dashboard mode
  const isSales = isSalesDashboard(dashboardMode);
  const navConfig = useMemo(() => buildNavConfig(isSales), [isSales]);

  // Check if a child (or its nested children) matches current path
  const isChildOrNestedActive = (child: NavChild): boolean => {
    if (pathname === child.href || pathname.startsWith(child.href + "/")) return true;
    if (child.children) return child.children.some(c => pathname === c.href || pathname.startsWith(c.href + "/"));
    return false;
  };

  // Determine which groups are open based on current pathname
  const getInitialOpenGroups = () => {
    const open: string[] = [];
    for (const entry of navConfig) {
      if ("children" in entry) {
        const isChildActive = entry.children.some(child => isChildOrNestedActive(child));
        if (isChildActive || pathname === entry.href) {
          open.push(entry.nameKey);
          // Also open nested sub-groups
          for (const child of entry.children) {
            if (child.children && child.children.some(c => pathname === c.href || pathname.startsWith(c.href + "/"))) {
              open.push(child.nameKey);
            }
          }
        }
      }
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<string[]>(getInitialOpenGroups);

  // Update open groups when pathname changes
  useEffect(() => {
    setOpenGroups(getInitialOpenGroups());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (nameKey: string) => {
    setOpenGroups(prev =>
      prev.includes(nameKey) ? prev.filter(k => k !== nameKey) : [...prev, nameKey]
    );
  };

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
            setBusinessType(data.business.businessType || null);
            setDashboardMode(data.business.dashboardMode || "service");
            setIsAdminUser(!!data.isAdmin);
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

  const [switchingMode, setSwitchingMode] = useState(false);
  const handleSwitchMode = async () => {
    const newMode = isSales ? "service" : "sales";
    setSwitchingMode(true);
    try {
      const res = await fetch("/api/business/dashboard-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });
      if (res.ok) {
        setDashboardMode(newMode);
      }
    } catch {}
    finally { setSwitchingMode(false); }
  };

  const currentLang = languages.find(l => l.id === language) || languages[0];

  // Find current page name for topbar
  const getCurrentPageName = (): string => {
    for (const entry of navConfig) {
      if ("single" in entry && pathname === entry.href) return t(entry.nameKey);
      if ("children" in entry) {
        if (pathname === entry.href) return t(entry.nameKey);
        for (const child of entry.children) {
          if (pathname === child.href) return t(child.nameKey);
        }
      }
    }
    return t("nav.dashboard");
  };

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
          <Link href="/dashboard" className="flex items-center">
            <Image
              src={isDark ? "/new-logo/A2_right_white_text.png" : "/new-logo/5_sfx_wordmark_right.png"}
              alt="Staffix"
              width={160}
              height={40}
              className="h-9 w-auto"
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden ${textSecondary} ${hoverBg} p-1 rounded`}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Business name + mode toggle (mode switch only for admin) */}
        {businessName && (
          <div className={`px-5 py-4 border-b ${borderColor} flex-shrink-0`}>
            <p className={`text-xs ${textMuted} uppercase tracking-wider`}>{t("sidebar.yourBusiness")}</p>
            <p className={`text-sm font-medium ${textPrimary} truncate mt-1`}>{businessName}</p>
            {isAdminUser && <button
              onClick={handleSwitchMode}
              disabled={switchingMode}
              className={`mt-2 flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700"
              } ${switchingMode ? "opacity-50 cursor-wait" : ""}`}
              title={isSales ? "Переключить на сервисный режим" : "Переключить на режим продаж"}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">
                {isSales ? "Режим: Продажи" : "Режим: Услуги"}
              </span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                isSales
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}>
                {isSales ? "Shop" : "Service"}
              </span>
            </button>}
          </div>
        )}

        {/* Navigation - scrollable area */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navConfig.map((entry) => {
            if ("single" in entry) {
              // Single nav item (no children)
              const isActive = pathname === entry.href;
              return (
                <Link
                  key={entry.nameKey}
                  href={entry.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-500 border border-blue-500/30"
                      : `${textSecondary} ${hoverBg}`
                  }`}
                >
                  <entry.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-blue-500" : ""}`} />
                  <span>{t(entry.nameKey)}</span>
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto text-blue-500" />}
                </Link>
              );
            }

            // Group with children
            const group = entry as NavGroup;
            const isGroupOpen = openGroups.includes(group.nameKey);
            const isGroupActive = pathname === group.href || group.children.some(c => isChildOrNestedActive(c));

            return (
              <div key={group.nameKey}>
                {/* Group header */}
                <button
                  onClick={() => {
                    toggleGroup(group.nameKey);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isGroupActive && !isGroupOpen
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-500 border border-blue-500/30"
                      : isGroupActive
                      ? `${isDark ? "text-white" : "text-gray-900"} ${hoverBg}`
                      : `${textSecondary} ${hoverBg}`
                  }`}
                >
                  <group.icon className={`h-5 w-5 flex-shrink-0 ${isGroupActive ? "text-blue-500" : ""}`} />
                  <span className="flex-1 text-left uppercase text-xs tracking-wider">{t(group.nameKey)}</span>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${isGroupOpen ? "rotate-180" : ""} ${isGroupActive ? "text-blue-500" : ""}`}
                  />
                </button>

                {/* Children */}
                {isGroupOpen && (
                  <div className={`mt-0.5 ml-3 pl-3 border-l ${isDark ? "border-white/10" : "border-gray-200"} space-y-0.5`}>
                    {group.children.map((child) => {
                      const isChildActive = pathname === child.href || pathname.startsWith(child.href + "/");
                      const isMessages = child.badge === "messages";
                      const userPlan = subscription.plan as PlanId;
                      const hasAccess = !child.requiredPlan || hasMenuAccess(userPlan, child.requiredPlan);
                      const isLocked = !hasAccess;

                      // If child has nested children, render as sub-group
                      if (child.children) {
                        const isSubGroupOpen = openGroups.includes(child.nameKey);
                        const isSubGroupActive = child.children.some(c => pathname === c.href || pathname.startsWith(c.href + "/"));

                        return (
                          <div key={child.nameKey}>
                            <button
                              onClick={() => {
                                toggleGroup(child.nameKey);
                                if (!isSubGroupOpen) {
                                  setSidebarOpen(false);
                                  router.push(child.href);
                                }
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                isSubGroupActive
                                  ? `${isDark ? "text-white" : "text-gray-900"} font-medium`
                                  : `${textSecondary} ${hoverBg}`
                              }`}
                            >
                              <child.icon className={`h-4 w-4 flex-shrink-0 ${isSubGroupActive ? "text-blue-400" : ""}`} />
                              <span className="flex-1 text-left">{t(child.nameKey)}</span>
                              <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isSubGroupOpen ? "rotate-180" : ""} ${isSubGroupActive ? "text-blue-400" : ""}`} />
                            </button>

                            {isSubGroupOpen && (
                              <div className={`mt-0.5 ml-3 pl-3 border-l ${isDark ? "border-white/10" : "border-gray-200"} space-y-0.5`}>
                                {/* Overview link */}
                                <Link
                                  href={child.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                                    pathname === child.href
                                      ? "bg-blue-500/15 text-blue-400 font-medium"
                                      : `${textSecondary} ${hoverBg}`
                                  }`}
                                >
                                  <Globe className={`h-3.5 w-3.5 flex-shrink-0 ${pathname === child.href ? "text-blue-400" : ""}`} />
                                  <span>Обзор</span>
                                </Link>
                                {child.children.map((nested) => {
                                  const isNestedActive = pathname === nested.href || pathname.startsWith(nested.href + "/");
                                  return (
                                    <Link
                                      key={nested.nameKey}
                                      href={nested.href}
                                      onClick={() => setSidebarOpen(false)}
                                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                                        isNestedActive
                                          ? "bg-blue-500/15 text-blue-400 font-medium"
                                          : `${textSecondary} ${hoverBg}`
                                      }`}
                                    >
                                      <nested.icon className={`h-3.5 w-3.5 flex-shrink-0 ${isNestedActive ? "text-blue-400" : ""}`} />
                                      <span>{t(nested.nameKey)}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (isLocked) {
                        return (
                          <Link
                            key={child.nameKey}
                            href="/pricing"
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${textMuted} ${hoverBg}`}
                          >
                            <child.icon className="h-4 w-4 flex-shrink-0 opacity-40" />
                            <span className="opacity-40">{t(child.nameKey)}</span>
                            <Lock className="h-3 w-3 ml-auto opacity-40" />
                          </Link>
                        );
                      }

                      return (
                        <Link
                          key={child.nameKey}
                          href={child.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                            isChildActive
                              ? "bg-blue-500/15 text-blue-400 font-medium"
                              : `${textSecondary} ${hoverBg}`
                          }`}
                        >
                          <child.icon className={`h-4 w-4 flex-shrink-0 ${isChildActive ? "text-blue-400" : ""}`} />
                          <span>{t(child.nameKey)}</span>
                          {isMessages && unreadMessages > 0 && (
                            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                              {unreadMessages}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Resources section */}
          <div className={`mt-4 pt-4 border-t ${borderColor}`}>
            <p className={`px-3 mb-2 text-xs font-medium uppercase tracking-wider ${textMuted}`}>
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${textSecondary} ${hoverBg}`}
              >
                <item.icon className="h-4 w-4" />
                {t(item.nameKey)}
              </Link>
            ))}
          </div>
        </nav>

        {/* Subscription card */}
        <div className={`flex-shrink-0 p-4 border-t ${borderColor}`}>
          <div className={`bg-gradient-to-br from-blue-600/20 to-purple-600/20 border ${borderColor} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className={`text-sm font-medium ${textPrimary}`}>
                {t(`plan.${subscription.plan}`)}
              </span>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className={textSecondary}>{t("sidebar.messages")}</span>
                <span className={textPrimary}>{subscription.messagesUsed}/{subscription.messagesLimit}</span>
              </div>
              <div className={`h-1.5 ${isDark ? "bg-white/10" : "bg-gray-200"} rounded-full overflow-hidden`}>
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.min(100, (subscription.messagesUsed / subscription.messagesLimit) * 100)}%` }}
                />
              </div>
            </div>
            {subscription.plan === "trial" && (
              <p className={`text-xs ${textSecondary} mb-3`}>
                {t("sidebar.daysLeft", { days: subscription.daysLeft })}
              </p>
            )}
            <Link
              href="/pricing"
              className={`flex items-center justify-center gap-2 w-full py-2 ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-gray-100 hover:bg-gray-200"} rounded-lg text-sm ${textPrimary} font-medium transition-colors`}
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
            className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl text-sm font-medium ${textSecondary} ${hoverBg} transition-all`}
          >
            <LogOut className="h-5 w-5" />
            {t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className={`sticky top-0 z-30 h-16 ${isDark ? "bg-[#0a0a1a]/95" : "bg-white/95"} border-b ${borderColor} flex items-center justify-between px-4 lg:px-8`}>
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden ${textSecondary} mr-4`}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className={`text-lg font-semibold ${textPrimary}`}>
              {getCurrentPageName()}
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
                              setNotifMenuOpen(false);
                              router.push("/dashboard/notifications");
                            }}
                            className={`px-4 py-3 border-b ${borderColor} cursor-pointer ${hoverBg} transition-colors ${!notif.isRead ? (isDark ? "bg-blue-500/5" : "bg-blue-50") : ""}`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-sm mt-0.5">
                                {notif.type === "new_order" ? "🛒" : notif.type === "new_booking" ? "📅" : notif.type === "cancellation" ? "❌" : "🔄"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${textPrimary} truncate`}>{notif.title}</p>
                                <p className={`text-xs ${textMuted} mt-0.5 line-clamp-2`}>{notif.message.replace(/<[^>]*>/g, "")}</p>
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
                <ChevronDown className={`h-4 w-4 transition-transform ${langMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
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
                            ? "bg-blue-500/20 text-blue-500"
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

        {/* Onboarding wizard */}
        <OnboardingWizard />

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
                    total: subscription.messagesLimit,
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
