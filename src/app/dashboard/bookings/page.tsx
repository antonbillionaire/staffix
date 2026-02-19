"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, User, Phone, Loader2, Scissors } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Booking {
  id: string;
  clientName: string;
  clientPhone: string | null;
  date: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  serviceName: string | null;
  servicePrice: number | null;
  serviceDuration: number | null;
  staffName: string | null;
  createdAt: string;
}

// UTC offsets in minutes (must match server-side automation.ts)
const TIMEZONE_OFFSETS: Record<string, number> = {
  "Asia/Tashkent": 300, "Asia/Almaty": 300, "Asia/Bishkek": 360,
  "Asia/Dushanbe": 300, "Asia/Ashgabat": 300, "Asia/Baku": 240,
  "Asia/Yerevan": 240, "Asia/Tbilisi": 240,
  "Europe/Kaliningrad": 120, "Europe/Moscow": 180, "Europe/Samara": 240,
  "Asia/Yekaterinburg": 300, "Asia/Omsk": 360, "Asia/Novosibirsk": 420,
  "Asia/Krasnoyarsk": 420, "Asia/Irkutsk": 480, "Asia/Yakutsk": 540,
  "Asia/Vladivostok": 600, "Asia/Kamchatka": 720,
  "Asia/Seoul": 540, "Asia/Tokyo": 540, "Asia/Shanghai": 480,
  "Asia/Dubai": 240, "Asia/Riyadh": 180, "Asia/Istanbul": 180,
  "Europe/London": 0, "Europe/Berlin": 60, "Europe/Paris": 60, "Europe/Kiev": 120,
  "America/New_York": -300, "America/Chicago": -360, "America/Denver": -420, "America/Los_Angeles": -480,
};

function utcToBusinessTime(utcDateStr: string, timezone: string): Date {
  const utcDate = new Date(utcDateStr);
  const offsetMs = (TIMEZONE_OFFSETS[timezone] ?? 300) * 60 * 1000;
  return new Date(utcDate.getTime() + offsetMs);
}

function formatBizDate(utcDateStr: string, timezone: string, locale: string): string {
  const local = utcToBusinessTime(utcDateStr, timezone);
  const months: Record<string, string[]> = {
    "ru-RU": ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
    "en-US": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };
  const days: Record<string, string[]> = {
    "ru-RU": ["вс", "пн", "вт", "ср", "чт", "пт", "сб"],
    "en-US": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  };
  const m = months[locale] || months["ru-RU"];
  const d = days[locale] || days["ru-RU"];
  return `${d[local.getUTCDay()]}, ${local.getUTCDate()} ${m[local.getUTCMonth()]}`;
}

function formatBizTime(utcDateStr: string, timezone: string): string {
  const local = utcToBusinessTime(utcDateStr, timezone);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

export default function BookingsPage() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming");
  const [businessTimezone, setBusinessTimezone] = useState("Asia/Tashkent");

  const locale = language === "en" ? "en-US" : language === "kz" ? "ru-RU" : language === "uz" ? "ru-RU" : "ru-RU";

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings || []);
        if (data.timezone) setBusinessTimezone(data.timezone);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const now = new Date();
  const filtered = bookings.filter((b) => {
    if (filter === "upcoming") return new Date(b.date) >= now && b.status !== "cancelled";
    if (filter === "past") return new Date(b.date) < now || b.status === "cancelled";
    return true;
  });

  const getStatusBadge = (status: Booking["status"]) => {
    const styles = {
      pending: isDark ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-800",
      confirmed: isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-800",
      completed: isDark ? "bg-gray-500/20 text-gray-400" : "bg-gray-100 text-gray-800",
      cancelled: isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-800",
    };
    const labelKeys = {
      pending: "bookingsPage.pending",
      confirmed: "bookingsPage.confirmed",
      completed: "bookingsPage.completed",
      cancelled: "bookingsPage.cancelled",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {t(labelKeys[status])}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
            {t("bookingsPage.title")}
          </h2>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {t("bookingsPage.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["upcoming", "all", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f
                  ? "bg-blue-500 text-white"
                  : isDark
                  ? "text-gray-400 hover:bg-white/5"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "upcoming" ? "Предстоящие" : f === "all" ? "Все" : "Прошедшие"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className={`${isDark ? "bg-[#12122a] border-white/5 text-gray-400" : "bg-white border-gray-200 text-gray-500"} rounded-lg border p-8 text-center`}>
            <Calendar className={`h-12 w-12 mx-auto ${isDark ? "text-gray-600" : "text-gray-300"} mb-3`} />
            <p>{t("bookingsPage.noBookings")}</p>
            <p className="text-sm mt-1">{t("bookingsPage.noBookingsDesc")}</p>
          </div>
        ) : (
          filtered.map((booking) => (
            <div
              key={booking.id}
              className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border p-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      {booking.clientName}
                    </span>
                    {getStatusBadge(booking.status)}
                  </div>
                  {booking.clientPhone && (
                    <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      <Phone className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                      {booking.clientPhone}
                    </div>
                  )}
                  <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    <Scissors className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    <span className="font-medium">{booking.serviceName || "Услуга"}</span>
                    {booking.staffName && (
                      <>
                        {" · "}
                        {booking.staffName}
                      </>
                    )}
                    {booking.servicePrice && (
                      <>
                        {" · "}
                        {booking.servicePrice.toLocaleString()} сум
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    <Calendar className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    {formatBizDate(booking.date, businessTimezone, locale)}
                  </div>
                  <div className={`flex items-center gap-1 mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    <Clock className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    {formatBizTime(booking.date, businessTimezone)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
