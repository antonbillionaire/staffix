"use client";

/**
 * Sprint 4D (M18) — Meta Ad Insights для владельца бизнеса.
 * Показывает spend / CPL / CTR + воронку от IG-клика до продажи.
 * Требует Meta OAuth + fbAdAccountId в настройках; иначе показывает
 * empty state с инструкцией.
 */

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DollarSign,
  MousePointerClick,
  TrendingUp,
  Users,
  UserCheck,
  Loader2,
  RefreshCw,
  Info,
  Megaphone,
} from "lucide-react";
import Link from "next/link";

interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  attributedLeads: number;
  attributedClients: number;
  cpl: number | null;
  cpa: number | null;
}

interface Funnel {
  clicks: number;
  leads: number;
  clients: number;
  clickToLead: number | null;
  leadToClient: number | null;
}

interface Campaign {
  campaignId: string;
  campaignName: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  attributedLeads: number;
  attributedClients: number;
  ctr: number | null;
  cpl: number | null;
  cpa: number | null;
}

interface AdInsightsResponse {
  configured: boolean;
  period: string;
  currency: string | null;
  totals: Totals;
  funnel: Funnel;
  campaigns: Campaign[];
  daily: { date: string; spend: number; clicks: number; leads: number }[];
  lastSyncedAt: string | null;
}

type Period = "week" | "month" | "all";

function formatMoney(v: number, currency: string | null) {
  const rounded = Math.round(v * 100) / 100;
  return currency ? `${rounded} ${currency}` : String(rounded);
}
function formatPct(v: number | null) {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}
function formatMaybe(v: number | null, currency: string | null) {
  return v === null ? "—" : formatMoney(v, currency);
}

export default function AdsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<AdInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/ads?period=${period}`);
      if (!res.ok) throw new Error((await res.json())?.error || "Ошибка загрузки");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/ads", { method: "POST" });
      if (!res.ok) throw new Error((await res.json())?.error || "Sync failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className={`h-8 w-8 animate-spin ${textSecondary}`} />
      </div>
    );
  }

  // Empty state — Ad Account не подключён
  if (data && !data.configured) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className={`${cardBg} border ${borderColor} rounded-xl p-8 text-center`}>
          <Megaphone className={`h-12 w-12 mx-auto ${textSecondary} mb-4`} />
          <h1 className={`text-2xl font-bold ${textPrimary} mb-2`}>Реклама Meta</h1>
          <p className={`${textSecondary} mb-6`}>
            Подключите рекламный аккаунт Meta (Facebook), чтобы видеть spend,
            CPL, CTR и воронку от клика по рекламе в Instagram/Facebook до
            продажи в Staffix.
          </p>
          <Link
            href="/dashboard/channels/meta#ad-account"
            className="inline-block px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Настроить рекламный аккаунт
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Реклама Meta</h1>
          <p className={textSecondary}>
            Spend / CPL / CTR + воронка от IG-клика до продажи
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex ${cardBg} rounded-lg border ${borderColor} p-1`}>
            {(["week", "month", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : `${textSecondary} hover:${textPrimary}`
                }`}
              >
                {p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Всё"}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            disabled={syncing}
            className={`flex items-center gap-2 px-3 py-1.5 ${cardBg} border ${borderColor} rounded-lg text-sm font-medium ${textSecondary} hover:${textPrimary} transition-colors disabled:opacity-50`}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className={`p-4 rounded-lg border border-red-500/40 bg-red-500/10 ${textPrimary}`}>
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Не удалось получить данные</p>
              <p className={`text-sm mt-1 ${textSecondary}`}>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <DollarSign className="h-5 w-5 text-green-500" />
          <p className={`text-2xl font-bold ${textPrimary} mt-3`}>
            {data ? formatMoney(data.totals.spend, data.currency) : "—"}
          </p>
          <p className={textSecondary}>Потрачено</p>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <MousePointerClick className="h-5 w-5 text-blue-500" />
          <p className={`text-2xl font-bold ${textPrimary} mt-3`}>
            {data?.totals.clicks ?? 0}
          </p>
          <p className={textSecondary}>Кликов</p>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <TrendingUp className="h-5 w-5 text-purple-500" />
          <p className={`text-2xl font-bold ${textPrimary} mt-3`}>
            {data ? formatPct(data.totals.ctr) : "—"}
          </p>
          <p className={textSecondary}>CTR</p>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <UserCheck className="h-5 w-5 text-orange-500" />
          <p className={`text-2xl font-bold ${textPrimary} mt-3`}>
            {data ? formatMaybe(data.totals.cpl, data.currency) : "—"}
          </p>
          <p className={textSecondary}>Средний CPL</p>
        </div>
      </div>

      {/* Воронка */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Воронка от рекламы до продажи
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-500">
              {data?.funnel.clicks ?? 0}
            </div>
            <div className={textSecondary}>Клики по рекламе</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-500">
              {data?.funnel.leads ?? 0}
            </div>
            <div className={textSecondary}>
              Лиды в IG/FB ({formatPct(data?.funnel.clickToLead ?? null)})
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-500">
              {data?.funnel.clients ?? 0}
            </div>
            <div className={textSecondary}>
              Клиентов ({formatPct(data?.funnel.leadToClient ?? null)})
            </div>
          </div>
        </div>
        <p className={`text-xs ${textSecondary} mt-4 flex items-start gap-2`}>
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Атрибуция считается по дате первого сообщения лида: если человек
            написал в IG/FB после клика по рекламе в тот же день — засчитывается
            лид. UTM-разбивка по кампаниям пока не сделана.
          </span>
        </p>
      </div>

      {/* Кампании */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
          <Users className="h-5 w-5" />
          Кампании
        </h3>
        {data && data.campaigns.length === 0 ? (
          <p className={textSecondary}>
            Пока нет данных. После первого запуска рекламы данные появятся
            в течение суток (обновление раз в день).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${textSecondary} border-b ${borderColor}`}>
                  <th className="pb-2 pr-4">Название</th>
                  <th className="pb-2 pr-4 text-right">Показы</th>
                  <th className="pb-2 pr-4 text-right">Клики</th>
                  <th className="pb-2 pr-4 text-right">CTR</th>
                  <th className="pb-2 pr-4 text-right">Потрачено</th>
                  <th className="pb-2 pr-4 text-right">Лиды</th>
                  <th className="pb-2 pr-4 text-right">CPL</th>
                  <th className="pb-2 text-right">Клиентов</th>
                </tr>
              </thead>
              <tbody>
                {data?.campaigns.map((c) => (
                  <tr key={c.campaignId} className={`${textPrimary} border-b ${borderColor}`}>
                    <td className="py-2 pr-4">{c.campaignName || c.campaignId}</td>
                    <td className="py-2 pr-4 text-right">{c.impressions}</td>
                    <td className="py-2 pr-4 text-right">{c.clicks}</td>
                    <td className="py-2 pr-4 text-right">{formatPct(c.ctr)}</td>
                    <td className="py-2 pr-4 text-right">
                      {formatMoney(c.spend, data.currency)}
                    </td>
                    <td className="py-2 pr-4 text-right">{c.attributedLeads}</td>
                    <td className="py-2 pr-4 text-right">
                      {formatMaybe(c.cpl, data.currency)}
                    </td>
                    <td className="py-2 text-right">{c.attributedClients}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data?.lastSyncedAt && (
        <p className={`text-xs ${textSecondary} text-right`}>
          Последнее обновление: {new Date(data.lastSyncedAt).toLocaleString("ru-RU")}
        </p>
      )}
    </div>
  );
}
