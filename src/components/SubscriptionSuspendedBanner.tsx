"use client";

import Link from "next/link";
import { AlertTriangle, CreditCard } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Красный баннер для подписок в статусе "suspended" — это значит PayPro не смог
 * списать оплату (карта истекла / нет средств / 3DS не пройден). Сервис работает
 * пока не упрётся в expiresAt, но клиенту нужно срочно обновить карту.
 *
 * Раньше этот статус обрабатывался только серверной логикой (блокировка webhook'ов
 * через checkSubscriptionLimit), а клиент не понимал почему всё внезапно остановилось.
 */
export default function SubscriptionSuspendedBanner() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  return (
    <div
      className={`mx-4 md:mx-8 mt-4 p-5 rounded-xl border ${
        isDark
          ? "bg-red-500/10 border-red-500/40"
          : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4">
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
              {t("suspendedBanner.title")}
            </h3>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {t("suspendedBanner.description")}
            </p>
          </div>
        </div>

        <div className="flex md:flex-shrink-0">
          <Link
            href="/dashboard/settings"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors text-sm"
          >
            <CreditCard className="h-4 w-4" />
            {t("suspendedBanner.button")}
          </Link>
        </div>
      </div>
    </div>
  );
}
