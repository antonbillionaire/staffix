"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Brain,
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Shield,
  Lock,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();

  const planKey = (searchParams.get("plan") || "pro") as PlanId;
  const billing = (searchParams.get("billing") || "monthly") as "monthly" | "yearly";

  const plan = PLANS[planKey] || PLANS.pro;
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const monthlyEquivalent = billing === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect to login if not authenticated
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push(`/login?callbackUrl=${encodeURIComponent(`/checkout?plan=${planKey}&billing=${billing}`)}`);
    return null;
  }

  const handleCheckout = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planKey,
          billingPeriod: billing,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка создания оплаты");
      }

      // Redirect to Lemon Squeezy checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("Не удалось получить ссылку на оплату");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка обработки платежа");
      setLoading(false);
    }
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
            <Link href="/dashboard" className="flex items-center gap-3">
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
      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Оформление подписки
        </h1>

        {/* Order summary */}
        <div className="bg-[#12122a] rounded-2xl border border-white/5 p-6 mb-6">
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
                {plan.featuresList.map((feature: string, idx: number) => (
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
              {billing === "yearly" && (
                <p className="text-sm text-green-400 text-right">
                  Экономия ${plan.monthlyPrice * 12 - plan.yearlyPrice} в год
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment section */}
        <div className="bg-[#12122a] rounded-2xl border border-white/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Оплата
          </h2>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Payment info */}
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="h-5 w-5 text-blue-400" />
              <span className="text-white font-medium">Безопасная оплата</span>
            </div>
            <p className="text-sm text-gray-400">
              Вы будете перенаправлены на защищённую страницу оплаты.
              Мы принимаем все основные карты (Visa, Mastercard, American Express).
            </p>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-4 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Переход к оплате...
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Оплатить ${price}
                <ExternalLink className="h-4 w-4 ml-1" />
              </>
            )}
          </button>

          {/* Security badges */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                Безопасный платёж
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4" />
                SSL шифрование
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Нажимая кнопку, вы соглашаетесь с{" "}
            <Link href="/terms" className="text-blue-400 hover:text-blue-300">
              условиями использования
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
              политикой конфиденциальности
            </Link>
          </p>
        </div>

        {/* Lemon Squeezy badge */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Безопасные платежи обрабатываются через Lemon Squeezy
          </p>
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
