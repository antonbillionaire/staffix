"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  DollarSign,
  Users,
  TrendingUp,
  Copy,
  CheckCircle,
  Loader2,
  Clock,
  Zap,
  ExternalLink,
} from "lucide-react";

interface PartnerData {
  partner: {
    name: string;
    email: string;
    company: string | null;
    referralCode: string;
    commissionRate: number;
    totalEarnings: number;
    totalPaid: number;
    pendingPayout: number;
    createdAt: string;
  };
  stats: {
    totalReferrals: number;
    convertedReferrals: number;
    conversionRate: number;
    pendingEarnings: number;
  };
  referrals: Array<{
    id: string;
    userEmail: string;
    signedUpAt: string;
    converted: boolean;
    convertedAt: string | null;
    convertedPlan: string | null;
  }>;
  earnings: Array<{
    id: string;
    commissionAmount: number;
    paymentAmount: number;
    subscriptionPlan: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }>;
}

export default function PartnerDashboardPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/partners/dashboard?token=${token}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Ошибка загрузки");
      }
      const d = await res.json();
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const copyLink = () => {
    if (!data?.partner.referralCode) return;
    navigator.clipboard.writeText(`https://staffix.io/?ref=${data.partner.referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Нет доступа</h1>
          <p className="text-gray-400 mb-6">
            Ссылка на дашборд приходит на email после одобрения заявки.
          </p>
          <Link
            href="/partners#apply"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-all"
          >
            Подать заявку
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Ошибка</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/partners"
            className="text-blue-400 hover:text-blue-300"
          >
            Вернуться на страницу партнёров
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { partner, stats, referrals, earnings } = data;
  const referralLink = `https://staffix.io/?ref=${partner.referralCode}`;

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">Staffix</span>
          </Link>
          <div className="text-right">
            <p className="text-white font-medium">{partner.name}</p>
            {partner.company && <p className="text-sm text-gray-400">{partner.company}</p>}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Кабинет партнёра</h1>
          <p className="text-gray-400">
            Партнёр с {formatDate(partner.createdAt)} · Комиссия {Math.round(partner.commissionRate * 100)}%
          </p>
        </div>

        {/* Referral link */}
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-6 mb-8">
          <h2 className="font-semibold text-white mb-3">Ваша реферальная ссылка</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-blue-400 font-mono text-sm truncate">
              {referralLink}
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Скопировано!" : "Копировать"}
            </button>
            <a
              href={referralLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </a>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Атрибуция 60 дней — если клиент перешёл по вашей ссылке и оплатил в течение 60 дней, комиссия ваша.
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <DollarSign className="h-4 w-4" /> Всего заработано
            </div>
            <div className="text-3xl font-bold text-green-400">${partner.totalEarnings.toFixed(2)}</div>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Clock className="h-4 w-4" /> Ожидает выплаты
            </div>
            <div className="text-3xl font-bold text-yellow-400">${partner.pendingPayout.toFixed(2)}</div>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Users className="h-4 w-4" /> Переходов
            </div>
            <div className="text-3xl font-bold text-blue-400">{stats.totalReferrals}</div>
            <div className="text-xs text-gray-500 mt-1">{stats.convertedReferrals} стали клиентами</div>
          </div>
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <TrendingUp className="h-4 w-4" /> Конверсия
            </div>
            <div className="text-3xl font-bold text-purple-400">{stats.conversionRate}%</div>
            <div className="text-xs text-gray-500 mt-1">переход → платёж</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Recent referrals */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-4">Последние переходы</h2>
            {referrals.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                Переходов пока нет. Поделитесь реферальной ссылкой!
              </p>
            ) : (
              <div className="space-y-3">
                {referrals.slice(0, 10).map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">
                        {r.userEmail.replace(/(.{3}).+(@.+)/, "$1***$2")}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(r.signedUpAt)}</p>
                    </div>
                    <div className="text-right">
                      {r.converted ? (
                        <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-full">
                          {r.convertedPlan} ✓
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-full">
                          trial
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earnings history */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-4">История начислений</h2>
            {earnings.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">
                Начислений пока нет. Когда ваши рефералы оплатят подписку — комиссия появится здесь.
              </p>
            ) : (
              <div className="space-y-3">
                {earnings.slice(0, 10).map((e) => (
                  <div key={e.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white capitalize">{e.subscriptionPlan}</p>
                      <p className="text-xs text-gray-500">{formatDate(e.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-400">
                        +${e.commissionAmount.toFixed(2)}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          e.status === "paid"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-yellow-500/10 text-yellow-400"
                        }`}
                      >
                        {e.status === "paid" ? "Выплачено" : "Ожидает"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payout request */}
        <div className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 text-center">
          <h3 className="font-semibold text-white mb-2">Запросить выплату</h3>
          <p className="text-gray-400 text-sm mb-4">
            Выплаты производятся вручную на карту / USDT / Kaspi. Минимальная сумма — $50.
          </p>
          <a
            href={`mailto:partners@staffix.io?subject=Запрос выплаты — ${partner.referralCode}&body=Привет! Прошу выплатить накопленную комиссию.\n\nПартнёрский код: ${partner.referralCode}\nEmail: ${partner.email}\nСумма к выплате: $${partner.pendingPayout.toFixed(2)}\n\nРеквизиты: `}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-all"
          >
            Написать на partners@staffix.io
          </a>
        </div>
      </div>
    </div>
  );
}
