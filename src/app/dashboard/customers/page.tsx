"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Search,
  Loader2,
  Users,
  Crown,
  UserCheck,
  UserX,
  MessageSquare,
  Calendar,
  Star,
  ChevronLeft,
  ChevronRight,
  Phone,
  Clock,
  ExternalLink,
  Ban,
  RefreshCw,
} from "lucide-react";

interface Customer {
  id: string;
  telegramId: string;
  name: string;
  phone: string | null;
  totalVisits: number;
  lastVisitDate: string | null;
  isBlocked: boolean;
  createdAt: string;
  isActive: boolean;
  isVip: boolean;
  messagesCount: number;
  bookingsCount: number;
  avgRating: number | null;
  segment: "vip" | "active" | "inactive";
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  vip: number;
  blocked: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function CustomersPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, vip: 0, blocked: 0 });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");

  // Theme-aware styles
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-500" : "text-gray-500";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  const tableBg = isDark ? "bg-white/5" : "bg-gray-50";

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        segment,
      });

      const res = await fetch(`/api/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, segment]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchCustomers();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getSegmentBadge = (customer: Customer) => {
    if (customer.isBlocked) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
          Заблокирован
        </span>
      );
    }
    if (customer.isVip) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 flex items-center gap-1">
          <Crown className="h-3 w-3" />
          VIP
        </span>
      );
    }
    if (customer.isActive) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
          Активный
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
        Неактивный
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>База клиентов</h1>
          <p className={textSecondary}>
            {stats.total} клиентов в базе
          </p>
        </div>
        <button
          onClick={fetchCustomers}
          className={`flex items-center gap-2 px-4 py-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-xl ${textSecondary} transition-colors`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => { setSegment("all"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "all" ? "border-blue-500/50" : `${borderColor} hover:border-blue-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className={`text-xs ${textSecondary}`}>Все</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.total}</p>
        </button>
        <button
          onClick={() => { setSegment("active"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "active" ? "border-green-500/50" : `${borderColor} hover:border-green-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-green-500" />
            <span className={`text-xs ${textSecondary}`}>Активные</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.active}</p>
        </button>
        <button
          onClick={() => { setSegment("inactive"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "inactive" ? "border-gray-500/50" : `${borderColor} hover:border-gray-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <UserX className={`h-4 w-4 ${textSecondary}`} />
            <span className={`text-xs ${textSecondary}`}>Неактивные</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.inactive}</p>
        </button>
        <button
          onClick={() => { setSegment("vip"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "vip" ? "border-yellow-500/50" : `${borderColor} hover:border-yellow-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            <span className={`text-xs ${textSecondary}`}>VIP</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.vip}</p>
        </button>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Ban className="h-4 w-4 text-red-500" />
            <span className={`text-xs ${textSecondary}`}>Заблокировано</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.blocked}</p>
        </div>
      </div>

      {/* Search */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${textTertiary}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или телефону..."
              className={`w-full pl-10 pr-4 py-2.5 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90"
          >
            Найти
          </button>
        </form>
      </div>

      {/* Customers list */}
      <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : customers.length === 0 ? (
          <div className={`text-center py-12 ${textSecondary}`}>
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Клиенты не найдены</p>
            <p className="text-sm mt-1">Клиенты появятся после общения с ботом</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor} ${tableBg}`}>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>Клиент</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>Статус</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>Визиты</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>Активность</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>Рейтинг</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>Последний визит</th>
                  <th className={`text-right py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className={`border-b ${borderColor} ${hoverBg}`}>
                    <td className="py-3 px-4">
                      <div>
                        <p className={`${textPrimary} font-medium`}>{customer.name}</p>
                        {customer.phone && (
                          <p className={`text-sm ${textTertiary} flex items-center gap-1`}>
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getSegmentBadge(customer)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`flex items-center gap-1 ${textSecondary}`}>
                          <Calendar className="h-3 w-3" />
                          {customer.bookingsCount}
                        </span>
                        <span className={`flex items-center gap-1 ${textSecondary}`}>
                          <MessageSquare className="h-3 w-3" />
                          {customer.messagesCount}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={textSecondary}>{customer.totalVisits} визитов</span>
                    </td>
                    <td className="py-3 px-4">
                      {customer.avgRating ? (
                        <span className="flex items-center gap-1 text-yellow-500">
                          <Star className="h-4 w-4 fill-yellow-500" />
                          {customer.avgRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className={textTertiary}>—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className={`flex items-center gap-2 ${textSecondary}`}>
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{formatDate(customer.lastVisitDate)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors ${textSecondary} hover:text-blue-500 inline-flex`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${borderColor}`}>
            <p className={`text-sm ${textSecondary}`}>
              Страница {pagination.page} из {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors ${textSecondary} hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors ${textSecondary} hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
