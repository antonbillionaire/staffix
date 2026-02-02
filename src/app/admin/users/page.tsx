"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquare,
  Calendar,
  Bot,
  Clock,
  ExternalLink,
  MoreVertical,
  UserX,
  Crown,
  RefreshCw,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  emailVerified: boolean;
  business: {
    id: string;
    name: string;
    botActive: boolean;
    botUsername: string | null;
    bookingsCount: number;
    conversationsCount: number;
  } | null;
  subscription: {
    plan: string;
    messagesUsed: number;
    messagesLimit: number;
    expiresAt: string;
    isExpired: boolean;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        plan: planFilter,
        status: statusFilter,
      });

      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, planFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchUsers();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysLeft = (expiresAt: string) => {
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const getPlanBadge = (plan: string, isExpired: boolean) => {
    if (isExpired) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
          Истёк
        </span>
      );
    }

    const badges: Record<string, { bg: string; text: string; label: string }> = {
      trial: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Trial" },
      pro: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Pro" },
      business: { bg: "bg-green-500/10", text: "text-green-400", label: "Business" },
    };
    const badge = badges[plan] || { bg: "bg-gray-500/10", text: "text-gray-400", label: plan };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Клиенты</h1>
          <p className="text-gray-400">
            {pagination.totalCount} пользователей
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Search and filters */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по email, имени или бизнесу..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors ${
              showFilters
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            <Filter className="h-4 w-4" />
            Фильтры
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white font-medium rounded-xl hover:opacity-90"
          >
            Найти
          </button>
        </form>

        {/* Filter options */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5">
            <div>
              <label className="block text-xs text-gray-500 mb-1">План</label>
              <select
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Все планы</option>
                <option value="trial">Trial</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Статус</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Все</option>
                <option value="active">Активные</option>
                <option value="expired">Истёкшие</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Пользователи не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Пользователь</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Бизнес</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">План</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Использование</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Активность</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Регистрация</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-white font-medium">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {user.business ? (
                        <div>
                          <p className="text-gray-300">{user.business.name}</p>
                          {user.business.botActive && user.business.botUsername && (
                            <p className="text-xs text-green-400 flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              @{user.business.botUsername}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.subscription ? (
                        <div className="space-y-1">
                          {getPlanBadge(user.subscription.plan, user.subscription.isExpired)}
                          {!user.subscription.isExpired && (
                            <p className="text-xs text-gray-500">
                              {getDaysLeft(user.subscription.expiresAt)} дней
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.subscription ? (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden max-w-20">
                              <div
                                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, (user.subscription.messagesUsed / user.subscription.messagesLimit) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {user.subscription.messagesUsed}/{user.subscription.messagesLimit}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.business ? (
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {user.business.conversationsCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {user.business.bookingsCount}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{formatDate(user.createdAt)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                          title="Подробнее"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <a
                          href={`mailto:${user.email}`}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                          title="Написать"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                        <button
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                          title="Ещё"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-sm text-gray-400">
              Страница {pagination.page} из {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
