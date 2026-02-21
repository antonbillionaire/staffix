"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Send,
  Instagram,
  RefreshCw,
  Loader2,
  CheckCircle,
  Copy,
  ExternalLink,
  Zap,
  MessageSquare,
  Clock,
} from "lucide-react";

interface OutreachLead {
  id: string;
  businessName: string;
  category: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  telegram: string | null;
  instagram: string | null;
  whatsapp: string | null;
  outreachChannel: string;
  status: string;
  sentAt: string | null;
  repliedAt: string | null;
  notes: string | null;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  leads: OutreachLead[];
}

interface Stats {
  total: number;
  sent: number;
  replied: number;
  registered: number;
  byChannel: Record<string, { total: number; sent: number }>;
}

const DM_TEMPLATE = `Добрый день!

Меня зовут Антон, я основатель Staffix.

Управление записями, консультациями и клиентской базой — это то, что требует постоянного внимания и занимает значительную часть ресурсов любого бизнеса в сфере услуг.

Staffix — это ИИ-сотрудник, который работает 24/7, быстро обучается на основе ваших данных и функционирует на современном ИИ-движке. Он автоматизирует консультации клиентов, запись на посещение и ведение CRM — без выходных, больничных и человеческого фактора.

Испытайте возможности Staffix бесплатно на staffix.io

Специальное предложение: 14 дней пробного периода бесплатно + ещё 30 дней в подарок за обратную связь о работе системы.

С уважением,
Антон, основатель Staffix

Или свяжитесь с нашим ИИ-помощником: t.me/Staffix_client_manager_bot`;

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Ожидает", bg: "bg-gray-500/10", text: "text-gray-400" },
  sent: { label: "Отправлено", bg: "bg-blue-500/10", text: "text-blue-400" },
  replied: { label: "Ответил", bg: "bg-cyan-500/10", text: "text-cyan-400" },
  registered: { label: "Зарегистрировался", bg: "bg-green-500/10", text: "text-green-400" },
  paying: { label: "Платит", bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"email" | "telegram" | "instagram">("email");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/outreach/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.campaign);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleSendEmails = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/outreach/${id}/send-emails`, {
        method: "POST",
      });
      const data = await res.json();
      setSendResult(data.message || `Отправлено: ${data.sent}`);
      fetchCampaign();
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (leadId: string, status: string) => {
    setUpdatingId(leadId);
    try {
      await fetch(`/api/admin/outreach/${id}/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      // Optimistic update
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              leads: prev.leads.map((l) =>
                l.id === leadId
                  ? { ...l, status, sentAt: status === "sent" ? new Date().toISOString() : l.sentAt }
                  : l
              ),
            }
          : prev
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const copyMessage = (leadId: string) => {
    navigator.clipboard.writeText(DM_TEMPLATE);
    setCopiedId(leadId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const leads = campaign?.leads || [];
  const emailLeads = leads.filter((l) => l.outreachChannel === "email");
  const telegramLeads = leads.filter((l) => l.outreachChannel === "telegram");
  const instagramLeads = leads.filter((l) => l.outreachChannel === "instagram");

  const tabs = [
    { key: "email" as const, label: "Email", count: emailLeads.length, icon: Mail, color: "text-blue-400" },
    { key: "telegram" as const, label: "Telegram", count: telegramLeads.length, icon: Send, color: "text-sky-400" },
    { key: "instagram" as const, label: "Instagram", count: instagramLeads.length, icon: Instagram, color: "text-pink-400" },
  ].filter((t) => t.count > 0);

  const activeLeads =
    activeTab === "email" ? emailLeads : activeTab === "telegram" ? telegramLeads : instagramLeads;

  const pendingCount = activeLeads.filter((l) => l.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center text-gray-400 py-12">
        Кампания не найдена
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/outreach"
          className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <p className="text-gray-400 text-sm">
            {new Date(campaign.createdAt).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={fetchCampaign}
          className="ml-auto p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Всего лидов</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Отправлено</p>
            <p className="text-2xl font-bold text-blue-400">
              {stats.sent}
              <span className="text-sm text-gray-500 font-normal ml-1">
                / {stats.total}
              </span>
            </p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Ответили</p>
            <p className="text-2xl font-bold text-cyan-400">{stats.replied}</p>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Регистрации</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.registered}</p>
          </div>
        </div>
      )}

      {/* Channel tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.key ? "text-orange-400" : tab.color}`} />
            {tab.label}
            <span className="bg-white/10 px-1.5 py-0.5 rounded text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Email action bar */}
      {activeTab === "email" && (
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-white font-medium">Автоматическая email-рассылка</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {pendingCount} писем ожидают отправки
            </p>
          </div>
          <div className="flex items-center gap-3">
            {sendResult && (
              <p className="text-sm text-green-400">{sendResult}</p>
            )}
            <button
              onClick={handleSendEmails}
              disabled={sending || pendingCount === 0}
              className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-xl text-white text-sm font-medium transition-colors"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {sending ? "Отправляем..." : `Отправить ${pendingCount} писем`}
            </button>
          </div>
        </div>
      )}

      {/* Manual channel info bar */}
      {(activeTab === "telegram" || activeTab === "instagram") && (
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-4 flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-orange-400 flex-shrink-0" />
          <div className="text-sm text-gray-400">
            Отправляйте вручную. Скопируйте сообщение кнопкой <strong className="text-white">Копировать</strong>, отправьте в{" "}
            {activeTab === "telegram" ? "Telegram" : "Instagram"}, затем нажмите{" "}
            <strong className="text-white">Отправлено</strong>.
          </div>
        </div>
      )}

      {/* Leads table */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl overflow-hidden">
        {activeLeads.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            Нет лидов в этом канале
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Бизнес</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Контакт</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Отправлено</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Действие</th>
                </tr>
              </thead>
              <tbody>
                {activeLeads.map((lead) => {
                  const s = STATUS_LABELS[lead.status] || STATUS_LABELS.pending;
                  return (
                    <tr key={lead.id} className="border-b border-white/5 hover:bg-white/3">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium text-sm">{lead.businessName}</p>
                          <div className="flex gap-2 mt-0.5 flex-wrap">
                            {lead.category && (
                              <span className="text-xs text-gray-500">{lead.category}</span>
                            )}
                            {lead.city && (
                              <span className="text-xs text-gray-600">· {lead.city}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm space-y-0.5">
                          {activeTab === "email" && lead.email && (
                            <p className="text-blue-400 text-xs">{lead.email}</p>
                          )}
                          {activeTab === "telegram" && lead.telegram && (
                            <a
                              href={
                                lead.telegram.startsWith("http")
                                  ? lead.telegram
                                  : `https://t.me/${lead.telegram.replace("@", "")}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sky-400 text-xs hover:text-sky-300"
                            >
                              {lead.telegram}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {activeTab === "instagram" && lead.instagram && (
                            <a
                              href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-pink-400 text-xs hover:text-pink-300"
                            >
                              {lead.instagram}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {lead.website && (
                            <a
                              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-gray-500 text-xs hover:text-gray-400"
                            >
                              сайт <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {lead.sentAt ? (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            {new Date(lead.sentAt).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 justify-end">
                          {(activeTab === "telegram" || activeTab === "instagram") && (
                            <button
                              onClick={() => copyMessage(lead.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                            >
                              {copiedId === lead.id ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {copiedId === lead.id ? "Скопировано" : "Копировать"}
                            </button>
                          )}

                          {lead.status === "pending" && (
                            <button
                              onClick={() => handleUpdateStatus(lead.id, "sent")}
                              disabled={updatingId === lead.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-xs text-blue-400 transition-colors disabled:opacity-50"
                            >
                              {updatingId === lead.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              Отправлено
                            </button>
                          )}

                          {lead.status === "sent" && (
                            <button
                              onClick={() => handleUpdateStatus(lead.id, "replied")}
                              disabled={updatingId === lead.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-xs text-cyan-400 transition-colors disabled:opacity-50"
                            >
                              {updatingId === lead.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5" />
                              )}
                              Ответил
                            </button>
                          )}

                          {lead.status === "replied" && (
                            <button
                              onClick={() => handleUpdateStatus(lead.id, "registered")}
                              disabled={updatingId === lead.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-xs text-green-400 transition-colors disabled:opacity-50"
                            >
                              {updatingId === lead.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              Зарегался
                            </button>
                          )}
                        </div>
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
