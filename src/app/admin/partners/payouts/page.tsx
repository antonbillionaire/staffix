"use client";

/**
 * Месячная страница выплат партнёрам.
 * Слева — список готовых к выплате (с реквизитами для удобства банковского перевода).
 * Справа — история выплат за последние 6 месяцев.
 *
 * CSV-экспорт списка к выплате — для тех кто загружает в банк-клиент пачкой.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Loader2,
  Download,
  Check,
  AlertCircle,
  Copy,
  History,
} from "lucide-react";

interface ReadyPartner {
  id: string;
  name: string;
  email: string;
  referralCode: string | null;
  minPayoutAmount: number;
  agreementSignedAt: string | null;
  cardLast4: string | null;
  cardHolder: string | null;
  bankName: string | null;
  payoutNotes: string | null;
  availableAmount: number;
  earningsCount: number;
  meetsThreshold: boolean;
  missingPayoutDetails: boolean;
}

interface PayoutHistory {
  id: string;
  partnerId: string;
  amount: number;
  periodLabel: string | null;
  reference: string | null;
  paidAt: string;
  paidByEmail: string | null;
  notes: string | null;
  recipientCardLast4: string | null;
  partner: { id: string; name: string; email: string; referralCode: string | null };
}

interface ApiResponse {
  readyToPayout: ReadyPartner[];
  recentPayouts: PayoutHistory[];
  totals: {
    partnersReady: number;
    amountReady: number;
    amountAboveThreshold: number;
  };
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/partners/payouts");
      if (!res.ok) throw new Error("fetch failed");
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });

  const copy = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = data.readyToPayout.filter((p) => p.meetsThreshold);
    if (rows.length === 0) return alert("Нет партнёров с суммой выше порога");

    const header = [
      "Имя",
      "Email",
      "Реф. код",
      "Сумма USD",
      "Карта (last4)",
      "Имя на карте",
      "Банк",
      "Заметки",
    ];
    const lines = rows.map((p) =>
      [
        p.name,
        p.email,
        p.referralCode || "",
        p.availableAmount.toFixed(2),
        p.cardLast4 ? `**** ${p.cardLast4}` : "",
        p.cardHolder || "",
        p.bankName || "",
        p.payoutNotes || "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = "﻿" + [header.join(","), ...lines].join("\n"); // BOM для Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `staffix-partner-payouts-${new Date().toISOString().slice(0, 7)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const markPaid = async (partnerId: string) => {
    const reference = prompt("Reference банковского перевода (опционально, но рекомендуется):");
    if (reference === null) return; // cancel

    const notes = prompt("Дополнительные заметки (опционально):");
    if (!confirm(`Подтвердите: партнёру выплачена комиссия?`)) return;

    setSubmittingFor(partnerId);
    try {
      const res = await fetch("/api/admin/partners/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          reference: reference || undefined,
          notes: notes || undefined,
        }),
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
      setSubmittingFor(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> К списку партнёров
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-400" /> Выплаты партнёрам
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Hold-период 30 дней. Выплаты раз в месяц через банковский перевод.
            </p>
          </div>
          {data && data.readyToPayout.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm transition-colors"
            >
              <Download className="h-4 w-4" /> Скачать CSV
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Партнёров готово" value={data?.totals.partnersReady ?? 0} />
          <StatCard
            label="Готово к выплате (выше порога)"
            value={fmt(data?.totals.amountAboveThreshold ?? 0)}
            highlight
          />
          <StatCard label="Всего available" value={fmt(data?.totals.amountReady ?? 0)} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Ready to payout */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">К выплате сейчас</h2>
            {loading ? (
              <div className="flex items-center justify-center p-12 bg-[#12122a] border border-white/5 rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              </div>
            ) : !data || data.readyToPayout.length === 0 ? (
              <div className="bg-[#12122a] border border-white/5 rounded-xl p-12 text-center text-gray-500">
                Нет партнёров с available earnings
              </div>
            ) : (
              <div className="space-y-3">
                {data.readyToPayout.map((p) => (
                  <ReadyPartnerCard
                    key={p.id}
                    partner={p}
                    onMarkPaid={() => markPaid(p.id)}
                    submitting={submittingFor === p.id}
                    onCopy={copy}
                    copiedField={copiedField}
                    fmt={fmt}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent payouts */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <History className="h-4 w-4" /> История за 6 мес
            </h2>
            {loading ? (
              <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              </div>
            ) : !data || data.recentPayouts.length === 0 ? (
              <div className="bg-[#12122a] border border-white/5 rounded-xl p-6 text-sm text-gray-500 text-center">
                Выплат пока не было
              </div>
            ) : (
              <div className="bg-[#12122a] border border-white/5 rounded-xl divide-y divide-white/5 max-h-[700px] overflow-y-auto">
                {data.recentPayouts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/partners/${p.partnerId}`}
                    className="block p-3 hover:bg-white/3 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">{p.partner.name}</span>
                      <span className="text-sm font-semibold text-green-400">{fmt(p.amount)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {fmtDate(p.paidAt)}
                      {p.periodLabel && ` · ${p.periodLabel}`}
                    </div>
                    {p.reference && (
                      <div className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                        ref: {p.reference}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-[#12122a] border rounded-xl p-4 ${
        highlight ? "border-green-500/30" : "border-white/5"
      }`}
    >
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-green-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function ReadyPartnerCard({
  partner,
  onMarkPaid,
  submitting,
  onCopy,
  copiedField,
  fmt,
}: {
  partner: ReadyPartner;
  onMarkPaid: () => void;
  submitting: boolean;
  onCopy: (value: string, field: string) => void;
  copiedField: string | null;
  fmt: (n: number) => string;
}) {
  const blockers: string[] = [];
  if (!partner.agreementSignedAt) blockers.push("соглашение не подписано");
  if (!partner.cardLast4) blockers.push("нет реквизитов карты");
  if (!partner.meetsThreshold) blockers.push(`сумма ниже порога $${partner.minPayoutAmount}`);

  const canPay = blockers.length === 0;

  return (
    <div
      className={`bg-[#12122a] border rounded-xl p-4 ${
        canPay ? "border-green-500/30" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <Link
            href={`/admin/partners/${partner.id}`}
            className="font-medium text-white hover:text-blue-300"
          >
            {partner.name}
          </Link>
          <div className="text-xs text-gray-500">
            {partner.email}
            {partner.referralCode && ` · ${partner.referralCode}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-green-400">{fmt(partner.availableAmount)}</div>
          <div className="text-xs text-gray-500">{partner.earningsCount} начислений</div>
        </div>
      </div>

      {/* Реквизиты с copy-кнопками */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <CopyField
          label="Карта (last 4)"
          value={partner.cardLast4 ? `**** ${partner.cardLast4}` : null}
          onCopy={(v) => onCopy(v, `${partner.id}-card`)}
          copied={copiedField === `${partner.id}-card`}
        />
        <CopyField
          label="Имя на карте"
          value={partner.cardHolder}
          onCopy={(v) => onCopy(v, `${partner.id}-holder`)}
          copied={copiedField === `${partner.id}-holder`}
        />
        <CopyField
          label="Банк"
          value={partner.bankName}
          onCopy={(v) => onCopy(v, `${partner.id}-bank`)}
          copied={copiedField === `${partner.id}-bank`}
        />
        <CopyField
          label="Сумма"
          value={partner.availableAmount.toFixed(2)}
          onCopy={(v) => onCopy(v, `${partner.id}-amount`)}
          copied={copiedField === `${partner.id}-amount`}
        />
      </div>

      {partner.payoutNotes && (
        <div className="text-xs text-gray-400 mb-3 bg-white/3 rounded p-2 italic">
          📝 {partner.payoutNotes}
        </div>
      )}

      {blockers.length > 0 && (
        <div className="flex items-start gap-2 mb-3 text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded p-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>Нельзя выплатить: {blockers.join(", ")}</div>
        </div>
      )}

      <button
        onClick={onMarkPaid}
        disabled={!canPay || submitting}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          canPay
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-white/5 text-gray-500 cursor-not-allowed"
        }`}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Отметил как выплачено
      </button>
    </div>
  );
}

function CopyField({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string | null;
  onCopy: (v: string) => void;
  copied: boolean;
}) {
  if (!value) {
    return (
      <div className="bg-white/3 rounded px-2 py-1.5">
        <div className="text-[10px] text-gray-500 uppercase">{label}</div>
        <div className="text-xs text-gray-600 italic">—</div>
      </div>
    );
  }
  return (
    <button
      onClick={() => onCopy(value)}
      className="bg-white/3 hover:bg-white/5 rounded px-2 py-1.5 text-left transition-colors group"
    >
      <div className="text-[10px] text-gray-500 uppercase flex items-center justify-between">
        {label}
        {copied ? (
          <Check className="h-3 w-3 text-green-400" />
        ) : (
          <Copy className="h-3 w-3 text-gray-600 opacity-0 group-hover:opacity-100" />
        )}
      </div>
      <div className="text-xs text-white font-mono truncate">{value}</div>
    </button>
  );
}
