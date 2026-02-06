"use client";

import { Calendar, Clock, User, Phone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Booking {
  id: number;
  clientName: string;
  clientPhone: string;
  service: string;
  staff: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
}

export default function BookingsPage() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // В реальном приложении данные будут загружаться с API
  const bookings: Booking[] = [
    {
      id: 1,
      clientName: "Анна Петрова",
      clientPhone: "+998901234567",
      service: "Стрижка женская",
      staff: "Мария",
      date: "2025-01-27",
      time: "10:00",
      status: "confirmed",
    },
    {
      id: 2,
      clientName: "Иван Сидоров",
      clientPhone: "+998907654321",
      service: "Стрижка мужская",
      staff: "Анна",
      date: "2025-01-27",
      time: "11:00",
      status: "pending",
    },
  ];

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const locale = language === "ru" ? "ru-RU" : language === "kz" ? "kk-KZ" : language === "uz" ? "uz-UZ" : "en-US";
    return date.toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t("bookingsPage.title")}</h2>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          {t("bookingsPage.subtitle")}
        </p>
      </div>

      {/* Bookings list */}
      <div className="space-y-4">
        {bookings.length === 0 ? (
          <div className={`${isDark ? "bg-[#12122a] border-white/5 text-gray-400" : "bg-white border-gray-200 text-gray-500"} rounded-lg border p-8 text-center`}>
            <Calendar className={`h-12 w-12 mx-auto ${isDark ? "text-gray-600" : "text-gray-300"} mb-3`} />
            <p>{t("bookingsPage.noBookings")}</p>
            <p className="text-sm mt-1">
              {t("bookingsPage.noBookingsDesc")}
            </p>
          </div>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border p-4`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      {booking.clientName}
                    </span>
                    {getStatusBadge(booking.status)}
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    <Phone className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    {booking.clientPhone}
                  </div>
                  <div className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    <span className="font-medium">{booking.service}</span>
                    {" · "}
                    {booking.staff}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    <Calendar className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    {formatDate(booking.date)}
                  </div>
                  <div className={`flex items-center gap-1 mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    <Clock className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    {booking.time}
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
