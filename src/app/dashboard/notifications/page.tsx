"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Bell, CheckCheck, Calendar, X, RefreshCw } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bgMain = isDark ? "bg-[#0a0a1a]" : "bg-gray-50";
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-gray-400" : "text-gray-500";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const typeIcon = (type: string) => {
    if (type === "new_booking") return "📅";
    if (type === "cancellation") return "❌";
    if (type === "reschedule") return "🔄";
    return "🔔";
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className={`min-h-screen ${bgMain} p-4 sm:p-6`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${textPrimary}`}>Уведомления</h1>
              <p className={`text-sm ${textMuted}`}>
                {unreadCount > 0 ? `${unreadCount} непрочитанных` : "Все прочитаны"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotifications}
              className={`p-2 rounded-lg ${hoverBg} transition-colors ${textMuted}`}
              title="Обновить"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Прочитать все
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className={`text-sm ${textMuted}`}>Загрузка...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center">
                <Bell className={`w-6 h-6 ${textMuted}`} />
              </div>
              <p className={`text-sm ${textMuted}`}>Нет уведомлений</p>
            </div>
          ) : (
            notifications.map((notif, i) => (
              <div
                key={notif.id}
                onClick={() => !notif.isRead && markRead(notif.id)}
                className={`
                  flex items-start gap-3 px-4 py-4 border-b ${borderColor} last:border-0
                  ${!notif.isRead ? (isDark ? "bg-blue-500/5" : "bg-blue-50/60") : ""}
                  ${!notif.isRead ? "cursor-pointer " + hoverBg : ""}
                  transition-colors
                `}
              >
                <span className="text-xl mt-0.5 flex-shrink-0">{typeIcon(notif.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${textPrimary}`}>{notif.title}</p>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className={`text-sm ${textMuted} mt-0.5`}>
                    {notif.message.replace(/<[^>]*>/g, "")}
                  </p>
                  <p className={`text-xs ${textMuted} mt-1.5`}>
                    {new Date(notif.createdAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
