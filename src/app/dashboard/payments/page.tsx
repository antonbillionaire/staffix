"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  Info,
  Save,
  Check,
  Loader2,
} from "lucide-react";

export default function PaymentsPage() {
  const [paymentSettings, setPaymentSettings] = useState({
    paymeId: "",
    clickServiceId: "",
    clickMerchantId: "",
    kaspiPayLink: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          if (data.business) {
            setPaymentSettings({
              paymeId: data.business.paymeId || "",
              clickServiceId: data.business.clickServiceId || "",
              clickMerchantId: data.business.clickMerchantId || "",
              kaspiPayLink: data.business.kaspiPayLink || "",
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentSettings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Disclaimer banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Ваши деньги — у вас. Staffix не касается платежей.
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Staffix только помогает <strong>настроить</strong> кнопки оплаты в боте.
              Все платежи проходят <strong>напрямую</strong> через платёжного оператора (Payme, Click, Kaspi) —
              без посредников и без участия Staffix.
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-100 flex gap-3">
          <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">
            Вводя Merchant ID или Service ID вы не раскрываете секретную информацию — это публичные идентификаторы.
            Staffix не имеет доступа к вашему счёту, балансу или истории транзакций.
          </p>
        </div>
      </div>

      {/* Payment settings card */}
      <div className="bg-[#12122a] rounded-2xl border border-white/5 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Приём оплаты</h2>
            <p className="text-sm text-gray-400">Payme, Click, Kaspi — клиент платит прямо в Telegram</p>
          </div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm text-green-300">
          Введите свои ID из личных кабинетов — и бот будет автоматически отправлять кнопки оплаты клиентам после каждого заказа.
        </div>

        {/* Payme */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">🟢</span>
            <label className="text-sm font-semibold text-white">Payme</label>
          </div>
          <label className="block text-xs text-gray-400 mb-1.5">Merchant ID</label>
          <input
            type="text"
            value={paymentSettings.paymeId}
            onChange={(e) => setPaymentSettings({ ...paymentSettings, paymeId: e.target.value })}
            placeholder="6505e7cb3e9d89693d95eef5"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Найдите в личном кабинете Payme → Настройки → Мерчант ID
          </p>
        </div>

        {/* Click */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">🔵</span>
            <label className="text-sm font-semibold text-white">Click</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Service ID</label>
              <input
                type="text"
                value={paymentSettings.clickServiceId}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, clickServiceId: e.target.value })}
                placeholder="12345"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Merchant ID</label>
              <input
                type="text"
                value={paymentSettings.clickMerchantId}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, clickMerchantId: e.target.value })}
                placeholder="67890"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Найдите в личном кабинете my.click.uz → Мои сервисы
          </p>
        </div>

        {/* Kaspi */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">🔴</span>
            <label className="text-sm font-semibold text-white">Kaspi Pay</label>
          </div>
          <label className="block text-xs text-gray-400 mb-1.5">Ссылка для оплаты</label>
          <input
            type="url"
            value={paymentSettings.kaspiPayLink}
            onChange={(e) => setPaymentSettings({ ...paymentSettings, kaspiPayLink: e.target.value })}
            placeholder="https://kaspi.kz/pay/..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-500/50 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Ваша персональная ссылка Kaspi для получения оплаты
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600/20 border border-green-500/30 text-green-300 py-3 px-4 rounded-xl font-medium hover:bg-green-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Сохраняем...</>
          ) : saved ? (
            <><Check className="h-4 w-4" /> Сохранено!</>
          ) : (
            <><Save className="h-4 w-4" /> Сохранить настройки оплаты</>
          )}
        </button>
      </div>

      {/* How it works */}
      <div className="bg-[#12122a] rounded-2xl border border-white/5 p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Как это работает</h3>
        <ol className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 text-white rounded-lg flex items-center justify-center text-xs font-bold">1</span>
            <span>Клиент оформляет заказ через бота</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 text-white rounded-lg flex items-center justify-center text-xs font-bold">2</span>
            <span>Бот автоматически отправляет кнопку оплаты в Telegram</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 text-white rounded-lg flex items-center justify-center text-xs font-bold">3</span>
            <span>Клиент нажимает кнопку и оплачивает напрямую через Payme/Click/Kaspi</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-white/10 text-white rounded-lg flex items-center justify-center text-xs font-bold">4</span>
            <span>Деньги зачисляются напрямую на ваш счёт у оператора</span>
          </li>
        </ol>
      </div>

    </div>
  );
}
