"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, X, CreditCard, Sparkles } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { PLANS } from "@/lib/plans";

interface TrialExpiredBannerProps {
  daysOverdue?: number;
}

export default function TrialExpiredBanner({ daysOverdue = 0 }: TrialExpiredBannerProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const proPlan = PLANS.pro;

  return (
    <div
      className={`relative mx-4 md:mx-8 mt-4 p-5 rounded-xl border ${
        isDark
          ? "bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30"
          : "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
      }`}
    >
      {/* Close button */}
      <button
        onClick={() => setDismissed(true)}
        className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${
          isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
        }`}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Icon and text */}
        <div className="flex items-start gap-4 flex-1">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-red-500/20" : "bg-red-100"
            }`}
          >
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h3 className={`font-semibold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
              Пробный период закончился
            </h3>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Чтобы продолжить использовать AI-сотрудника и автоматизации, выберите тарифный план.
              {daysOverdue > 0 && ` Прошло ${daysOverdue} дней после окончания триала.`}
            </p>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-2 md:flex-shrink-0">
          <Link
            href="/checkout?plan=pro&billing=monthly"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-all text-sm"
          >
            <CreditCard className="h-4 w-4" />
            Pro ${proPlan.monthlyPrice}/мес
          </Link>
          <Link
            href="/checkout?plan=pro&billing=yearly"
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              isDark
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Sparkles className="h-4 w-4 text-yellow-500" />
            Год за ${proPlan.yearlyPrice} (-20%)
          </Link>
        </div>
      </div>
    </div>
  );
}
