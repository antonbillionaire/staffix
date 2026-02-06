"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Brain,
  Check,
  Sparkles,
  MessageSquare,
  Users,
  Zap,
  Shield,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { PLANS, MESSAGE_PACKS } from "@/lib/plans";

export default function PricingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  // Check if user is logged in
  const isLoggedIn = status === "authenticated" && !!session;

  // Convert PLANS object to array for rendering (exclude trial from main cards)
  const paidPlans = [
    { ...PLANS.starter, cta: "Выбрать Starter" },
    { ...PLANS.pro, cta: "Выбрать Pro" },
    { ...PLANS.business, cta: "Выбрать Business" },
    { ...PLANS.enterprise, cta: "Выбрать Enterprise" },
  ];

  const handleSelectPlan = (planId: string) => {
    router.push(`/checkout?plan=${planId}&billing=${billingPeriod}`);
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
            <Link href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Staffix</span>
            </Link>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Простое ценообразование
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Все функции доступны на каждом плане. Платите только за количество сообщений.
          </p>
        </div>

        {/* Trial banner - only show for non-logged-in users */}
        {!isLoggedIn && (
          <div className="max-w-3xl mx-auto mb-12">
            <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-green-400" />
                <span className="text-green-400 font-semibold">Бесплатный пробный период</span>
              </div>
              <p className="text-white text-lg mb-4">
                14 дней бесплатно с 200 сообщениями и всеми функциями
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-500 transition-colors"
              >
                Начать бесплатно
              </Link>
            </div>
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              billingPeriod === "monthly"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Ежемесячно
          </button>
          <button
            onClick={() => setBillingPeriod("yearly")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              billingPeriod === "yearly"
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Ежегодно
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
              -20%
            </span>
          </button>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {paidPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-[#12122a] rounded-2xl border p-6 ${
                plan.popular
                  ? "border-blue-500/50 ring-1 ring-blue-500/20"
                  : "border-white/5"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium px-4 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="h-4 w-4" />
                    Популярный
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-gray-400 text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">
                    ${billingPeriod === "monthly"
                      ? plan.monthlyPrice
                      : Math.round(plan.yearlyPrice / 12)}
                  </span>
                  <span className="text-gray-400">/мес</span>
                </div>
                {billingPeriod === "yearly" && plan.yearlyPrice > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    ${plan.yearlyPrice} в год
                  </p>
                )}
              </div>

              {/* Messages highlight */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-400" />
                  <span className="text-blue-400 font-semibold">
                    {plan.features.messagesLimit >= 999999
                      ? "Безлимит"
                      : `${plan.features.messagesLimit.toLocaleString()} сообщений`}
                  </span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.featuresList.slice(1).map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-3 rounded-xl font-medium transition-all ${
                  plan.popular
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Message packs section */}
        <div className="bg-[#12122a] rounded-2xl border border-white/5 p-8 md:p-12 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              Нужно больше сообщений?
            </h2>
            <p className="text-gray-400">
              Докупите дополнительные пакеты в любое время
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {MESSAGE_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:border-blue-500/30 transition-colors"
              >
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{pack.name}</h3>
                <p className="text-3xl font-bold text-white mb-1">${pack.price}</p>
                <p className="text-sm text-gray-500">
                  ${pack.pricePerMessage.toFixed(2)} за сообщение
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Features section */}
        <div className="bg-[#12122a] rounded-2xl border border-white/5 p-8 md:p-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Все планы включают
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="font-medium text-white mb-2">Telegram бот</h3>
              <p className="text-sm text-gray-400">AI-сотрудник в Telegram</p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="font-medium text-white mb-2">Встроенная CRM</h3>
              <p className="text-sm text-gray-400">База клиентов и рассылки</p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="font-medium text-white mb-2">Автоматизации</h3>
              <p className="text-sm text-gray-400">Напоминания и отзывы</p>
            </div>
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-yellow-400" />
              </div>
              <h3 className="font-medium text-white mb-2">Аналитика</h3>
              <p className="text-sm text-gray-400">Полная статистика</p>
            </div>
          </div>
        </div>

        {!isLoggedIn && (
          <p className="text-center text-gray-500 mt-8">
            💳 Оплата после пробного периода. Отмена в любой момент.
          </p>
        )}
      </main>
    </div>
  );
}
