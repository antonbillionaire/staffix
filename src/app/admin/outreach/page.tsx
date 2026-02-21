"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  RefreshCw,
  Loader2,
  Mail,
  Send,
  MessageSquare,
  Instagram,
  ChevronRight,
  Upload,
  X,
  CheckCircle,
  Trash2,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  stats: {
    total: number;
    sent: number;
    replied: number;
    registered: number;
    byChannel: Record<string, number>;
  };
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

export default function AdminOutreachPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/outreach");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // Proper CSV parser that handles quoted fields with commas inside
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return;

      // Strip UTF-8 BOM if present (Excel saves CSV with BOM)
      const firstLine = lines[0].replace(/^\uFEFF/, "");
      const headers = parseCSVLine(firstLine).map((h) => h.toLowerCase().trim());
      const rows = lines.slice(1).map((line) => {
        const vals = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] || ""; });
        return row;
      });
      setCsvData(rows);
    };
    reader.readAsText(file);
  };

  const handleCreateCampaign = async () => {
    if (!campaignName || csvData.length === 0) return;
    setCreating(true);

    try {
      // Map CSV columns to our schema fields
      const leads = csvData.map((row) => ({
        businessName: row.name || row.business_name || row.businessName || "",
        category: row.category || "",
        city: row.city || "",
        website: row.website || "",
        email: row.email || "",
        telegram: row.telegram || "",
        instagram: row.instagram || "",
        whatsapp: row.whatsapp || "",
      })).filter((l) => l.businessName);

      const res = await fetch("/api/admin/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: campaignName, leads }),
      });

      if (res.ok) {
        setShowCreate(false);
        setCampaignName("");
        setCsvData([]);
        setCsvFileName("");
        fetchCampaigns();
      }
    } finally {
      setCreating(false);
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(DM_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Удалить кампанию со всеми лидами? Это действие нельзя отменить.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/outreach/${id}`, { method: "DELETE" });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "active") return "text-green-400 bg-green-500/10";
    if (status === "completed") return "text-gray-400 bg-gray-500/10";
    return "text-yellow-400 bg-yellow-500/10";
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Кампании рассылки</h1>
          <p className="text-gray-400">Исходящий outreach для новых лидов</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTemplate(!showTemplate)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 text-sm transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Шаблон DM
          </button>
          <button
            onClick={fetchCampaigns}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 text-sm transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Новая кампания
          </button>
        </div>
      </div>

      {/* DM Template panel */}
      {showTemplate && (
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">Шаблон для Telegram / Instagram</h3>
            <div className="flex gap-2">
              <button
                onClick={copyTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-white text-xs font-medium transition-colors"
              >
                {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                {copied ? "Скопировано!" : "Копировать"}
              </button>
              <button onClick={() => setShowTemplate(false)} className="text-gray-500 hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-sans bg-white/3 rounded-lg p-4 border border-white/5">
            {DM_TEMPLATE}
          </pre>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="bg-[#12122a] border border-orange-500/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Новая кампания</h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-300">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Название кампании</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Февраль 2026 — Ташкент/Алматы"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Загрузить CSV файл</label>
            <div
              className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-gray-500 mx-auto mb-2" />
              {csvFileName ? (
                <div>
                  <p className="text-sm text-green-400 font-medium">{csvFileName}</p>
                  <p className="text-xs text-gray-400 mt-1">{csvData.length} бизнесов загружено</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-400">Нажмите для выбора CSV файла</p>
                  <p className="text-xs text-gray-500 mt-1">staffix_leads_enriched.csv</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {csvData.length > 0 && (
            <div className="bg-white/3 rounded-lg p-3 text-xs text-gray-400 space-y-1">
              <p>Email: {csvData.filter((r) => r.email).length} бизнесов</p>
              <p>Telegram: {csvData.filter((r) => !r.email && r.telegram).length} бизнесов</p>
              <p>Instagram: {csvData.filter((r) => !r.email && !r.telegram && r.instagram).length} бизнесов</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 text-sm transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleCreateCampaign}
              disabled={creating || !campaignName || csvData.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? "Создаём..." : `Создать (${csvData.length} лидов)`}
            </button>
          </div>
        </div>
      )}

      {/* Campaigns list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-12 text-center">
          <Megaphone className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Нет кампаний</p>
          <p className="text-sm text-gray-500 mt-1">Создайте первую кампанию и загрузите CSV с лидами</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/admin/outreach/${c.id}`}
              className="block bg-[#12122a] border border-white/5 hover:border-orange-500/30 rounded-xl p-5 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white truncate">{c.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                      {c.status === "active" ? "Активна" : c.status === "completed" ? "Завершена" : "Пауза"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{formatDate(c.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => handleDeleteCampaign(c.id, e)}
                    disabled={deletingId === c.id}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
                    title="Удалить кампанию"
                  >
                    {deletingId === c.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />
                    }
                  </button>
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/3 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Всего</p>
                  <p className="text-xl font-bold text-white">{c.stats.total}</p>
                </div>
                <div className="bg-white/3 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Отправлено</p>
                  <p className="text-xl font-bold text-green-400">
                    {c.stats.sent}
                    <span className="text-sm text-gray-500 font-normal ml-1">
                      ({c.stats.total > 0 ? Math.round((c.stats.sent / c.stats.total) * 100) : 0}%)
                    </span>
                  </p>
                </div>
                <div className="bg-white/3 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Ответили</p>
                  <p className="text-xl font-bold text-cyan-400">{c.stats.replied}</p>
                </div>
                <div className="bg-white/3 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Зарегистрировались</p>
                  <p className="text-xl font-bold text-emerald-400">{c.stats.registered}</p>
                </div>
              </div>

              {/* Channel breakdown */}
              <div className="mt-3 flex gap-3 flex-wrap">
                {c.stats.byChannel.email != null && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    Email: {c.stats.byChannel.email}
                  </div>
                )}
                {c.stats.byChannel.telegram != null && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Send className="h-3.5 w-3.5 text-sky-400" />
                    Telegram: {c.stats.byChannel.telegram}
                  </div>
                )}
                {c.stats.byChannel.instagram != null && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Instagram className="h-3.5 w-3.5 text-pink-400" />
                    Instagram: {c.stats.byChannel.instagram}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
