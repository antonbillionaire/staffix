"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import UpgradePrompt from "@/components/UpgradePrompt";
import {
  Bell,
  Star,
  UserCheck,
  Loader2,
  Save,
  Clock,
  MessageSquare,
  Gift,
  ExternalLink,
  CheckCircle,
  Info,
  ShoppingBag,
} from "lucide-react";

interface AutomationSettings {
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reviewEnabled: boolean;
  reviewDelayHours: number;
  reviewGoogleLink: string;
  review2gisLink: string;
  reviewYandexLink: string;
  reactivationEnabled: boolean;
  reactivationDays: number;
  reactivationDiscount: number;
}

interface Stats {
  remindersSent: number;
  reviewsCollected: number;
  clientsReactivated: number;
}

export default function AutomationPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const { canUseAutomations, needsUpgrade, loading: subscriptionLoading } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings>({
    reminder24hEnabled: true,
    reminder2hEnabled: true,
    reviewEnabled: true,
    reviewDelayHours: 2,
    reviewGoogleLink: "",
    review2gisLink: "",
    reviewYandexLink: "",
    reactivationEnabled: true,
    reactivationDays: 30,
    reactivationDiscount: 10,
  });
  const [stats, setStats] = useState<Stats>({
    remindersSent: 0,
    reviewsCollected: 0,
    clientsReactivated: 0,
  });
  const [successMessage, setSuccessMessage] = useState("");

  // Theme classes
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/automation/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSuccessMessage(t("automation.settingsSaved"));
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Show upgrade prompt if trial expired or no access
  if (!canUseAutomations || needsUpgrade) {
    return (
      <UpgradePrompt
        feature="Автоматизация"
        description={needsUpgrade
          ? "Ваш пробный период закончился. Оформите подписку Pro чтобы продолжить использовать автоматизации."
          : "Автоматические напоминания о записях, сбор отзывов и реактивация клиентов доступны в платных тарифах."
        }
        requiredPlan="pro"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>{t("automation.title")}</h1>
          <p className={textSecondary}>
            {t("automation.description")}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t("common.save")}
        </button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Bell className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.remindersSent}</p>
              <p className={`text-sm ${textSecondary}`}>{t("automation.remindersSent")}</p>
            </div>
          </div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.reviewsCollected}</p>
              <p className={`text-sm ${textSecondary}`}>{t("automation.reviewsCollected")}</p>
            </div>
          </div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.clientsReactivated}</p>
              <p className={`text-sm ${textSecondary}`}>{t("automation.clientsReactivated")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reminders Section */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>{t("automation.appointmentReminders")}</h2>
            <p className={`text-sm ${textSecondary}`}>{t("automation.remindersDesc")}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* 24h reminder */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-400" />
              <div>
                <p className={`font-medium ${textPrimary}`}>{t("automation.24hours")}</p>
                <p className={`text-sm ${textSecondary}`}>{t("automation.24hoursDesc")}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reminder24hEnabled}
                onChange={(e) => setSettings({ ...settings, reminder24hEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 2h reminder */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-purple-400" />
              <div>
                <p className={`font-medium ${textPrimary}`}>{t("automation.2hours")}</p>
                <p className={`text-sm ${textSecondary}`}>{t("automation.2hoursDesc")}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reminder2hEnabled}
                onChange={(e) => setSettings({ ...settings, reminder2hEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Preview */}
          <div className={`p-4 rounded-xl border ${isDark ? "border-blue-500/20 bg-blue-500/5" : "border-blue-200 bg-blue-50"}`}>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5" />
              <div className={`text-sm ${textSecondary}`}>
                <p className="font-medium text-blue-400 mb-1">{t("automation.messageExample")}</p>
                <p className="italic">
                  "Здравствуйте, Анна! 👋 Напоминаем о вашей записи: 📅 Завтра, 15 февраля в 14:00 💇 Стрижка женская. Ждём вас!"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
            <Star className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>{t("automation.reviewCollection")}</h2>
            <p className={`text-sm ${textSecondary}`}>{t("automation.reviewDesc")}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable reviews */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-yellow-400" />
              <div>
                <p className={`font-medium ${textPrimary}`}>{t("automation.requestReviews")}</p>
                <p className={`text-sm ${textSecondary}`}>{t("automation.sendAfterVisit")}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reviewEnabled}
                onChange={(e) => setSettings({ ...settings, reviewEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
            </label>
          </div>

          {settings.reviewEnabled && (
            <>
              {/* Delay hours */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                  {t("automation.delayHours")}
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={settings.reviewDelayHours}
                  onChange={(e) => setSettings({ ...settings, reviewDelayHours: parseInt(e.target.value) || 2 })}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>
                  {t("automation.recommended24")}
                </p>
              </div>

              {/* Google link */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                  {t("automation.googleLink")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settings.reviewGoogleLink}
                    onChange={(e) => setSettings({ ...settings, reviewGoogleLink: e.target.value })}
                    placeholder="https://maps.google.com/..."
                    className={`flex-1 px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {settings.reviewGoogleLink && (
                    <a
                      href={settings.reviewGoogleLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <ExternalLink className="h-5 w-5 text-gray-400" />
                    </a>
                  )}
                </div>
                <p className={`text-xs ${textSecondary} mt-2`}>
                  Найдите свой бизнес на Google Maps → скопируйте URL из адресной строки → вставьте сюда
                </p>
              </div>

              {/* 2GIS link */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                  {t("automation.2gisLink")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settings.review2gisLink}
                    onChange={(e) => setSettings({ ...settings, review2gisLink: e.target.value })}
                    placeholder="https://2gis.uz/..."
                    className={`flex-1 px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {settings.review2gisLink && (
                    <a
                      href={settings.review2gisLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <ExternalLink className="h-5 w-5 text-gray-400" />
                    </a>
                  )}
                </div>
                <p className={`text-xs ${textSecondary} mt-2`}>
                  Найдите свой бизнес в 2GIS → скопируйте URL страницы → вставьте сюда
                </p>
              </div>

              {/* Yandex Maps link */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                  Яндекс.Карты (ссылка на отзывы)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={settings.reviewYandexLink}
                    onChange={(e) => setSettings({ ...settings, reviewYandexLink: e.target.value })}
                    placeholder="https://yandex.ru/maps/org/..."
                    className={`flex-1 px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  {settings.reviewYandexLink && (
                    <a
                      href={settings.reviewYandexLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <ExternalLink className="h-5 w-5 text-gray-400" />
                    </a>
                  )}
                </div>
                <p className={`text-xs ${textSecondary} mt-2`}>
                  Найдите свой бизнес на Яндекс.Картах → скопируйте URL страницы → вставьте сюда
                </p>
              </div>
            </>
          )}

          {/* How it works */}
          <div className={`p-4 rounded-xl border ${isDark ? "border-yellow-500/20 bg-yellow-500/5" : "border-yellow-200 bg-yellow-50"}`}>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-yellow-400 mt-0.5" />
              <div className={`text-sm ${textSecondary}`}>
                <p className="font-medium text-yellow-400 mb-1">{t("automation.howItWorks")}</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Клиент получает сообщение с просьбой оценить визит (1-5 ⭐)</li>
                  <li>Оценки 4-5: предлагаем оставить отзыв на Google/2GIS/Яндекс.Карты</li>
                  <li>Оценки 1-3: просим описать проблему (негатив не уходит в публику!)</li>
                  <li>Вы получаете уведомление о каждом отзыве</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reactivation Section */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>{t("automation.clientReactivation")}</h2>
            <p className={`text-sm ${textSecondary}`}>{t("automation.reactivationDesc")}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable reactivation */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-green-400" />
              <div>
                <p className={`font-medium ${textPrimary}`}>{t("automation.discountReactivation")}</p>
                <p className={`text-sm ${textSecondary}`}>{t("automation.sendDiscountOffer")}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reactivationEnabled}
                onChange={(e) => setSettings({ ...settings, reactivationEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {settings.reactivationEnabled && (
            <>
              {/* Days */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                  {t("automation.daysWithoutVisit")}
                </label>
                <input
                  type="number"
                  min="14"
                  max="180"
                  value={settings.reactivationDays}
                  onChange={(e) => setSettings({ ...settings, reactivationDays: parseInt(e.target.value) || 30 })}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>
                  {t("automation.daysWithoutVisitDesc")}
                </p>
              </div>

              {/* Discount */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                  {t("automation.discountSize")}
                </label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={settings.reactivationDiscount}
                  onChange={(e) => setSettings({ ...settings, reactivationDiscount: parseInt(e.target.value) || 10 })}
                  className={`w-full px-4 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>
                  {t("automation.discountForInactive")}
                </p>
              </div>
            </>
          )}

          {/* Preview */}
          <div className={`p-4 rounded-xl border ${isDark ? "border-green-500/20 bg-green-500/5" : "border-green-200 bg-green-50"}`}>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-green-400 mt-0.5" />
              <div className={`text-sm ${textSecondary}`}>
                <p className="font-medium text-green-400 mb-1">Пример сообщения:</p>
                <p className="italic">
                  "Привет, Анна! Давно вас не видели! 💜 Мы скучаем! Вот вам скидка {settings.reactivationDiscount}% на следующий визит. Промокод: WELCOME{settings.reactivationDiscount}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Automations */}
      <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <ShoppingBag className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h3 className={`font-semibold ${textPrimary}`}>Уведомления о заказах</h3>
            <p className={`text-sm ${textSecondary}`}>Автоматические уведомления клиентам при смене статуса заказа</p>
          </div>
          <div className="ml-auto">
            <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full font-medium">Активно</span>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {[
            { status: "Подтверждён", emoji: "✅", desc: "Заказ принят и подтверждён" },
            { status: "В обработке", emoji: "⚙️", desc: "Идёт сборка / обработка заказа" },
            { status: "Отправлен", emoji: "🚚", desc: "Заказ передан в доставку" },
            { status: "Доставлен", emoji: "🎉", desc: "Клиент получил заказ" },
            { status: "Отменён", emoji: "❌", desc: "Заказ отменён" },
          ].map((item) => (
            <div key={item.status} className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
              <span className="text-lg">{item.emoji}</span>
              <div className="flex-1">
                <span className={`text-sm font-medium ${textPrimary}`}>{item.status}</span>
                <span className={`text-xs ml-2 ${textSecondary}`}>— {item.desc}</span>
              </div>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </div>
          ))}
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? "border-green-500/20 bg-green-500/5" : "border-green-200 bg-green-50"}`}>
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div className={`text-sm ${textSecondary}`}>
              <p className="font-medium text-green-400 mb-1">Как это работает:</p>
              <p>
                Когда вы меняете статус заказа в разделе{" "}
                <span className="font-medium">Заказы</span>, клиент автоматически получает
                Telegram-уведомление с актуальным статусом. Никаких настроек не требуется — всё работает сразу.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
