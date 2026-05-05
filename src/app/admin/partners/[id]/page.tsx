"use client";

/**
 * Карточка одного партнёра. Профиль, действия (approve/suspend/etc),
 * условия (commissionRate, minPayout), реквизиты, рефералы и заработок.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft,
  Loader2,
  Check,
  X as XIcon,
  Pause,
  Play,
  Mail,
  FileSignature,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface Referral {
  id: string;
  userEmail: string;
  signedUpAt: string;
  converted: boolean;
  convertedAt: string | null;
  convertedPlan: string | null;
}

interface Earning {
  id: string;
  commissionAmount: number;
  paymentAmount: number;
  subscriptionPlan: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  website: string | null;
  description: string | null;
  referralCode: string | null;
  // accessToken НЕ возвращается из API (не должен светиться в admin UI)
  status: string;
  approvedAt: string | null;
  commissionRate: number;
  minPayoutAmount: number;
  totalEarnings: number;
  totalPaid: number;
  pendingPayout: number;
  cardLast4: string | null;
  cardHolder: string | null;
  bankName: string | null;
  payoutNotes: string | null;
  adminNotes: string | null;
  agreementSignedAt: string | null;
  createdAt: string;
  referrals: Referral[];
  earnings: Earning[];
}

export default function AdminPartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${id}`);
      if (!res.ok) throw new Error("fetch failed");
      const d = await res.json();
      setPartner(d.partner);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const action = async (actionName: string, payload: Record<string, unknown> = {}) => {
    setActionLoading(actionName);
    try {
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, ...payload }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Ошибка");
      } else {
        await load();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setActionLoading(null);
    }
  };

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }
  if (!partner) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
        <Link href="/admin/partners" className="text-blue-400 text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> К списку
        </Link>
        <p className="mt-4 text-gray-400">Партнёр не найден</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> К списку партнёров
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{partner.name}</h1>
            <p className="text-sm text-gray-400">{partner.email}</p>
            {partner.company && <p className="text-sm text-gray-400">{partner.company}</p>}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <StatusBadge status={partner.status} />
              {partner.referralCode && (
                <code className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                  {partner.referralCode}
                </code>
              )}
            </div>
          </div>
        </div>

        {!partner.agreementSignedAt && partner.status === "approved" && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="text-yellow-300 font-medium mb-1">Партнёрское соглашение не подписано</div>
              <p className="text-gray-300 mb-3">
                Подпишите соглашение с партнёром на бумаге или по email, и отметьте здесь дату.
                Без этого нельзя выплачивать комиссии (compliance).
              </p>
              <button
                onClick={() => action("mark_agreement_signed")}
                disabled={actionLoading === "mark_agreement_signed"}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg flex items-center gap-1.5"
              >
                <FileSignature className="h-3.5 w-3.5" /> Отметить как подписанное
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Действия</h2>
          <div className="flex flex-wrap gap-2">
            {partner.status === "pending" && (
              <>
                <button
                  onClick={() => action("approve")}
                  disabled={actionLoading === "approve"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
                >
                  <Check className="h-4 w-4" /> Одобрить + email
                </button>
                <button
                  onClick={() => {
                    const reason = prompt("Причина отказа (необязательно):");
                    action("reject", { reason });
                  }}
                  disabled={actionLoading === "reject"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg"
                >
                  <XIcon className="h-4 w-4" /> Отклонить
                </button>
              </>
            )}
            {partner.status === "approved" && (
              <>
                <button
                  onClick={() => {
                    const reason = prompt("Причина блокировки:");
                    if (reason) action("suspend", { reason });
                  }}
                  disabled={actionLoading === "suspend"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
                >
                  <Pause className="h-4 w-4" /> Заблокировать
                </button>
                <button
                  onClick={() => action("resend_welcome_email")}
                  disabled={actionLoading === "resend_welcome_email"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg border border-white/10"
                >
                  <Mail className="h-4 w-4" /> Переотправить welcome
                </button>
                <button
                  onClick={() => {
                    if (
                      !confirm(
                        "Пересоздать accessToken? Старая ссылка перестанет работать. Партнёру уйдёт email с новой ссылкой."
                      )
                    )
                      return;
                    action("rotate_token");
                  }}
                  disabled={actionLoading === "rotate_token"}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600/80 hover:bg-orange-600 text-white text-sm rounded-lg"
                  title="Использовать если партнёр потерял ссылку или есть подозрение на утечку"
                >
                  <RefreshCw className="h-4 w-4" /> Пересоздать токен
                </button>
              </>
            )}
            {partner.status === "suspended" && (
              <button
                onClick={() => action("resume")}
                disabled={actionLoading === "resume"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg"
              >
                <Play className="h-4 w-4" /> Разблокировать
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Привлёк" value={partner.referrals.length} />
          <Stat label="Платящих" value={partner.referrals.filter((r) => r.converted).length} />
          <Stat label="Всего заработано" value={fmt(partner.totalEarnings)} />
          <Stat label="К выплате" value={fmt(partner.pendingPayout)} highlight={partner.pendingPayout > 0} />
        </div>

        {/* Profile + conditions */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Профиль</h2>
            <Row label="Email" value={partner.email} />
            <Row label="Телефон" value={partner.phone || "—"} />
            <Row label="Сайт" value={partner.website || "—"} />
            <Row label="Подал заявку" value={fmtDate(partner.createdAt)} />
            <Row label="Одобрен" value={fmtDate(partner.approvedAt)} />
            <Row label="Соглашение" value={fmtDate(partner.agreementSignedAt)} />
            {partner.description && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-xs text-gray-500 mb-1">Как планирует продвигать:</div>
                <p className="text-sm text-white whitespace-pre-wrap">{partner.description}</p>
              </div>
            )}
          </div>

          <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Условия</h2>
            <RateEditor
              partnerId={partner.id}
              initial={partner.commissionRate}
              onSaved={load}
            />
            <MinPayoutEditor
              partnerId={partner.id}
              initial={partner.minPayoutAmount}
              onSaved={load}
            />
          </div>
        </div>

        {/* Payout details */}
        <PayoutEditor partner={partner} onSaved={load} />

        {/* Admin notes */}
        <AdminNotesEditor partnerId={partner.id} initial={partner.adminNotes || ""} onSaved={load} />

        {/* Referrals + earnings */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <ListBox title={`Рефералы (${partner.referrals.length})`}>
            {partner.referrals.length === 0 ? (
              <Empty text="Пока никого не привёл" />
            ) : (
              partner.referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                  <div>
                    <div className="text-white">{r.userEmail}</div>
                    <div className="text-xs text-gray-500">{fmtDate(r.signedUpAt)}</div>
                  </div>
                  {r.converted ? (
                    <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
                      {r.convertedPlan || "платит"}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">trial</span>
                  )}
                </div>
              ))
            )}
          </ListBox>

          <ListBox title={`Начисления (${partner.earnings.length})`}>
            {partner.earnings.length === 0 ? (
              <Empty text="Пока ничего не заработал" />
            ) : (
              partner.earnings.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                  <div>
                    <div className="text-white">{fmt(e.commissionAmount)}</div>
                    <div className="text-xs text-gray-500">
                      {e.subscriptionPlan} · {fmtDate(e.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      e.status === "paid"
                        ? "bg-green-500/10 text-green-400"
                        : e.status === "approved"
                          ? "bg-purple-500/10 text-purple-400"
                          : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              ))
            )}
          </ListBox>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: "Ожидает", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Одобрен", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    rejected: { label: "Отклонён", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    suspended: { label: "Заблокирован", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const s = map[status] || map.pending;
  return <span className={`px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`bg-[#12122a] border rounded-xl p-3 ${highlight ? "border-purple-500/40" : "border-white/5"}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-purple-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-white truncate ml-2 max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function ListBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">{title}</h2>
      <div className="max-h-80 overflow-y-auto">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-gray-500 py-4 text-center">{text}</div>;
}

function RateEditor({ partnerId, initial, onSaved }: { partnerId: string; initial: number; onSaved: () => void }) {
  const [value, setValue] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const dirty = parseFloat(value) !== initial;

  const save = async () => {
    setSaving(true);
    await fetch(`/api/admin/partners/${partnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_rate", commissionRate: parseFloat(value) }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm py-1">
        <span className="text-gray-500">Комиссия</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white text-right text-sm"
          />
          <span className="text-xs text-gray-500">= {Math.round(parseFloat(value || "0") * 100)}%</span>
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
            >
              {saving ? "…" : "✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MinPayoutEditor({ partnerId, initial, onSaved }: { partnerId: string; initial: number; onSaved: () => void }) {
  const [value, setValue] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const dirty = parseFloat(value) !== initial;

  const save = async () => {
    setSaving(true);
    await fetch(`/api/admin/partners/${partnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_min_payout", minPayoutAmount: parseFloat(value) }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">Мин. выплата</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">$</span>
        <input
          type="number"
          step="1"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-white text-right text-sm"
        />
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
          >
            {saving ? "…" : "✓"}
          </button>
        )}
      </div>
    </div>
  );
}

function PayoutEditor({ partner, onSaved }: { partner: Partner; onSaved: () => void }) {
  const [last4, setLast4] = useState(partner.cardLast4 || "");
  const [holder, setHolder] = useState(partner.cardHolder || "");
  const [bank, setBank] = useState(partner.bankName || "");
  const [notes, setNotes] = useState(partner.payoutNotes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const digits = last4.replace(/\D/g, "");
    if (last4 && digits.length !== 4) {
      alert("Введите ровно 4 последние цифры карты");
      return;
    }
    setSaving(true);
    await fetch(`/api/admin/partners/${partner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_payout",
        cardLast4: digits,
        cardHolder: holder,
        bankName: bank,
        payoutNotes: notes,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">Реквизиты для выплат</h2>
      <p className="text-xs text-gray-500 mb-3">
        Полный PAN не храним — только last4 для идентификации. Перевод вручную в банк-клиенте.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Last 4 цифры карты</label>
          <input
            type="text"
            value={last4}
            onChange={(e) => setLast4(e.target.value)}
            placeholder="1234"
            maxLength={4}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Имя владельца</label>
          <input
            type="text"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="IVAN PETROV"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Банк</label>
          <input
            type="text"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="Каспи / Сбер / Тинькофф"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Заметки партнёра</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Например: только до 18:00 МСК"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
      >
        {saving ? "Сохраняем…" : "Сохранить реквизиты"}
      </button>
    </div>
  );
}

function AdminNotesEditor({
  partnerId,
  initial,
  onSaved,
}: {
  partnerId: string;
  initial: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initial;

  const save = async () => {
    setSaving(true);
    await fetch(`/api/admin/partners/${partnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_admin_notes", adminNotes: value }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="bg-[#12122a] border border-white/5 rounded-xl p-4 mt-6">
      <h2 className="text-sm font-semibold text-gray-400 mb-3">
        Внутренние заметки <span className="text-xs font-normal text-gray-500">(партнёру невидимы)</span>
      </h2>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white"
        placeholder="История переговоров, договорённости, причины блокировок и т.п."
      />
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      )}
    </div>
  );
}
