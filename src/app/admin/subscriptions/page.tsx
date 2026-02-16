"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CreditCard,
  DollarSign,
  Users,
  TrendingUp,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  messagesUsed: number;
  messagesLimit: number;
  expiresAt: string;
  billingPeriod: string | null;
  payproOrderId: string | null;
  businessName: string;
  ownerEmail: string;
  ownerName: string;
  businessId: string;
  isExpired: boolean;
  createdAt: string;
}

interface Stats {
  mrr: number;
  activeCount: number;
  totalCount: number;
  planDistribution: Record<string, number>;
}

export default function AdminSubscriptions() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalCount: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        plan: planFilter,
        status: statusFilter,
        ...(search && { search }),
      });
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions);
        setStats(data.stats);
        setPagination((p) => ({ ...p, totalCount: data.pagination.totalCount, totalPages: data.pagination.totalPages }));
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, planFilter, statusFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchData();
  };

  const getPlanBadge = (plan: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      trial: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Trial" },
      starter: { bg: "bg-teal-500/10", text: "text-teal-400", label: "Starter" },
      pro: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Pro" },
      business: { bg: "bg-green-500/10", text: "text-green-400", label: "Business" },
      enterprise: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Enterprise" },
    };
    const badge = badges[plan] || { bg: "bg-gray-500/10", text: "text-gray-400", label: plan };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getStatusBadge = (sub: Subscription) => {
    if (sub.isExpired) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">Истёк</span>;
    }
    const statuses: Record<string, { bg: string; text: string; label: string }> = {
      active: { bg: "bg-green-500/10", text: "text-green-400", label: "Активна" },
      cancelled: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Отменена" },
      suspended: { bg: "bg-red-500/10", text: "text-red-400", label: "Приостановлена" },
      expired: { bg: "bg-gray-500/10", text: "text-gray-400", label: "Истекла" },
    };
    const s = statuses[sub.status] || statuses.expired;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  };

  const getUsagePercent = (used: number, limit: number) => {
    if (limit >= 999999) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Подписки</h1>
          <p className="text-gray-400">{pagination.totalCount} подписок</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-white">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">MRR</p>
            <p className="text-2xl font-bold text-white">${stats.mrr}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Активных</p>
            <p className="text-2xl font-bold text-white">{stats.activeCount}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Всего подписок</p>
            <p className="text-2xl font-bold text-white">{stats.totalCount}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-1">Конверсия</p>
            <p className="text-2xl font-bold text-white">
              {stats.totalCount > 0 ? Math.round(((stats.totalCount - (stats.planDistribution.trial || 0)) / stats.totalCount) * 100) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по бизнесу или email..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white text-sm font-medium transition-colors">
            Найти
          </button>
        </form>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">План</label>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Все планы</option>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Статус</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="expired">Истёкшие</option>
              <option value="suspended">Приостановленные</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center text-gray-400 py-12">Подписки не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Бизнес</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">План</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Сообщения</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Период</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Истекает</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                  const usagePercent = getUsagePercent(sub.messagesUsed, sub.messagesLimit);
                  return (
                    <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium">{sub.businessName}</p>
                          <p className="text-xs text-gray-500">{sub.ownerEmail}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getPlanBadge(sub.plan)}</td>
                      <td className="py-3 px-4">{getStatusBadge(sub)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">
                            {sub.messagesLimit >= 999999 ? `${sub.messagesUsed} / ∞` : `${sub.messagesUsed} / ${sub.messagesLimit}`}
                          </span>
                          {usagePercent > 80 && <AlertTriangle className="h-3 w-3 text-red-400" />}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-400">
                          {sub.billingPeriod === "yearly" ? "Годовой" : sub.billingPeriod === "monthly" ? "Месячный" : "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">{formatDate(sub.expiresAt)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/5">
            <p className="text-sm text-gray-400">
              Стр. {pagination.page} из {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
