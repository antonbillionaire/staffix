"use client";

import Link from "next/link";
import { Lock, Sparkles, Zap, ArrowRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { type PlanId, PLANS } from "@/lib/plans";

interface UpgradePromptProps {
  feature: string;
  description: string;
  requiredPlan: PlanId;
}

export default function UpgradePrompt({
  feature,
  description,
  requiredPlan,
}: UpgradePromptProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const plan = PLANS[requiredPlan];

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div
        className={`max-w-md w-full text-center p-8 rounded-2xl border ${
          isDark
            ? "bg-[#12122a] border-white/10"
            : "bg-white border-gray-200"
        }`}
      >
        {/* Lock icon */}
        <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl flex items-center justify-center">
          <Lock className="h-8 w-8 text-blue-500" />
        </div>

        {/* Title */}
        <h2
          className={`text-xl font-bold mb-2 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          {feature}
        </h2>

        {/* Description */}
        <p
          className={`text-sm mb-6 ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {description}
        </p>

        {/* Plan badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/30 mb-6">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
            Доступно в плане {plan.name}
          </span>
        </div>

        {/* Features list */}
        <div className={`text-left mb-6 p-4 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
          <p className={`text-xs font-medium mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            План {plan.name} включает:
          </p>
          <ul className="space-y-2">
            {plan.featuresList.slice(0, 4).map((item, idx) => (
              <li
                key={idx}
                className={`flex items-center gap-2 text-sm ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                <Zap className="h-4 w-4 text-blue-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Price */}
        <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          От <span className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>${plan.monthlyPrice}</span>/мес
        </p>

        {/* CTA button */}
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-all"
        >
          Перейти на {plan.name}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
