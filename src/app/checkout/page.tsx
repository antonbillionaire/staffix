"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Brain,
  ArrowLeft,
  Check,
  CreditCard,
  Smartphone,
  Loader2,
  Shield,
  Lock,
  AlertCircle,
} from "lucide-react";

const plans: Record<string, { name: string; monthlyPrice: number; yearlyPrice: number; features: string[] }> = {
  "pro": {
    name: "Pro",
    monthlyPrice: 50,
    yearlyPrice: 500,
    features: ["500 сообщений в месяц", "1 AI-сотрудник", "Полная аналитика", "Загрузка собственного логотипа"],
  },
  "business": {
    name: "Business",
    monthlyPrice: 100,
    yearlyPrice: 1000,
    features: ["Безлимит сообщений", "2 AI-сотрудника", "Персональный менеджер", "Загрузка собственного логотипа"],
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const planKey = searchParams.get("plan") || "стартовый";
  const billing = searchParams.get("billing") || "monthly";

  const plan = plans[planKey] || plans["стартовый"];
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const monthlyEquivalent = billing === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

  const [paymentMethod, setPaymentMethod] = useState<"kaspi" | "card">("kaspi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields for card payment
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create subscription via API
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey,
          billing,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка оплаты");
      }

      // Redirect to success page
      router.push("/checkout/success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обработки платежа");
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Staffix</span>
            </Link>
            <Link
              href="/pricing"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад к тарифам
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Оформление подписки
        </h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order summary */}
          <div className="bg-[#12122a] rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Ваш заказ
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white font-medium">План {plan.name}</p>
                  <p className="text-sm text-gray-400">
                    {billing === "yearly" ? "Годовая подписка" : "Ежемесячная подписка"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">
                    ${price}
                  </p>
                  {billing === "yearly" && (
                    <p className="text-sm text-green-400">
                      ${monthlyEquivalent}/мес
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-sm text-gray-400 mb-3">Включено:</p>
                <ul className="space-y-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="h-4 w-4 text-green-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-white/10 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-white">Итого</span>
                  <span className="text-2xl font-bold text-white">
                    ${price}
                  </span>
                </div>
              </div>
            </div>

            {/* Security badges */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Безопасный платёж
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  SSL шифрование
                </div>
              </div>
            </div>
          </div>

          {/* Payment form */}
          <div className="bg-[#12122a] rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Способ оплаты
            </h2>

            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Payment method selection */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setPaymentMethod("kaspi")}
                className={`p-4 rounded-xl border text-center transition-all ${
                  paymentMethod === "kaspi"
                    ? "bg-[#FF0000]/10 border-[#FF0000]/50 text-white"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                <Smartphone className="h-6 w-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Kaspi QR</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`p-4 rounded-xl border text-center transition-all ${
                  paymentMethod === "card"
                    ? "bg-blue-500/10 border-blue-500/50 text-white"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                <CreditCard className="h-6 w-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Карта</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {paymentMethod === "kaspi" ? (
                <div className="text-center py-6">
                  {/* Kaspi QR placeholder */}
                  <div className="w-48 h-48 bg-white rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <div className="text-center">
                      <Smartphone className="h-12 w-12 text-[#FF0000] mx-auto mb-2" />
                      <p className="text-gray-600 text-sm font-medium">Kaspi QR</p>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Отсканируйте QR-код в приложении Kaspi
                  </p>
                  <p className="text-gray-500 text-xs mt-2">
                    или нажмите кнопку оплатить для имитации платежа
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Номер карты
                    </label>
                    <input
                      type="text"
                      value={cardForm.cardNumber}
                      onChange={(e) =>
                        setCardForm({
                          ...cardForm,
                          cardNumber: formatCardNumber(e.target.value),
                        })
                      }
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Срок действия
                      </label>
                      <input
                        type="text"
                        value={cardForm.expiry}
                        onChange={(e) =>
                          setCardForm({
                            ...cardForm,
                            expiry: formatExpiry(e.target.value),
                          })
                        }
                        placeholder="MM/YY"
                        maxLength={5}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        CVV
                      </label>
                      <input
                        type="text"
                        value={cardForm.cvv}
                        onChange={(e) =>
                          setCardForm({
                            ...cardForm,
                            cvv: e.target.value.replace(/\D/g, "").substring(0, 3),
                          })
                        }
                        placeholder="000"
                        maxLength={3}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Имя на карте
                    </label>
                    <input
                      type="text"
                      value={cardForm.name}
                      onChange={(e) =>
                        setCardForm({ ...cardForm, name: e.target.value.toUpperCase() })
                      }
                      placeholder="IVAN IVANOV"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-4 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    Оплатить ${price}
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Нажимая кнопку, вы соглашаетесь с{" "}
                <Link href="/terms" className="text-blue-400 hover:text-blue-300">
                  условиями использования
                </Link>{" "}
                и{" "}
                <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
                  политикой конфиденциальности
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
