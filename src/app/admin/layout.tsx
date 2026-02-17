"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Mail,
  Settings,
  LogOut,
  Menu,
  X,
  Loader2,
  TrendingUp,
  Bell,
  Shield,
  Zap,
  CreditCard,
  Target,
} from "lucide-react";

const adminNav = [
  { name: "Дашборд", href: "/admin", icon: LayoutDashboard },
  { name: "Клиенты", href: "/admin/users", icon: Users },
  { name: "Подписки", href: "/admin/subscriptions", icon: CreditCard },
  { name: "Лиды", href: "/admin/sales-leads", icon: Target },
  { name: "Рассылки", href: "/admin/broadcasts", icon: Mail },
  { name: "Автоматизации", href: "/admin/automations", icon: Zap },
  { name: "Аналитика", href: "/admin/analytics", icon: TrendingUp },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/admin/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.isAdmin) {
            setIsAuthorized(true);
            setAdminEmail(data.email);
          } else {
            router.push("/dashboard");
          }
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
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
        } flex flex-col`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/5 flex-shrink-0">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white">Admin</span>
              <span className="text-xs text-gray-500 block">Staffix CRM</span>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:bg-white/5 p-1 rounded"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Admin info */}
        <div className="px-5 py-4 border-b border-white/5 flex-shrink-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Администратор</p>
          <p className="text-sm font-medium text-white truncate mt-1">{adminEmail}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-red-600/20 to-orange-600/20 text-orange-500 border border-orange-500/30"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-orange-500" : ""}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Quick stats */}
        <div className="flex-shrink-0 p-4 border-t border-white/5">
          <div className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-white">Уведомления</span>
            </div>
            <p className="text-xs text-gray-400">
              Система работает нормально
            </p>
          </div>
        </div>

        {/* Back to dashboard & Logout */}
        <div className="flex-shrink-0 p-4 border-t border-white/5 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-400 hover:bg-white/5 transition-all"
          >
            <LayoutDashboard className="h-5 w-5" />
            Вернуться в дашборд
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-400 hover:bg-white/5 transition-all"
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
            className="lg:hidden text-gray-400 mr-4"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">
              {adminNav.find((item) =>
                item.href === pathname ||
                (item.href !== "/admin" && pathname.startsWith(item.href))
              )?.name || "Admin Panel"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">v1.0</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
