"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Target,
  Loader2,
  Snowflake,
  Flame,
  Zap,
  UserCheck,
  MessageSquare,
  Phone,
  Search,
  Filter,
} from "lucide-react";

interface Lead {
  id: string;
  clientName: string | null;
  clientId: string | null;
  channel: string;
  source: string;
  status: string;
  score: number;
  firstMessage: string | null;
  statusReason: string | null;
  lastInteractionAt: string | null;
  qualifiedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Funnel {
  cold: number;
  warm: number;
  hot: number;
  client: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Target }> = {
  cold: { label: "Холодный", color: "text-blue-500", bg: "bg-blue-500/10", icon: Snowflake },
  warm: { label: "Тёплый", color: "text-amber-500", bg: "bg-amber-500/10", icon: Flame },
  hot: { label: "Горячий", color: "text-red-500", bg: "bg-red-500/10", icon: Zap },
  client: { label: "Клиент", color: "text-green-500", bg: "bg-green-500/10", icon: UserCheck },
};

const CHANNEL_CONFIG: Record<string, { label: string; emoji: string }> = {
  whatsapp: { label: "WhatsApp", emoji: "💬" },
  instagram: { label: "Instagram", emoji: "📷" },
  messenger: { label: "Messenger", emoji: "💭" },
  telegram: { label: "Telegram", emoji: "✈️" },
};

export default function LeadsPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [funnel, setFunnel] = useState<Funnel>({ cold: 0, warm: 0, hot: 0, client: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Get businessId
  useEffect(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setBusinessId(data.id);
      })
      .catch(console.error);
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ businessId });
      if (statusFilter) params.set("status", statusFilter);
      if (channelFilter) params.set("channel", channelFilter);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setFunnel(data.funnel || { cold: 0, warm: 0, hot: 0, client: 0 });
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, statusFilter, channelFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = searchQuery
    ? leads.filter(
        (l) =>
          l.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.clientId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : leads;

  const bgCard = isDark ? "bg-gray-800" : "bg-white";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const border = isDark ? "border-gray-700" : "border-gray-200";
  const bgPage = isDark ? "bg-gray-900" : "bg-gray-50";

  if (loading && !leads.length) {
    return (
      <div className={`min-h-screen ${bgPage} flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgPage} p-4 md:p-6`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-2xl font-bold ${textPrimary} flex items-center gap-2`}>
          <Target className="h-6 w-6 text-indigo-500" />
          {t("nav.myLeads") || "Мои Лиды"}
        </h1>
        <p className={`text-sm ${textSecondary} mt-1`}>
          {t("leads.subtitle") || "Воронка квалификации клиентов из всех каналов"}
        </p>
      </div>

      {/* Funnel Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(["cold", "warm", "hot", "client"] as const).map((status) => {
          const config = STATUS_CONFIG[status];
          const count = funnel[status];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const Icon = config.icon;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
              className={`${bgCard} rounded-xl p-4 border ${border} transition-all hover:shadow-md ${
                statusFilter === status ? "ring-2 ring-indigo-500" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${config.bg}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <span className={`text-xs font-medium ${textSecondary}`}>{config.label}</span>
              </div>
              <div className={`text-2xl font-bold ${textPrimary}`}>{count}</div>
              <div className={`text-xs ${textSecondary}`}>{pct}%</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className={`${bgCard} rounded-xl border ${border} p-4 mb-4`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("leads.search") || "Поиск по имени..."}
              className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm border ${border} ${
                isDark ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-900"
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
          </div>

          {/* Channel filter */}
          <div className="flex items-center gap-1">
            <Filter className={`h-4 w-4 ${textSecondary}`} />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className={`text-sm rounded-lg border ${border} px-2 py-2 ${
                isDark ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-900"
              } focus:outline-none`}
            >
              <option value="">{t("leads.allChannels") || "Все каналы"}</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="messenger">Messenger</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className={`${bgCard} rounded-xl border ${border} overflow-hidden`}>
        {filteredLeads.length === 0 ? (
          <div className="p-12 text-center">
            <Target className={`h-12 w-12 mx-auto mb-3 ${textSecondary} opacity-50`} />
            <p className={`text-sm ${textSecondary}`}>
              {t("leads.empty") || "Лидов пока нет. Они появятся когда клиенты напишут вашему боту."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${border} ${isDark ? "bg-gray-700/50" : "bg-gray-50"}`}>
                  <th className={`text-left text-xs font-medium ${textSecondary} uppercase px-4 py-3`}>
                    {t("leads.name") || "Имя"}
                  </th>
                  <th className={`text-left text-xs font-medium ${textSecondary} uppercase px-4 py-3`}>
                    {t("leads.channel") || "Канал"}
                  </th>
                  <th className={`text-left text-xs font-medium ${textSecondary} uppercase px-4 py-3`}>
                    {t("leads.status") || "Статус"}
                  </th>
                  <th className={`text-left text-xs font-medium ${textSecondary} uppercase px-4 py-3 hidden md:table-cell`}>
                    {t("leads.lastActivity") || "Последняя активность"}
                  </th>
                  <th className={`text-left text-xs font-medium ${textSecondary} uppercase px-4 py-3 hidden lg:table-cell`}>
                    {t("leads.reason") || "Причина"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.cold;
                  const channelCfg = CHANNEL_CONFIG[lead.channel] || { label: lead.channel, emoji: "📩" };
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={lead.id} className={`border-b ${border} hover:${isDark ? "bg-gray-700/30" : "bg-gray-50"} transition-colors`}>
                      <td className="px-4 py-3">
                        <div className={`text-sm font-medium ${textPrimary}`}>
                          {lead.clientName || lead.clientId || "—"}
                        </div>
                        {lead.firstMessage && (
                          <div className={`text-xs ${textSecondary} truncate max-w-[200px]`}>
                            {lead.firstMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${textSecondary}`}>
                          {channelCfg.emoji} {channelCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 hidden md:table-cell text-sm ${textSecondary}`}>
                        {lead.lastInteractionAt
                          ? new Date(lead.lastInteractionAt).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className={`px-4 py-3 hidden lg:table-cell text-xs ${textSecondary} max-w-[200px] truncate`}>
                        {lead.statusReason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
