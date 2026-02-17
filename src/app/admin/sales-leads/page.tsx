"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Eye,
  Phone,
  Star,
} from "lucide-react";

interface SalesLead {
  id: string;
  name: string | null;
  businessName: string | null;
  businessType: string | null;
  telegramUsername: string | null;
  telegramChatId: string | null;
  instagramId: string | null;
  whatsappPhone: string | null;
  phone: string | null;
  email: string | null;
  channel: string;
  stage: string;
  recommendedPlan: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  stageDistribution: Record<string, number>;
}

export default function AdminSalesLeads() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalCount: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        stage: stageFilter,
        channel: channelFilter,
        ...(search && { search }),
      });
      const res = await fetch(`/api/admin/sales-leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        setStats(data.stats);
        setPagination((p) => ({
          ...p,
          totalCount: data.pagination.totalCount,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error("Error fetching sales leads:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, stageFilter, channelFilter, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchData();
  };

  const getStageBadge = (stage: string) => {
    const stages: Record<string, { bg: string; text: string; label: string }> = {
      new: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Новый" },
      interested: { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Заинтересован" },
      demo_requested: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Запросил демо" },
      trial_started: { bg: "bg-green-500/10", text: "text-green-400", label: "Начал trial" },
      converted: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Конвертирован" },
      lost: { bg: "bg-gray-500/10", text: "text-gray-400", label: "Потерян" },
    };
    const s = stages[stage] || { bg: "bg-gray-500/10", text: "text-gray-400", label: stage };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  const getChannelBadge = (channel: string) => {
    const channels: Record<string, { bg: string; text: string; label: string }> = {
      telegram: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Telegram" },
      instagram: { bg: "bg-pink-500/10", text: "text-pink-400", label: "Instagram" },
      whatsapp: { bg: "bg-green-500/10", text: "text-green-400", label: "WhatsApp" },
    };
    const c = channels[channel] || { bg: "bg-gray-500/10", text: "text-gray-400", label: channel };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Лиды (Sales Bot)</h1>
          <p className="text-gray-400">{pagination.totalCount} лидов</p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-gray-400">Всего</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="h-4 w-4 text-blue-400" />
              <p className="text-xs text-gray-400">Новых</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.stageDistribution.new || 0}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              <p className="text-xs text-gray-400">Заинтересованы</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.stageDistribution.interested || 0}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-purple-400" />
              <p className="text-xs text-gray-400">Демо</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.stageDistribution.demo_requested || 0}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-green-400" />
              <p className="text-xs text-gray-400">Trial</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.stageDistribution.trial_started || 0}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-emerald-400" />
              <p className="text-xs text-gray-400">Конвертированы</p>
            </div>
            <p className="text-xl font-bold text-white">{stats.stageDistribution.converted || 0}</p>
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
              placeholder="Поиск по имени, бизнесу, username..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Найти
          </button>
        </form>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Этап</label>
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Все</option>
              <option value="new">Новые</option>
              <option value="interested">Заинтересованы</option>
              <option value="demo_requested">Запросили демо</option>
              <option value="trial_started">Начали trial</option>
              <option value="converted">Конвертированы</option>
              <option value="lost">Потеряны</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Канал</label>
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Все каналы</option>
              <option value="telegram">Telegram</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
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
        ) : leads.length === 0 ? (
          <div className="text-center text-gray-400 py-12">Лиды не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Имя</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Канал</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Этап</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Контакт</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Бизнес</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Дата</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <p className="text-white font-medium">{lead.name || "—"}</p>
                    </td>
                    <td className="py-3 px-4">{getChannelBadge(lead.channel)}</td>
                    <td className="py-3 px-4">{getStageBadge(lead.stage)}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {lead.telegramUsername && (
                          <p className="text-blue-400">@{lead.telegramUsername}</p>
                        )}
                        {lead.phone && <p className="text-gray-400">{lead.phone}</p>}
                        {lead.email && <p className="text-gray-400">{lead.email}</p>}
                        {!lead.telegramUsername && !lead.phone && !lead.email && (
                          <p className="text-gray-500">—</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        <p className="text-gray-300">{lead.businessName || "—"}</p>
                        {lead.businessType && (
                          <p className="text-xs text-gray-500">{lead.businessType}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-400">{formatDate(lead.createdAt)}</p>
                    </td>
                  </tr>
                ))}
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
