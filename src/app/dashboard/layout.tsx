"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Brain,
  LayoutDashboard,
  Settings,
  Scissors,
  Users,
  Calendar,
  LogOut,
  Menu,
  X,
  Loader2,
  FileText,
  ChevronRight,
  Sparkles,
  CreditCard,
} from "lucide-react";

const navigation = [
  { name: "Главная", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI-сотрудник", href: "/dashboard/bot", icon: Brain },
  { name: "Услуги", href: "/dashboard/services", icon: Scissors },
  { name: "Команда", href: "/dashboard/staff", icon: Users },
  { name: "База знаний", href: "/dashboard/faq", icon: FileText },
  { name: "Записи", href: "/dashboard/bookings", icon: Calendar },
  { name: "Настройки", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [subscription, setSubscription] = useState({
    plan: "trial",
    messagesUsed: 0,
    messagesLimit: 100,
    daysLeft: 14,
  });

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await fetch("/api/business");
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
              const daysLeft = Math.max(0, Math.ceil(
                (new Date(sub.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              ));
              setSubscription({
                plan: sub.plan,
                messagesUsed: sub.messagesUsed,
                messagesLimit: sub.messagesLimit,
                daysLeft,
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
      } catch (error) {
        console.error("Error checking onboarding:", error);
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [router]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-[#12122a] border-r border-white/5 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Staffix</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Business name */}
        {businessName && (
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Ваш бизнес</p>
            <p className="text-sm font-medium text-white truncate mt-1">{businessName}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'text-blue-400' : ''}`} />
                {item.name}
                {isActive && <ChevronRight className="h-4 w-4 ml-auto text-blue-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Subscription card */}
        <div className="absolute bottom-20 left-4 right-4">
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium text-white capitalize">
                {subscription.plan === 'trial' ? 'Пробный период' : subscription.plan}
              </span>
            </div>

            {/* Messages progress */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Сообщений</span>
                <span className="text-white">{subscription.messagesUsed}/{subscription.messagesLimit}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  style={{ width: `${Math.min(100, (subscription.messagesUsed / subscription.messagesLimit) * 100)}%` }}
                />
              </div>
            </div>

            {subscription.plan === 'trial' && (
              <p className="text-xs text-gray-400 mb-3">
                Осталось {subscription.daysLeft} дней
              </p>
            )}

            <Link
              href="/dashboard/settings"
              className="flex items-center justify-center gap-2 w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Выбрать тариф
            </Link>
          </div>
        </div>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut className="h-5 w-5" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-[#0a0a1a]/80 backdrop-blur-xl border-b border-white/5 flex items-center px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white mr-4"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white">
              {navigation.find((item) => item.href === pathname)?.name || "Панель управления"}
            </h1>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
