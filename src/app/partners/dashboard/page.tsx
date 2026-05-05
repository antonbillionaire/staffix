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
  Image as ImageIcon,
  FileText,
  Download,
} from "lucide-react";

interface PartnerData {
  partner: {
    name: string;
    email: string;
    company: string | null;
    referralCode: string;
    commissionRate: number;
    minPayoutAmount: number;
    totalEarnings: number;
    totalPaid: number;
    pendingPayout: number;
    cardNumber: string | null;
    cardHolder: string | null;
    bankName: string | null;
    payoutNotes: string | null;
    agreementSignedAt: string | null;
    createdAt: string;
  };
  stats: {
    totalReferrals: number;
    convertedReferrals: number;
    conversionRate: number;
    pendingEarnings: number;
    availableEarnings: number;
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
    availableAt: string | null;
    paidAt: string | null;
    createdAt: string;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    periodLabel: string | null;
    reference: string | null;
    paidAt: string;
    recipientCardNumber: string | null;
    recipientBankName: string | null;
  }>;
  assets: Array<{
    id: string;
    type: "banner" | "template";
    title: string;
    description: string | null;
    imageUrl: string | null;
    content: string | null;
    category: string | null;
    language: string;
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

  const { partner, stats, referrals, earnings, payouts } = data;
  const assets = data.assets || [];
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

        {/* Stats — 2 ряда: финансы и привлечение */}
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Clock className="h-4 w-4" /> В hold-периоде
            </div>
            <div className="text-3xl font-bold text-yellow-400">${stats.pendingEarnings.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">Доступно к выплате через 30 дней с момента платежа клиента</div>
          </div>
          <div className="bg-[#12122a] border border-purple-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <DollarSign className="h-4 w-4" /> Готово к выплате
            </div>
            <div className="text-3xl font-bold text-purple-300">${partner.pendingPayout.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">
              Минимум для выплаты — ${partner.minPayoutAmount}
            </div>
          </div>
          <div className="bg-[#12122a] border border-green-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <CheckCircle className="h-4 w-4" /> Уже выплачено
            </div>
            <div className="text-3xl font-bold text-green-400">${partner.totalPaid.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">За всё время сотрудничества</div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mb-8">
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
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <DollarSign className="h-4 w-4" /> Всего заработано
            </div>
            <div className="text-3xl font-bold text-white">${partner.totalEarnings.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">Включая выплаченное и hold</div>
          </div>
        </div>

        {/* Promo-материалы (баннеры + шаблоны) — глобальные на всех партнёров */}
        {assets.length > 0 && <PromoAssets assets={assets} />}

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
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {earnings.map((e) => {
                  const statusBadge =
                    e.status === "paid"
                      ? { text: "Выплачено", color: "bg-green-500/10 text-green-400" }
                      : e.status === "available"
                        ? { text: "К выплате", color: "bg-purple-500/10 text-purple-300" }
                        : e.status === "cancelled"
                          ? { text: "Отменено", color: "bg-gray-500/10 text-gray-400" }
                          : { text: "В hold", color: "bg-yellow-500/10 text-yellow-400" };
                  return (
                    <div key={e.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white capitalize">{e.subscriptionPlan}</p>
                        <p className="text-xs text-gray-500">{formatDate(e.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-400">
                          +${e.commissionAmount.toFixed(2)}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                          {statusBadge.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Payouts history */}
        {payouts.length > 0 && (
          <div className="mt-8 bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="font-semibold text-white mb-4">История выплат</h2>
            <div className="space-y-3">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border-b border-white/5 last:border-0 pb-3 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-green-400">
                      ${p.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(p.paidAt)}
                      {p.periodLabel && ` · период ${p.periodLabel}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {p.recipientCardNumber && (
                      <div className="font-mono">
                        Карта {p.recipientCardNumber}
                        {p.recipientBankName && ` · ${p.recipientBankName}`}
                      </div>
                    )}
                    {p.reference && (
                      <div className="font-mono text-gray-500 mt-0.5">ref: {p.reference}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payout details form */}
        <PayoutDetailsForm
          token={token!}
          initial={{
            cardNumber: partner.cardNumber || "",
            cardHolder: partner.cardHolder || "",
            bankName: partner.bankName || "",
            payoutNotes: partner.payoutNotes || "",
          }}
          minPayoutAmount={partner.minPayoutAmount}
          agreementSigned={!!partner.agreementSignedAt}
          onSaved={loadDashboard}
        />

        {/* Program terms */}
        <div className="mt-8 bg-[#12122a] border border-white/5 rounded-xl p-6">
          <h3 className="font-semibold text-white mb-3">Условия программы</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>
              • Комиссия <strong className="text-white">{Math.round(partner.commissionRate * 100)}%</strong> — recurring,
              пока ваш реферал продолжает платить за подписку.
            </li>
            <li>
              • Hold-период <strong className="text-white">30 дней</strong> на каждую начисленную комиссию (защита от
              возвратов).
            </li>
            <li>
              • Минимальная выплата <strong className="text-white">${partner.minPayoutAmount}</strong>. Меньшая сумма
              переносится на следующий месяц.
            </li>
            <li>
              • Выплаты раз в месяц <strong className="text-white">5-го числа</strong> на указанную вами карту.
            </li>
            <li>
              • Cookie-окно атрибуции <strong className="text-white">60 дней</strong> с момента клика по реф. ссылке.
            </li>
            <li>• Самостоятельная регистрация на свою же ссылку запрещена.</li>
            <li>
              • Налоги в стране проживания — на вашей стороне (мы не выступаем налоговым агентом).
            </li>
          </ul>
          <p className="mt-4 text-xs text-gray-500">
            Вопросы по выплатам и программе:{" "}
            <a href="mailto:director.kbridge@gmail.com" className="text-blue-400 hover:text-blue-300">
              director.kbridge@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function PayoutDetailsForm({
  token,
  initial,
  minPayoutAmount,
  agreementSigned,
  onSaved,
}: {
  token: string;
  initial: { cardNumber: string; cardHolder: string; bankName: string; payoutNotes: string };
  minPayoutAmount: number;
  agreementSigned: boolean;
  onSaved: () => void;
}) {
  const [card, setCard] = useState(initial.cardNumber);
  const [holder, setHolder] = useState(initial.cardHolder);
  const [bank, setBank] = useState(initial.bankName);
  const [notes, setNotes] = useState(initial.payoutNotes);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    card !== initial.cardNumber ||
    holder !== initial.cardHolder ||
    bank !== initial.bankName ||
    notes !== initial.payoutNotes;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/partners/payout-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          cardNumber: card,
          cardHolder: holder,
          bankName: bank,
          payoutNotes: notes,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Ошибка сохранения");
        return;
      }
      setSavedAt(Date.now());
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-2">Реквизиты для выплат</h3>
      <p className="text-gray-400 text-sm mb-4">
        Указанные данные используются для перевода комиссии раз в месяц на вашу карту. Минимальная сумма — $
        {minPayoutAmount}.
      </p>

      {!agreementSigned && (
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-300">
          ⚠️ Для первой выплаты понадобится подписать партнёрское соглашение. Мы свяжемся с вами по email когда
          накопится сумма к выплате.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <Input label="Номер карты" value={card} onChange={setCard} placeholder="1234 5678 9012 3456" />
        <Input label="Имя на карте" value={holder} onChange={setHolder} placeholder="IVAN PETROV" />
        <Input label="Банк" value={bank} onChange={setBank} placeholder="Каспи / Сбер / Тинькофф" />
        <Input
          label="Дополнительно"
          value={notes}
          onChange={setNotes}
          placeholder="Например: только до 18:00 МСК"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Сохраняем…" : "Сохранить реквизиты"}
        </button>
        {savedAt && !dirty && (
          <span className="text-xs text-green-400">✓ Сохранено</span>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

/**
 * Блок «Promo-материалы»: баннеры (картинки для соцсетей) + шаблоны текстов.
 * Партнёр копирует текст одной кнопкой, баннер скачивает.
 */
function PromoAssets({
  assets,
}: {
  assets: Array<{
    id: string;
    type: "banner" | "template";
    title: string;
    description: string | null;
    imageUrl: string | null;
    content: string | null;
    category: string | null;
    language: string;
  }>;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const banners = assets.filter((a) => a.type === "banner");
  const templates = assets.filter((a) => a.type === "template");

  return (
    <div className="mb-8 bg-[#12122a] border border-white/5 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white">Promo-материалы</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Готовые тексты и баннеры — копируйте и используйте в соцсетях, мессенджерах, рассылках
          </p>
        </div>
      </div>

      {templates.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide mb-3">
            <FileText className="h-3.5 w-3.5" /> Шаблоны текстов
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="bg-black/20 border border-white/5 rounded-lg p-4 flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-white">{t.title}</h3>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => copy(t.id, t.content || "")}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded text-xs font-medium whitespace-nowrap transition-colors"
                  >
                    {copiedId === t.id ? (
                      <>
                        <CheckCircle className="h-3 w-3" /> Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Копировать
                      </>
                    )}
                  </button>
                </div>
                {t.content && (
                  <div className="text-xs text-gray-400 font-mono whitespace-pre-wrap line-clamp-5 flex-1">
                    {t.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {banners.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wide mb-3">
            <ImageIcon className="h-3.5 w-3.5" /> Баннеры
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {banners.map((b) => (
              <div
                key={b.id}
                className="bg-black/20 border border-white/5 rounded-lg overflow-hidden flex flex-col"
              >
                {b.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.imageUrl}
                    alt={b.title}
                    className="w-full max-h-40 object-contain bg-black/40"
                  />
                )}
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="text-sm font-medium text-white">{b.title}</h3>
                  {b.description && (
                    <p className="text-xs text-gray-500 mt-1 flex-1">{b.description}</p>
                  )}
                  {b.imageUrl && (
                    <a
                      href={b.imageUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <Download className="h-3 w-3" /> Скачать
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
