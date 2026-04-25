"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Wallet, Plus, X, Trash2, TrendingUp, AlertTriangle, CheckCircle, Calendar } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  createdAt: string;
}

interface StaffFinance {
  id: string;
  name: string;
  role: string | null;
  baseRate: number;
  commissionPercent: number | null;
  revenue: number;
  commissionAmount: number;
  bonuses: number;
  fines: number;
  adjustments: number;
  totalEarned: number;
  paidOut: number;
  toPay: number;
  transactions: Transaction[];
}

interface Totals {
  revenue: number;
  totalEarned: number;
  paidOut: number;
  toPay: number;
  bonuses: number;
  fines: number;
}

type Period = "month" | "week" | "custom";

function formatMoney(n: number): string {
  return n.toLocaleString("ru-RU");
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function FinancesPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [staff, setStaff] = useState<StaffFinance[]>([]);
  const [totals, setTotals] = useState<Totals>({ revenue: 0, totalEarned: 0, paidOut: 0, toPay: 0, bonuses: 0, fines: 0 });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");

  const [periodStart, setPeriodStart] = useState<string>(() => {
    const d = new Date();
    return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    const d = new Date();
    return formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  });

  // Transaction modal
  const [txModalStaff, setTxModalStaff] = useState<StaffFinance | null>(null);
  const [txType, setTxType] = useState<"bonus" | "fine" | "payout" | "adjustment">("bonus");
  const [txAmount, setTxAmount] = useState("");
  const [txReason, setTxReason] = useState("");
  const [savingTx, setSavingTx] = useState(false);

  const card = isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-[#0c0c1f] border-white/10 text-white" : "bg-white border-gray-300 text-gray-900";

  const setPresetPeriod = (p: Period) => {
    const now = new Date();
    if (p === "month") {
      setPeriodStart(formatDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setPeriodEnd(formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (p === "week") {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setPeriodStart(formatDate(monday));
      setPeriodEnd(formatDate(sunday));
    }
    setPeriod(p);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/finances?periodStart=${periodStart}T00:00:00&periodEnd=${periodEnd}T23:59:59`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
        setTotals(data.totals || { revenue: 0, totalEarned: 0, paidOut: 0, toPay: 0, bonuses: 0, fines: 0 });
      }
    } catch (e) {
      console.error("Fetch finances error:", e);
    }
    setLoading(false);
  }, [periodStart, periodEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openTxModal = (s: StaffFinance, type: "bonus" | "fine" | "payout" | "adjustment") => {
    setTxModalStaff(s);
    setTxType(type);
    setTxAmount("");
    setTxReason("");
  };

  const saveTx = async () => {
    if (!txModalStaff || !txAmount) return;
    setSavingTx(true);
    try {
      const res = await fetch("/api/finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: txModalStaff.id,
          type: txType,
          amount: Number(txAmount),
          reason: txReason || null,
        }),
      });
      if (res.ok) {
        setTxModalStaff(null);
        await fetchData();
      }
    } catch (e) {
      console.error("Save tx error:", e);
    }
    setSavingTx(false);
  };

  const deleteTx = async (txId: string) => {
    if (!confirm(t("finances.deleteTxConfirm") || "Удалить транзакцию?")) return;
    try {
      const res = await fetch(`/api/finances/${txId}`, { method: "DELETE" });
      if (res.ok) await fetchData();
    } catch (e) {
      console.error("Delete tx error:", e);
    }
  };

  const payoutAll = async () => {
    if (!confirm(t("finances.payoutAllConfirm") || `Выплатить всем сотрудникам? Сумма: ${formatMoney(totals.toPay)}`)) return;
    try {
      for (const s of staff.filter((s) => s.toPay > 0)) {
        await fetch("/api/finances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            staffId: s.id,
            type: "payout",
            amount: s.toPay,
            reason: t("finances.payoutAll") || "Выплата команде",
          }),
        });
      }
      await fetchData();
    } catch (e) {
      console.error("Payout error:", e);
    }
  };

  const txTypeLabels: Record<string, string> = {
    bonus: t("finances.bonus") || "Премия",
    fine: t("finances.fine") || "Штраф",
    payout: t("finances.payout") || "Выплата",
    adjustment: t("finances.adjustment") || "Корректировка",
  };

  const txTypeColors: Record<string, string> = {
    bonus: "text-green-500",
    fine: "text-red-500",
    payout: "text-blue-500",
    adjustment: "text-gray-500",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${text}`}>{t("finances.title") || "Мои финансы"}</h1>
          <p className={`text-sm ${sub} mt-1`}>{t("finances.subtitle") || "Зарплаты сотрудников, премии, штрафы и выплаты"}</p>
        </div>
        {totals.toPay > 0 && (
          <button
            onClick={payoutAll}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            {t("finances.payoutTeam") || "Заплатить команде"} ({formatMoney(totals.toPay)})
          </button>
        )}
      </div>

      {/* Period selector */}
      <div className={`${card} border rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center`}>
        <Calendar className={`w-4 h-4 ${sub}`} />
        <button
          onClick={() => setPresetPeriod("week")}
          className={`px-3 py-1.5 rounded-lg text-sm ${period === "week" ? "bg-blue-600 text-white" : isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
        >
          {t("finances.week") || "Неделя"}
        </button>
        <button
          onClick={() => setPresetPeriod("month")}
          className={`px-3 py-1.5 rounded-lg text-sm ${period === "month" ? "bg-blue-600 text-white" : isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
        >
          {t("finances.month") || "Месяц"}
        </button>
        <button
          onClick={() => setPeriod("custom")}
          className={`px-3 py-1.5 rounded-lg text-sm ${period === "custom" ? "bg-blue-600 text-white" : isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
        >
          {t("finances.custom") || "Период"}
        </button>
        {period === "custom" && (
          <>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border text-sm outline-none ${input}`}
            />
            <span className={sub}>—</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className={`px-3 py-1.5 rounded-lg border text-sm outline-none ${input}`}
            />
          </>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`${card} border rounded-xl p-4`}>
          <p className={`text-xs ${sub} mb-1`}>{t("finances.revenue") || "Выручка"}</p>
          <p className={`text-xl font-bold ${text}`}>{formatMoney(totals.revenue)}</p>
        </div>
        <div className={`${card} border rounded-xl p-4`}>
          <p className={`text-xs ${sub} mb-1`}>{t("finances.totalEarned") || "Начислено"}</p>
          <p className={`text-xl font-bold ${text}`}>{formatMoney(totals.totalEarned)}</p>
        </div>
        <div className={`${card} border rounded-xl p-4`}>
          <p className={`text-xs ${sub} mb-1`}>{t("finances.paidOut") || "Выплачено"}</p>
          <p className={`text-xl font-bold text-green-500`}>{formatMoney(totals.paidOut)}</p>
        </div>
        <div className={`${card} border rounded-xl p-4`}>
          <p className={`text-xs ${sub} mb-1`}>{t("finances.toPay") || "К выплате"}</p>
          <p className={`text-xl font-bold text-orange-500`}>{formatMoney(totals.toPay)}</p>
        </div>
      </div>

      {/* Staff list */}
      {loading ? (
        <div className={`${card} border rounded-xl p-8 text-center`}>
          <Loader2 className={`w-6 h-6 mx-auto animate-spin ${sub}`} />
        </div>
      ) : staff.length === 0 ? (
        <div className={`${card} border rounded-xl p-12 text-center`}>
          <Wallet className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
          <p className={`text-lg font-medium ${text}`}>{t("finances.noStaff") || "Нет сотрудников"}</p>
          <p className={`text-sm ${sub} mt-2`}>{t("finances.noStaffHint") || "Добавьте сотрудников в разделе \"Моя команда\" и установите им ставку и комиссию"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((s) => (
            <div key={s.id} className={`${card} border rounded-xl p-4`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold ${text}`}>{s.name}</h3>
                    {s.role && <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-600"}`}>{s.role}</span>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div>
                      <p className={`text-xs ${sub}`}>{t("finances.baseRate") || "Базовая ставка"}</p>
                      <p className={`font-medium ${text}`}>{formatMoney(s.baseRate)}</p>
                    </div>
                    <div>
                      <p className={`text-xs ${sub}`}>{t("finances.commission") || "Комиссия"}</p>
                      <p className={`font-medium ${text}`}>
                        {s.commissionPercent ? `${s.commissionPercent}% = ${formatMoney(s.commissionAmount)}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${sub}`}>+ {t("finances.bonus") || "Премии"} / − {t("finances.fine") || "Штрафы"}</p>
                      <p className="font-medium">
                        <span className="text-green-500">+{formatMoney(s.bonuses)}</span>
                        {" / "}
                        <span className="text-red-500">−{formatMoney(s.fines)}</span>
                      </p>
                    </div>
                    <div>
                      <p className={`text-xs ${sub}`}>{t("finances.toPay") || "К выплате"}</p>
                      <p className={`font-bold text-base ${s.toPay > 0 ? "text-orange-500" : sub}`}>{formatMoney(s.toPay)}</p>
                    </div>
                  </div>
                  {s.transactions.length > 0 && (
                    <details className="mt-3">
                      <summary className={`text-xs cursor-pointer ${sub}`}>
                        {t("finances.transactions") || "Транзакции"} ({s.transactions.length})
                      </summary>
                      <div className="mt-2 space-y-1">
                        {s.transactions.map((tx) => (
                          <div key={tx.id} className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                            <span className={txTypeColors[tx.type]}>
                              {txTypeLabels[tx.type] || tx.type}
                            </span>
                            <span className={`font-medium ${text}`}>{formatMoney(tx.amount)}</span>
                            {tx.reason && <span className={sub}>— {tx.reason}</span>}
                            <span className={`ml-auto ${sub}`}>
                              {new Date(tx.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                            </span>
                            <button
                              onClick={() => deleteTx(tx.id)}
                              className={`${sub} hover:text-red-500`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => openTxModal(s, "bonus")}
                    className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 flex items-center gap-1"
                  >
                    <TrendingUp className="w-3 h-3" /> {t("finances.bonus") || "Премия"}
                  </button>
                  <button
                    onClick={() => openTxModal(s, "fine")}
                    className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" /> {t("finances.fine") || "Штраф"}
                  </button>
                  <button
                    onClick={() => openTxModal(s, "payout")}
                    className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 flex items-center gap-1"
                    disabled={s.toPay <= 0}
                  >
                    <CheckCircle className="w-3 h-3" /> {t("finances.payout") || "Выплата"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction modal */}
      {txModalStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${card} border rounded-xl w-full max-w-md`}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className={`font-semibold ${text}`}>
                {txTypeLabels[txType]} — {txModalStaff.name}
              </h3>
              <button onClick={() => setTxModalStaff(null)} className={sub}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {txType === "payout" && txModalStaff.toPay > 0 && (
                <button
                  onClick={() => setTxAmount(String(txModalStaff.toPay))}
                  className={`w-full text-sm px-3 py-2 rounded-lg ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}
                >
                  {t("finances.useFullAmount") || "Использовать полную сумму"}: {formatMoney(txModalStaff.toPay)}
                </button>
              )}
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("finances.amount") || "Сумма"}</label>
                <input
                  type="number"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="100000"
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("finances.reason") || "Причина"} ({t("finances.optional") || "необязательно"})</label>
                <input
                  type="text"
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                  placeholder={txType === "bonus" ? "За выполнение плана" : txType === "fine" ? "За опоздание" : ""}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-white/5">
              <button
                onClick={() => setTxModalStaff(null)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm ${isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
              >
                {t("finances.cancel") || "Отмена"}
              </button>
              <button
                onClick={saveTx}
                disabled={savingTx || !txAmount}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                {savingTx && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("finances.save") || "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
