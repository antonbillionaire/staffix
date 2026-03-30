"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Users, DollarSign, Star, TrendingUp, Calendar, XCircle, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface StaffStat {
  id: string;
  name: string;
  role: string;
  photo: string | null;
  totalBookings: number;
  completed: number;
  cancelled: number;
  confirmed: number;
  pending: number;
  revenue: number;
  avgRating: number | null;
  reviewCount: number;
  utilization: number | null;
  bookedMinutes: number;
  availableMinutes: number;
}

interface Totals {
  totalBookings: number;
  totalRevenue: number;
  totalCompleted: number;
  totalCancelled: number;
  avgRating: number | null;
}

export default function StaffStatisticsPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffStat[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/statistics/staff?period=${period}`)
      .then((r) => r.json())
      .then((data) => {
        setStaff(data.staff || []);
        setTotals(data.totals || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  const periods = [
    { value: "week", label: "7 дней" },
    { value: "month", label: "30 дней" },
    { value: "all", label: "Всё время" },
  ];

  const card = isDark ? "bg-[#1a1a3e] border border-white/5" : "bg-white border border-gray-200 shadow-sm";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textSub = isDark ? "text-gray-400" : "text-gray-500";

  // Filter only masters/staff with bookings (or show all)
  const mastersOnly = staff.filter((s) => s.role === "master" || s.totalBookings > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/staff"
            className={`p-2 rounded-lg ${isDark ? "hover:bg-white/5" : "hover:bg-gray-100"}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className={`text-xl font-bold ${textMain}`}>
              Статистика мастеров
            </h1>
            <p className={`text-sm ${textSub}`}>
              Загруженность, доход, рейтинг и записи
            </p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-black/5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                period === p.value
                  ? "bg-blue-600 text-white"
                  : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard
            icon={<Calendar className="h-5 w-5 text-blue-400" />}
            label="Всего записей"
            value={totals.totalBookings}
            isDark={isDark}
            card={card}
          />
          <SummaryCard
            icon={<Users className="h-5 w-5 text-green-400" />}
            label="Выполнено"
            value={totals.totalCompleted}
            isDark={isDark}
            card={card}
          />
          <SummaryCard
            icon={<XCircle className="h-5 w-5 text-red-400" />}
            label="Отмены"
            value={totals.totalCancelled}
            isDark={isDark}
            card={card}
          />
          <SummaryCard
            icon={<DollarSign className="h-5 w-5 text-yellow-400" />}
            label="Общий доход"
            value={totals.totalRevenue.toLocaleString("ru-RU")}
            isDark={isDark}
            card={card}
          />
          <SummaryCard
            icon={<Star className="h-5 w-5 text-orange-400" />}
            label="Средний рейтинг"
            value={totals.avgRating ? `${totals.avgRating} ★` : "—"}
            isDark={isDark}
            card={card}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Staff Table */}
      {!loading && mastersOnly.length > 0 && (
        <div className={`${card} rounded-xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isDark ? "bg-white/5" : "bg-gray-50"}>
                  <th className={`text-left px-4 py-3 font-medium ${textSub}`}>Мастер</th>
                  <th className={`text-center px-3 py-3 font-medium ${textSub}`}>Записей</th>
                  <th className={`text-center px-3 py-3 font-medium ${textSub}`}>Выполнено</th>
                  <th className={`text-center px-3 py-3 font-medium ${textSub}`}>Отмены</th>
                  <th className={`text-right px-3 py-3 font-medium ${textSub}`}>Доход</th>
                  <th className={`text-center px-3 py-3 font-medium ${textSub}`}>Рейтинг</th>
                  <th className={`text-center px-3 py-3 font-medium ${textSub}`}>Загруз.</th>
                </tr>
              </thead>
              <tbody>
                {mastersOnly.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={`border-t ${isDark ? "border-white/5" : "border-gray-100"} ${
                      idx % 2 === 0 ? "" : isDark ? "bg-white/[0.02]" : "bg-gray-50/50"
                    }`}
                  >
                    {/* Name + Photo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                        }`}>
                          {s.photo ? (
                            <img src={s.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            s.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className={`font-medium ${textMain}`}>{s.name}</p>
                          <p className={`text-xs ${textSub}`}>{s.role}</p>
                        </div>
                      </div>
                    </td>

                    {/* Total Bookings */}
                    <td className={`text-center px-3 py-3 font-medium ${textMain}`}>
                      {s.totalBookings}
                    </td>

                    {/* Completed */}
                    <td className="text-center px-3 py-3">
                      <span className="text-green-500 font-medium">{s.completed}</span>
                    </td>

                    {/* Cancelled */}
                    <td className="text-center px-3 py-3">
                      <span className={s.cancelled > 0 ? "text-red-400 font-medium" : textSub}>
                        {s.cancelled}
                      </span>
                    </td>

                    {/* Revenue */}
                    <td className={`text-right px-3 py-3 font-medium ${textMain}`}>
                      {s.revenue > 0 ? s.revenue.toLocaleString("ru-RU") : "—"}
                    </td>

                    {/* Rating */}
                    <td className="text-center px-3 py-3">
                      {s.avgRating ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                          <span className={`font-medium ${textMain}`}>{s.avgRating}</span>
                          <span className={`text-xs ${textSub}`}>({s.reviewCount})</span>
                        </span>
                      ) : (
                        <span className={textSub}>—</span>
                      )}
                    </td>

                    {/* Utilization */}
                    <td className="text-center px-3 py-3">
                      {s.utilization !== null ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className={`w-16 h-2 rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
                            <div
                              className={`h-full rounded-full ${
                                s.utilization >= 80 ? "bg-red-500" :
                                s.utilization >= 50 ? "bg-yellow-500" : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(100, s.utilization)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${textMain}`}>{s.utilization}%</span>
                        </div>
                      ) : (
                        <span className={textSub}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && mastersOnly.length === 0 && (
        <div className={`${card} rounded-xl p-12 text-center`}>
          <Users className={`h-12 w-12 mx-auto mb-3 ${textSub}`} />
          <p className={`font-medium ${textMain}`}>Нет данных за выбранный период</p>
          <p className={`text-sm mt-1 ${textSub}`}>
            Добавьте мастеров и записи появятся в статистике
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  isDark,
  card,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  isDark: boolean;
  card: string;
}) {
  return (
    <div className={`${card} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</span>
      </div>
      <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
