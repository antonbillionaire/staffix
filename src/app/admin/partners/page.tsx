"use client";

/**
 * Список всех партнёров. Фильтры по статусу, поиск по имени/email/коду.
 * Карточки сводной статистики наверху. Кнопка «+ Добавить партнёра» для уже договорённых.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Loader2,
  Handshake,
  TrendingUp,
  DollarSign,
  Clock,
  ExternalLink,
  X,
} from "lucide-react";

interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  website: string | null;
  referralCode: string | null;
  status: string;
  commissionRate: number;
  totalEarnings: number;
  totalPaid: number;
  pendingPayout: number;
  agreementSignedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  referralsCount: number;
  earningsCount: number;
}

interface ApiResponse {
  partners: Partner[];
  counts: Record<string, number>;
  totals: {
    totalEarnings: number;
    totalPaid: number;
    pendingPayout: number;
  };
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Одобрен", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "Отклонён", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  suspended: { label: "Заблокирован", color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function AdminPartnersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/partners?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Handshake className="h-6 w-6 text-blue-400" /> Партнёры
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Реферальная программа Staffix · 20% recurring commission
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/partners/payouts"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <DollarSign className="h-4 w-4" /> Выплаты
            </Link>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" /> Добавить партнёра
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Всего одобрено"
            value={data?.counts.approved ?? 0}
            icon={<TrendingUp className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            label="Ожидает"
            value={data?.counts.pending ?? 0}
            icon={<Clock className="h-5 w-5" />}
            color="yellow"
          />
          <StatCard
            label="Total earnings"
            value={fmt(data?.totals.totalEarnings ?? 0)}
            icon={<DollarSign className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            label="Pending payout"
            value={fmt(data?.totals.pendingPayout ?? 0)}
            icon={<DollarSign className="h-5 w-5" />}
            color="purple"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск по имени, email, коду…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#12122a] border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-[#12122a] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="approved">Одобрены</option>
            <option value="rejected">Отклонены</option>
            <option value="suspended">Заблокированы</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : !data || data.partners.length === 0 ? (
            <div className="text-center p-12 text-gray-400">
              {search || statusFilter !== "all"
                ? "Ничего не найдено"
                : "Партнёров пока нет. Подайте заявку через staffix.io/partners или добавьте вручную."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/5 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Имя / Компания</th>
                    <th className="px-4 py-3 text-left">Статус</th>
                    <th className="px-4 py-3 text-left">Реф. код</th>
                    <th className="px-4 py-3 text-right">Привлёк</th>
                    <th className="px-4 py-3 text-right">Заработано</th>
                    <th className="px-4 py-3 text-right">К выплате</th>
                    <th className="px-4 py-3 text-left">Подал заявку</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.partners.map((p) => {
                    const s = STATUS_LABEL[p.status] || STATUS_LABEL.pending;
                    return (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.email}</div>
                          {p.company && <div className="text-xs text-gray-500">{p.company}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${s.color}`}>
                            {s.label}
                          </span>
                          {p.status === "approved" && !p.agreementSignedAt && (
                            <div className="text-[11px] text-yellow-500 mt-1">⚠ договор не подписан</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.referralCode ? (
                            <code className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                              {p.referralCode}
                            </code>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-white">{p.referralsCount}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-white">{fmt(p.totalEarnings)}</div>
                          <div className="text-xs text-gray-500">{Math.round(p.commissionRate * 100)}%</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className={p.pendingPayout > 0 ? "text-purple-400" : "text-gray-500"}>
                            {fmt(p.pendingPayout)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(p.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/partners/${p.id}`}
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                          >
                            Открыть <ExternalLink className="h-3 w-3" />
                          </Link>
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

      {createModalOpen && (
        <CreatePartnerModal
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: "green" | "yellow" | "blue" | "purple";
}) {
  const colorMap = {
    green: "bg-green-500/10 text-green-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
  };
  return (
    <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        <div className={`p-1.5 rounded ${colorMap[color]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

/**
 * Модалка ручного добавления партнёра — для уже договорённых, чтобы не подавали
 * заявку через публичную форму. Создаётся сразу в статусе approved + welcome email.
 */
function CreatePartnerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    description: "",
    adminNotes: "",
    commissionRate: "0.20",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const rate = parseFloat(form.commissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
        setError("Комиссия должна быть от 0 до 1 (например 0.2 = 20%)");
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          commissionRate: rate,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Ошибка");
        setSubmitting(false);
        return;
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#12122a] border border-white/10 rounded-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Добавить партнёра</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Партнёр будет создан со статусом «Одобрен» и получит welcome email с реферальной ссылкой
          и доступом в кабинет.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Имя *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required type="email" />
          <Field label="Телефон" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Компания" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
          <Field label="Сайт" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Комиссия (0-1, по умолчанию 0.2 = 20%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.commissionRate}
              onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Внутренние заметки (партнёру невидимы)</label>
            <textarea
              value={form.adminNotes}
              onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
            />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm"
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium"
            >
              {submitting ? "Создаём…" : "Создать и отправить email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
      />
    </div>
  );
}
