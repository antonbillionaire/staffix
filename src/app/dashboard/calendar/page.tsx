"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Clock, User, Scissors } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface CalendarBooking {
  id: string;
  clientName: string;
  clientPhone: string | null;
  date: string;
  status: string;
  serviceName: string | null;
  serviceDuration: number | null;
  staffId: string | null;
  staffName: string | null;
}

interface StaffMember {
  id: string;
  name: string;
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

function formatBusinessTime(utcDateStr: string, timezone: string): string {
  const local = utcToBusinessTime(utcDateStr, timezone);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

function formatBusinessDate(utcDateStr: string, timezone: string): string {
  const local = utcToBusinessTime(utcDateStr, timezone);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

const STAFF_COLORS = [
  { bg: "bg-blue-500", border: "border-blue-400", light: "bg-blue-500/20 text-blue-300" },
  { bg: "bg-purple-500", border: "border-purple-400", light: "bg-purple-500/20 text-purple-300" },
  { bg: "bg-green-500", border: "border-green-400", light: "bg-green-500/20 text-green-300" },
  { bg: "bg-orange-500", border: "border-orange-400", light: "bg-orange-500/20 text-orange-300" },
  { bg: "bg-pink-500", border: "border-pink-400", light: "bg-pink-500/20 text-pink-300" },
  { bg: "bg-cyan-500", border: "border-cyan-400", light: "bg-cyan-500/20 text-cyan-300" },
  { bg: "bg-yellow-500", border: "border-yellow-400", light: "bg-yellow-500/20 text-yellow-300" },
  { bg: "bg-red-500", border: "border-red-400", light: "bg-red-500/20 text-red-300" },
];

const STAFF_COLORS_LIGHT = [
  { bg: "bg-blue-500", border: "border-blue-300", light: "bg-blue-100 text-blue-700" },
  { bg: "bg-purple-500", border: "border-purple-300", light: "bg-purple-100 text-purple-700" },
  { bg: "bg-green-500", border: "border-green-300", light: "bg-green-100 text-green-700" },
  { bg: "bg-orange-500", border: "border-orange-300", light: "bg-orange-100 text-orange-700" },
  { bg: "bg-pink-500", border: "border-pink-300", light: "bg-pink-100 text-pink-700" },
  { bg: "bg-cyan-500", border: "border-cyan-300", light: "bg-cyan-100 text-cyan-700" },
  { bg: "bg-yellow-500", border: "border-yellow-300", light: "bg-yellow-100 text-yellow-700" },
  { bg: "bg-red-500", border: "border-red-300", light: "bg-red-100 text-red-700" },
];

const NO_STAFF_COLOR = { bg: "bg-gray-500", border: "border-gray-400", light: "bg-gray-500/20 text-gray-300" };
const NO_STAFF_COLOR_LIGHT = { bg: "bg-gray-500", border: "border-gray-300", light: "bg-gray-100 text-gray-600" };

const DAY_NAMES_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(dd);
  }
  return dates;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [businessTimezone, setBusinessTimezone] = useState("Asia/Tashkent");

  const dayNames = language === "en" ? DAY_NAMES_EN : DAY_NAMES_RU;
  const monthNames = language === "en" ? MONTH_NAMES_EN : MONTH_NAMES_RU;
  const weekDates = getWeekDates(currentDate);

  const getStaffColor = (staffId: string | null) => {
    if (!staffId) return isDark ? NO_STAFF_COLOR : NO_STAFF_COLOR_LIGHT;
    const idx = staffList.findIndex((s) => s.id === staffId);
    if (idx < 0) return isDark ? NO_STAFF_COLOR : NO_STAFF_COLOR_LIGHT;
    const colors = isDark ? STAFF_COLORS : STAFF_COLORS_LIGHT;
    return colors[idx % colors.length];
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let startDate: string, endDate: string;

      if (view === "week") {
        startDate = formatDateKey(weekDates[0]);
        endDate = formatDateKey(weekDates[6]);
      } else {
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        startDate = formatDateKey(firstDay);
        endDate = formatDateKey(lastDay);
      }

      let url = `/api/bookings?startDate=${startDate}&endDate=${endDate}`;
      if (staffFilter) url += `&staffId=${staffFilter}`;

      const [bookingsRes, staffRes] = await Promise.all([
        fetch(url),
        fetch("/api/staff"),
      ]);

      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        setBookings(data.bookings || []);
        if (data.timezone) setBusinessTimezone(data.timezone);
      }
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(data.staff || []);
      }
    } catch (error) {
      console.error("Error fetching calendar data:", error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, view, staffFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateWeek = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "week") {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setMonth(d.getMonth() + dir);
    }
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  // Time slots for weekly view (9:00 - 20:00)
  const timeSlots = Array.from({ length: 23 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const min = i % 2 === 0 ? "00" : "30";
    return `${String(hour).padStart(2, "0")}:${min}`;
  });

  // Group bookings by date (in business timezone) for week view
  const bookingsByDate: Record<string, CalendarBooking[]> = {};
  bookings.forEach((b) => {
    if (b.status === "cancelled") return;
    const dateKey = formatBusinessDate(b.date, businessTimezone);
    if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = [];
    bookingsByDate[dateKey].push(b);
  });

  // Timezone label for display
  const tzOffset = TIMEZONE_OFFSETS[businessTimezone] ?? 300;
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzH = Math.floor(Math.abs(tzOffset) / 60);
  const tzLabel = `UTC${tzSign}${tzH}`;

  // Month view: get calendar grid
  const getMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const headerText = view === "week"
    ? `${weekDates[0].getDate()} - ${weekDates[6].getDate()} ${monthNames[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`
    : `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
            {t("calendar.title")}
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {businessTimezone.split("/")[1]?.replace(/_/g, " ")} ({tzLabel})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Staff filter */}
          {staffList.length > 0 && (
            <select
              value={staffFilter || ""}
              onChange={(e) => setStaffFilter(e.target.value || null)}
              className={`text-sm px-2 py-1.5 rounded-lg border ${isDark ? "bg-white/5 border-white/10 text-white" : "border-gray-300"}`}
            >
              <option value="">{t("calendar.allStaff")}</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* View toggle */}
          <div className="flex gap-0.5">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  view === v ? "bg-blue-500 text-white" : isDark ? "text-gray-400 hover:bg-white/5" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t(`calendar.${v}`)}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigateWeek(-1)} className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/5 text-gray-400" : "hover:bg-gray-100 text-gray-600"}`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={goToToday} className={`px-3 py-1.5 text-sm rounded-lg ${isDark ? "text-gray-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-100"}`}>
              {t("calendar.today")}
            </button>
            <button onClick={() => navigateWeek(1)} className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/5 text-gray-400" : "hover:bg-gray-100 text-gray-600"}`}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Period display */}
      <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{headerText}</p>

      {/* Staff legend */}
      {staffList.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {staffList.map((s, i) => {
            const colors = isDark ? STAFF_COLORS : STAFF_COLORS_LIGHT;
            const color = colors[i % colors.length];
            return (
              <span key={s.id} className="flex items-center gap-1.5 text-xs">
                <span className={`w-3 h-3 rounded-full ${color.bg}`} />
                <span className={isDark ? "text-gray-300" : "text-gray-600"}>{s.name}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Week View */}
      {view === "week" && (
        <div className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border overflow-hidden`}>
         <div className="overflow-x-auto">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-white/5 min-w-[700px]">
            <div className={`p-2 text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`} />
            {weekDates.map((date, i) => {
              const isToday = formatDateKey(date) === formatDateKey(new Date());
              return (
                <div key={i} className={`p-2 text-center border-l ${isDark ? "border-white/5" : "border-gray-200"}`}>
                  <div className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{dayNames[i]}</div>
                  <div className={`text-sm font-medium mt-0.5 ${isToday ? "bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto" : isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="max-h-[600px] overflow-y-auto">
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-8 min-h-[40px] min-w-[700px]">
                <div className={`p-1 text-[11px] text-right pr-2 ${isDark ? "text-gray-600" : "text-gray-400"} border-r ${isDark ? "border-white/5" : "border-gray-200"}`}>
                  {time}
                </div>
                {weekDates.map((date, dayIdx) => {
                  const dateKey = formatDateKey(date);
                  const dayBookings = (bookingsByDate[dateKey] || []).filter((b) => {
                    const bTimeStr = formatBusinessTime(b.date, businessTimezone);
                    const [bH, bM] = bTimeStr.split(":").map(Number);
                    const slotMin = bM < 30 ? "00" : "30";
                    const slotTime = `${String(bH).padStart(2, "0")}:${slotMin}`;
                    return slotTime === time;
                  });

                  return (
                    <div
                      key={dayIdx}
                      className={`border-l border-b ${isDark ? "border-white/5" : "border-gray-100"} relative min-h-[40px]`}
                    >
                      {dayBookings.map((b) => {
                        const dur = b.serviceDuration || 60;
                        const heightSlots = Math.max(1, Math.ceil(dur / 30));
                        const color = getStaffColor(b.staffId);
                        return (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBooking(b)}
                            className={`absolute inset-x-0.5 top-0.5 ${color.bg} text-white text-[10px] rounded px-1 py-0.5 leading-tight overflow-hidden z-10 hover:opacity-80 transition-opacity`}
                            style={{ height: `${heightSlots * 40 - 4}px` }}
                          >
                            <div className="font-medium truncate">{b.clientName}</div>
                            {heightSlots > 1 && <div className="truncate opacity-80">{b.serviceName}</div>}
                            {heightSlots > 1 && b.staffName && <div className="truncate opacity-70">{b.staffName}</div>}
                            {heightSlots <= 1 && b.staffName && (
                              <div className="truncate opacity-70">{b.staffName}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
         </div>
        </div>
      )}

      {/* Month View */}
      {view === "month" && (
        <div className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border overflow-hidden`}>
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {dayNames.map((day) => (
              <div key={day} className={`p-2 text-center text-xs font-medium ${isDark ? "text-gray-500" : "text-gray-400"} border-b ${isDark ? "border-white/5" : "border-gray-200"}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {getMonthGrid().map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className={`min-h-[80px] border-b border-r ${isDark ? "border-white/5" : "border-gray-200"}`} />;
              }
              const dateKey = formatDateKey(date);
              const dayBookings = (bookingsByDate[dateKey] || []);
              const isToday = dateKey === formatDateKey(new Date());

              return (
                <div
                  key={dateKey}
                  onClick={() => {
                    setCurrentDate(date);
                    setView("week");
                  }}
                  className={`min-h-[80px] p-1.5 border-b border-r cursor-pointer ${isDark ? "border-white/5 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"} transition-colors`}
                >
                  <div className={`text-sm mb-1 ${isToday ? "bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center" : isDark ? "text-gray-400" : "text-gray-600"}`}>
                    {date.getDate()}
                  </div>
                  {dayBookings.slice(0, 3).map((b) => {
                    const color = getStaffColor(b.staffId);
                    const timeStr = formatBusinessTime(b.date, businessTimezone);
                    return (
                      <div key={b.id} className={`${color.bg} text-white text-[9px] rounded px-1 py-0.5 mb-0.5 truncate`}>
                        {timeStr} {b.clientName}
                      </div>
                    );
                  })}
                  {dayBookings.length > 3 && (
                    <div className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      +{dayBookings.length - 3}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Booking Detail Popup */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedBooking(null)}>
          <div
            className={`${isDark ? "bg-[#12122a]" : "bg-white"} rounded-lg p-6 w-full max-w-sm mx-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"} mb-4`}>
              {t("calendar.bookingDetails")}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                <span className={isDark ? "text-white" : "text-gray-900"}>{selectedBooking.clientName}</span>
              </div>
              {selectedBooking.clientPhone && (
                <div className={`flex items-center gap-2 text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  <span>📞</span>
                  <span>{selectedBooking.clientPhone}</span>
                </div>
              )}
              {selectedBooking.serviceName && (
                <div className="flex items-center gap-2">
                  <Scissors className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                  <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {selectedBooking.serviceName}
                    {selectedBooking.serviceDuration && ` (${selectedBooking.serviceDuration} мин)`}
                  </span>
                </div>
              )}
              {selectedBooking.staffName && (
                <div className="flex items-center gap-2">
                  <User className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                  <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {selectedBooking.staffName}
                  </span>
                  {selectedBooking.staffId && (
                    <span className={`w-2.5 h-2.5 rounded-full ${getStaffColor(selectedBooking.staffId).bg}`} />
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {formatBusinessDate(selectedBooking.date, businessTimezone).split("-").reverse().join(".")} {formatBusinessTime(selectedBooking.date, businessTimezone)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedBooking(null)}
              className={`mt-4 w-full px-4 py-2 border rounded-lg font-medium ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              {t("staffPage.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
