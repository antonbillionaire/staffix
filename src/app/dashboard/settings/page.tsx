"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import {
  User,
  CreditCard,
  Bell,
  Palette,
  Sun,
  Moon,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  XCircle,
  RefreshCw,
  Calendar,
  Clock,
  Lock,
  Truck,
  Eye,
  EyeOff,
} from "lucide-react";
import { TIMEZONES } from "@/lib/timezones";

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Profile form state
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
  });

  // Business timezone
  const [timezone, setTimezone] = useState("Asia/Tashkent");
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneSaved, setTimezoneSaved] = useState(false);

  // Notification settings
  const [notifications, setNotifications] = useState({
    newBookings: true,
    cancellations: true,
    lowMessages: true,
    trialEnding: true,
  });
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsSaved, setNotificationsSaved] = useState(false);

  // Owner Telegram for notifications
  const [ownerTelegram, setOwnerTelegram] = useState("");
  const [ownerTelegramConnected, setOwnerTelegramConnected] = useState(false);
  const [ownerTelegramSaving, setOwnerTelegramSaving] = useState(false);
  const [ownerTelegramSaved, setOwnerTelegramSaved] = useState(false);

  // Subscription info
  const [subscription, setSubscription] = useState({
    plan: "trial",
    status: "active",
    messagesUsed: 0,
    messagesLimit: 100,
    daysLeft: 14,
    expiresAt: "",
    payproSubscriptionId: null as string | null,
  });
  const [subscriptionAction, setSubscriptionAction] = useState<"cancel" | "resume" | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  // Password change
  const [passwordData, setPasswordData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Delivery settings
  const [delivery, setDelivery] = useState({
    enabled: false,
    timeFrom: "",
    timeTo: "",
    fee: "",
    freeFrom: "",
    zones: "",
  });
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySaved, setDeliverySaved] = useState(false);

  // Theme-based classes
  const isDark = theme === "dark";
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  // Load user data
  useEffect(() => {
    const loadData = async () => {
      if (session?.user) {
        setProfileData({
          name: session.user.name || "",
          email: session.user.email || "",
        });
      }

      // Load user settings from API
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setNotifications({
              newBookings: data.settings.notifyNewBookings ?? true,
              cancellations: data.settings.notifyCancellations ?? true,
              lowMessages: data.settings.notifyLowMessages ?? true,
              trialEnding: data.settings.notifyTrialEnding ?? true,
            });
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }

      // Load business timezone + owner telegram
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          if (data.business?.timezone) {
            setTimezone(data.business.timezone);
          }
          if (data.business?.ownerTelegramUsername) {
            setOwnerTelegram(data.business.ownerTelegramUsername);
          }
          if (data.business?.ownerTelegramChatId) {
            setOwnerTelegramConnected(true);
          }
          // Delivery settings
          if (data.business) {
            setDelivery({
              enabled: data.business.deliveryEnabled || false,
              timeFrom: data.business.deliveryTimeFrom?.toString() || "",
              timeTo: data.business.deliveryTimeTo?.toString() || "",
              fee: data.business.deliveryFee?.toString() || "",
              freeFrom: data.business.deliveryFreeFrom?.toString() || "",
              zones: data.business.deliveryZones || "",
            });
          }
        }
      } catch (err) {
        console.error("Error loading business:", err);
      }

      // Load subscription info
      try {
        const res = await fetch("/api/subscription/manage");
        if (res.ok) {
          const data = await res.json();
          if (data.subscription) {
            const sub = data.subscription;
            setSubscription({
              plan: sub.plan,
              status: sub.status || "active",
              messagesUsed: sub.messagesUsed,
              messagesLimit: sub.messagesLimit,
              daysLeft: sub.daysLeft,
              expiresAt: sub.expiresAt,
              payproSubscriptionId: sub.payproSubscriptionId,
            });
          }
        }
      } catch (err) {
        console.error("Error loading subscription:", err);
      }
    };

    loadData();
  }, [session]);

  // Save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  // Change theme and save to API
  const handleThemeChange = async (newTheme: "dark" | "light") => {
    setTheme(newTheme);

    // Save to database
    try {
      await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (err) {
      console.error("Error saving theme:", err);
    }
  };

  // Save timezone
  const handleSaveTimezone = async (tz: string) => {
    setTimezone(tz);
    setTimezoneSaving(true);
    setTimezoneSaved(false);

    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: tz }),
      });

      if (!res.ok) throw new Error("Ошибка сохранения");

      setTimezoneSaved(true);
      setTimeout(() => setTimezoneSaved(false), 3000);
    } catch (err) {
      console.error("Error saving timezone:", err);
    } finally {
      setTimezoneSaving(false);
    }
  };

  // Save notification settings
  const handleSaveNotifications = async () => {
    setNotificationsSaving(true);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyNewBookings: notifications.newBookings,
          notifyCancellations: notifications.cancellations,
          notifyLowMessages: notifications.lowMessages,
          notifyTrialEnding: notifications.trialEnding,
        }),
      });

      if (!res.ok) throw new Error("Ошибка сохранения");

      setNotificationsSaved(true);
      setTimeout(() => setNotificationsSaved(false), 3000);
    } catch (err) {
      console.error("Error saving notifications:", err);
    } finally {
      setNotificationsSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordMessage("");
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Пароли не совпадают");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordError("Минимум 8 символов");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPasswordMessage("Пароль успешно изменён");
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPasswordSaving(false);
    }
  };

  // Save delivery settings
  const handleSaveDelivery = async () => {
    setDeliverySaving(true);
    setDeliverySaved(false);
    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryEnabled: delivery.enabled,
          deliveryTimeFrom: delivery.timeFrom,
          deliveryTimeTo: delivery.timeTo,
          deliveryFee: delivery.fee,
          deliveryFreeFrom: delivery.freeFrom,
          deliveryZones: delivery.zones,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      setDeliverySaved(true);
      setTimeout(() => setDeliverySaved(false), 3000);
    } catch (err) {
      console.error("Error saving delivery:", err);
    } finally {
      setDeliverySaving(false);
    }
  };

  // Navigate to pricing
  const handleChoosePlan = () => {
    router.push("/pricing");
  };

  // Cancel subscription
  const handleCancelSubscription = async () => {
    if (!confirm("Вы уверены, что хотите отменить подписку? Вы сможете пользоваться услугами до конца оплаченного периода.")) {
      return;
    }

    setSubscriptionLoading(true);
    setSubscriptionMessage("");

    try {
      const res = await fetch("/api/subscription/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка отмены подписки");
      }

      setSubscription({ ...subscription, status: "cancelled" });
      setSubscriptionMessage(data.message);
    } catch (err) {
      setSubscriptionMessage(err instanceof Error ? err.message : "Ошибка отмены подписки");
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Resume subscription
  const handleResumeSubscription = async () => {
    setSubscriptionLoading(true);
    setSubscriptionMessage("");

    try {
      const res = await fetch("/api/subscription/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка возобновления подписки");
      }

      setSubscription({ ...subscription, status: "active" });
      setSubscriptionMessage(data.message);
    } catch (err) {
      setSubscriptionMessage(err instanceof Error ? err.message : "Ошибка возобновления подписки");
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Профиль", icon: User },
    { id: "security", label: "Безопасность", icon: Lock },
    { id: "delivery", label: "Доставка", icon: Truck },
    { id: "theme", label: "Тема", icon: Palette },
    { id: "subscription", label: "Подписка", icon: CreditCard },
    { id: "notifications", label: "Уведомления", icon: Bell },
  ];

  const messagesRemaining = subscription.messagesLimit - subscription.messagesUsed;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className={`text-xl font-semibold ${textPrimary}`}>Настройки</h2>
        <p className={`text-sm ${textSecondary}`}>
          Управление аккаунтом и подпиской
        </p>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 mb-6 border-b ${borderColor} overflow-x-auto`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-500"
                : `border-transparent ${textSecondary} hover:${textPrimary}`
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>Данные профиля</h3>

          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {saved && (
            <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <Check className="h-4 w-4" />
              Профиль успешно сохранён
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                Имя
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="Ваше имя"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                Email
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                placeholder="email@example.com"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Сохранено
                </>
              ) : (
                "Сохранить"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Timezone section - visible in Profile tab */}
      {activeTab === "profile" && (
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6 mt-4`}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-blue-500" />
            <h3 className={`text-lg font-medium ${textPrimary}`}>Часовой пояс</h3>
            {timezoneSaved && (
              <span className="text-green-500 text-sm flex items-center gap-1">
                <Check className="h-3 w-3" /> Сохранено
              </span>
            )}
            {timezoneSaving && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
          </div>
          <p className={`text-sm ${textSecondary} mb-4`}>
            Используется для расчёта времени записей и отправки напоминаний
          </p>
          <select
            value={timezone}
            onChange={(e) => handleSaveTimezone(e.target.value)}
            className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Security Tab — Change Password */}
      {activeTab === "security" && (
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-blue-500" />
            <h3 className={`text-lg font-medium ${textPrimary}`}>Смена пароля</h3>
          </div>

          {passwordError && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {passwordError}
            </div>
          )}
          {passwordMessage && (
            <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <Check className="h-4 w-4" /> {passwordMessage}
            </div>
          )}

          <div className="space-y-4 max-w-md">
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Текущий пароль</label>
              <div className="relative">
                <input
                  type={showOldPw ? "text" : "password"}
                  value={passwordData.oldPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12`}
                  placeholder="Текущий пароль"
                />
                <button type="button" onClick={() => setShowOldPw(!showOldPw)} className={`absolute inset-y-0 right-0 pr-4 flex items-center ${textSecondary}`}>
                  {showOldPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Новый пароль</label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12`}
                  placeholder="Минимум 8 символов"
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className={`absolute inset-y-0 right-0 pr-4 flex items-center ${textSecondary}`}>
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Подтвердите пароль</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Повторите новый пароль"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving || !passwordData.newPassword}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {passwordSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Сохранение...</> : "Сменить пароль"}
            </button>
          </div>
        </div>
      )}

      {/* Delivery Tab */}
      {activeTab === "delivery" && (
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-5 w-5 text-blue-500" />
            <h3 className={`text-lg font-medium ${textPrimary}`}>Настройки доставки</h3>
            {deliverySaved && <span className="text-green-500 text-sm flex items-center gap-1"><Check className="h-3 w-3" /> Сохранено</span>}
          </div>
          <p className={`text-sm ${textSecondary} mb-6`}>
            AI-бот будет сообщать клиентам информацию о доставке
          </p>

          <div className="space-y-4 max-w-lg">
            {/* Enable toggle */}
            <label className={`flex items-center justify-between p-4 ${isDark ? "bg-white/5" : "bg-gray-50"} rounded-xl cursor-pointer`}>
              <div>
                <p className={`font-medium ${textPrimary}`}>Доставка включена</p>
                <p className={`text-sm ${textSecondary}`}>Показывать информацию о доставке клиентам</p>
              </div>
              <button
                type="button"
                onClick={() => setDelivery({ ...delivery, enabled: !delivery.enabled })}
                className={`relative w-11 h-6 rounded-full transition-colors ${delivery.enabled ? "bg-blue-600" : isDark ? "bg-white/10" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${delivery.enabled ? "translate-x-5" : ""}`} />
              </button>
            </label>

            {delivery.enabled && (
              <>
                {/* Time range */}
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Время доставки (минуты)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      value={delivery.timeFrom}
                      onChange={(e) => setDelivery({ ...delivery, timeFrom: e.target.value })}
                      placeholder="30"
                      className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    <span className={textSecondary}>—</span>
                    <input
                      type="number"
                      min="0"
                      value={delivery.timeTo}
                      onChange={(e) => setDelivery({ ...delivery, timeTo: e.target.value })}
                      placeholder="60"
                      className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    <span className={`text-sm ${textSecondary}`}>мин</span>
                  </div>
                </div>

                {/* Delivery fee */}
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Стоимость доставки</label>
                  <input
                    type="number"
                    min="0"
                    value={delivery.fee}
                    onChange={(e) => setDelivery({ ...delivery, fee: e.target.value })}
                    placeholder="0 — бесплатная"
                    className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                {/* Free from */}
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Бесплатная доставка от суммы</label>
                  <input
                    type="number"
                    min="0"
                    value={delivery.freeFrom}
                    onChange={(e) => setDelivery({ ...delivery, freeFrom: e.target.value })}
                    placeholder="Оставьте пустым если не применимо"
                    className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                {/* Zones */}
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Зоны доставки (необязательно)</label>
                  <textarea
                    rows={3}
                    value={delivery.zones}
                    onChange={(e) => setDelivery({ ...delivery, zones: e.target.value })}
                    placeholder="Например: Центр — 30 мин, Окраины — 60 мин"
                    className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </>
            )}

            <button
              onClick={handleSaveDelivery}
              disabled={deliverySaving}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {deliverySaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Сохранение...</> : "Сохранить"}
            </button>
          </div>
        </div>
      )}

      {/* Theme Tab */}
      {activeTab === "theme" && (
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>Выбор темы</h3>
          <p className={`text-sm ${textSecondary} mb-6`}>
            Выберите предпочитаемую тему оформления
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleThemeChange("dark")}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === "dark"
                  ? "border-blue-500 bg-blue-500/10"
                  : `${borderColor} hover:border-blue-500/50`
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#0a0a1a] rounded-lg flex items-center justify-center">
                  <Moon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${textPrimary}`}>Тёмная тема</p>
                  <p className={`text-xs ${textSecondary}`}>Рекомендуется</p>
                </div>
              </div>
              <div className="bg-[#0a0a1a] rounded-lg p-3 h-24">
                <div className="h-3 w-20 bg-white/10 rounded mb-2" />
                <div className="h-2 w-full bg-white/5 rounded mb-1" />
                <div className="h-2 w-3/4 bg-white/5 rounded" />
              </div>
            </button>

            <button
              onClick={() => handleThemeChange("light")}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === "light"
                  ? "border-blue-500 bg-blue-500/10"
                  : `${borderColor} hover:border-blue-500/50`
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Sun className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${textPrimary}`}>Светлая тема</p>
                  <p className={`text-xs ${textSecondary}`}>Классический вид</p>
                </div>
              </div>
              <div className="bg-gray-100 rounded-lg p-3 h-24">
                <div className="h-3 w-20 bg-gray-300 rounded mb-2" />
                <div className="h-2 w-full bg-gray-200 rounded mb-1" />
                <div className="h-2 w-3/4 bg-gray-200 rounded" />
              </div>
            </button>
          </div>

          <p className={`text-xs ${textSecondary} mt-4`}>
            Тема будет применена ко всему дашборду
          </p>
        </div>
      )}

      {/* Subscription Tab */}
      {activeTab === "subscription" && (
        <div className="space-y-4">
          {/* Message feedback */}
          {subscriptionMessage && (
            <div className={`p-4 rounded-xl flex items-center gap-2 ${
              subscriptionMessage.includes("Ошибка")
                ? "bg-red-500/10 border border-red-500/30 text-red-400"
                : "bg-green-500/10 border border-green-500/30 text-green-400"
            }`}>
              {subscriptionMessage.includes("Ошибка") ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {subscriptionMessage}
            </div>
          )}

          <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>Текущий план</h3>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${textPrimary}`}>
                    {subscription.plan === 'trial' ? 'Пробный период' :
                     subscription.plan === 'starter' ? 'Starter' :
                     subscription.plan === 'pro' ? 'Pro' :
                     subscription.plan === 'business' ? 'Business' :
                     subscription.plan === 'enterprise' ? 'Enterprise' : 'Корпоративный'}
                  </p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    subscription.status === 'active' ? 'bg-green-500/20 text-green-500' :
                    subscription.status === 'cancelled' ? 'bg-yellow-500/20 text-yellow-500' :
                    subscription.status === 'past_due' ? 'bg-red-500/20 text-red-500' :
                    subscription.status === 'expired' ? 'bg-gray-500/20 text-gray-500' :
                    'bg-yellow-500/20 text-yellow-500'
                  }`}>
                    {subscription.status === 'active' ? 'Активна' :
                     subscription.status === 'cancelled' ? 'Отменена' :
                     subscription.status === 'past_due' ? 'Просрочена' :
                     subscription.status === 'expired' ? 'Истекла' : 'Активна'}
                  </span>
                </div>
                <p className={`text-sm ${textSecondary} mt-1`}>
                  {subscription.plan === 'trial'
                    ? `Осталось ${subscription.daysLeft} дней`
                    : subscription.status === 'cancelled'
                    ? `Действует до ${new Date(subscription.expiresAt).toLocaleDateString('ru-RU')}`
                    : `Продлится ${new Date(subscription.expiresAt).toLocaleDateString('ru-RU')}`}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm ${textSecondary}`}>Использовано сообщений</p>
                <div className="flex items-center gap-2">
                  <p className={`text-xl font-medium ${textPrimary}`}>
                    {subscription.messagesUsed} / {subscription.messagesLimit}
                  </p>
                  <div className={`w-20 h-2 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, (subscription.messagesUsed / subscription.messagesLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription management buttons */}
            {subscription.payproSubscriptionId && subscription.plan !== 'trial' && (
              <div className="mt-4 pt-4 border-t border-white/10">
                {subscription.status === 'active' && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={subscriptionLoading}
                    className={`flex items-center gap-2 text-sm ${textSecondary} hover:text-red-400 transition-colors disabled:opacity-50`}
                  >
                    {subscriptionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Отменить подписку
                  </button>
                )}
                {subscription.status === 'cancelled' && (
                  <button
                    onClick={handleResumeSubscription}
                    disabled={subscriptionLoading}
                    className="flex items-center gap-2 text-sm text-green-500 hover:text-green-400 transition-colors disabled:opacity-50"
                  >
                    {subscriptionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Возобновить подписку
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Warning about messages */}
          {messagesRemaining <= 50 && (
            <div className="bg-yellow-500/10 rounded-xl border border-yellow-500/20 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">Осталось {messagesRemaining} сообщений</p>
                <p className="text-sm text-yellow-500/70">
                  Обновите план, чтобы получить больше сообщений и дополнительные функции
                </p>
              </div>
            </div>
          )}

          {/* Cancelled subscription notice */}
          {subscription.status === 'cancelled' && (
            <div className="bg-yellow-500/10 rounded-xl border border-yellow-500/20 p-4 flex items-start gap-3">
              <Calendar className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">Подписка отменена</p>
                <p className="text-sm text-yellow-500/70">
                  Вы можете пользоваться услугами до {new Date(subscription.expiresAt).toLocaleDateString('ru-RU')}.
                  После этого ваш аккаунт будет переведён на бесплатный тариф.
                </p>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <h3 className={`text-lg font-medium ${textPrimary}`}>
                {subscription.plan === 'trial' ? 'Выбрать план' : 'Обновить план'}
              </h3>
            </div>
            <p className={`text-sm ${textSecondary} mb-4`}>
              Получите безлимитные сообщения, приоритетную поддержку и расширенную аналитику
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleChoosePlan}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-all"
              >
                {subscription.plan === 'trial' ? 'Выбрать план' : 'Изменить план'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>Настройки уведомлений</h3>
          <p className={`text-sm ${textSecondary} mb-6`}>
            Выберите какие уведомления вы хотите получать
          </p>

          {notificationsSaved && (
            <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <Check className="h-4 w-4" />
              Настройки сохранены
            </div>
          )}

          <div className="space-y-4">
            <label className={`flex items-center justify-between p-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl cursor-pointer hover:opacity-80 transition-colors`}>
              <div>
                <p className={`font-medium ${textPrimary}`}>Новые записи</p>
                <p className={`text-sm ${textSecondary}`}>Уведомления о новых записях клиентов</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notifications.newBookings}
                  onChange={(e) => setNotifications({ ...notifications, newBookings: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 ${isDark ? 'bg-white/10' : 'bg-gray-300'} rounded-full peer peer-checked:bg-blue-600 transition-colors`} />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

            <label className={`flex items-center justify-between p-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl cursor-pointer hover:opacity-80 transition-colors`}>
              <div>
                <p className={`font-medium ${textPrimary}`}>Отмены записей</p>
                <p className={`text-sm ${textSecondary}`}>Уведомления когда клиент отменяет запись</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notifications.cancellations}
                  onChange={(e) => setNotifications({ ...notifications, cancellations: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 ${isDark ? 'bg-white/10' : 'bg-gray-300'} rounded-full peer peer-checked:bg-blue-600 transition-colors`} />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

            <label className={`flex items-center justify-between p-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl cursor-pointer hover:opacity-80 transition-colors`}>
              <div>
                <p className={`font-medium ${textPrimary}`}>Лимит сообщений</p>
                <p className={`text-sm ${textSecondary}`}>Предупреждение когда осталось 50 сообщений</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notifications.lowMessages}
                  onChange={(e) => setNotifications({ ...notifications, lowMessages: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 ${isDark ? 'bg-white/10' : 'bg-gray-300'} rounded-full peer peer-checked:bg-blue-600 transition-colors`} />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

            <label className={`flex items-center justify-between p-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-xl cursor-pointer hover:opacity-80 transition-colors`}>
              <div>
                <p className={`font-medium ${textPrimary}`}>Окончание пробного периода</p>
                <p className={`text-sm ${textSecondary}`}>Напоминание за 3 дня до окончания триала</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={notifications.trialEnding}
                  onChange={(e) => setNotifications({ ...notifications, trialEnding: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 ${isDark ? 'bg-white/10' : 'bg-gray-300'} rounded-full peer peer-checked:bg-blue-600 transition-colors`} />
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>
          </div>

          <button
            onClick={handleSaveNotifications}
            disabled={notificationsSaving}
            className="mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {notificationsSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              "Сохранить настройки"
            )}
          </button>

          <p className={`text-xs ${textSecondary} mt-4`}>
            Уведомления будут отправляться на ваш email ({profileData.email})
          </p>

          {/* Telegram notifications section */}
          <div className={`mt-8 pt-6 border-t ${borderColor}`}>
            <h4 className={`text-base font-medium ${textPrimary} mb-2`}>Telegram-уведомления</h4>
            <p className={`text-sm ${textSecondary} mb-4`}>
              Получайте уведомления о записях прямо в Telegram
            </p>

            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  Ваш Telegram username
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ownerTelegram}
                    onChange={(e) => setOwnerTelegram(e.target.value)}
                    placeholder="@your_username"
                    className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg} ${inputBorder} ${isDark ? "text-white placeholder-gray-500" : ""}`}
                  />
                  <button
                    onClick={async () => {
                      setOwnerTelegramSaving(true);
                      setOwnerTelegramSaved(false);
                      try {
                        const res = await fetch("/api/business", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ownerTelegramUsername: ownerTelegram }),
                        });
                        if (res.ok) {
                          setOwnerTelegramSaved(true);
                          setTimeout(() => setOwnerTelegramSaved(false), 3000);
                        }
                      } catch (err) {
                        console.error("Error saving telegram:", err);
                      } finally {
                        setOwnerTelegramSaving(false);
                      }
                    }}
                    disabled={ownerTelegramSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {ownerTelegramSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : ownerTelegramSaved ? <Check className="h-3 w-3" /> : null}
                    {ownerTelegramSaved ? "Сохранено" : "Сохранить"}
                  </button>
                </div>
              </div>

              <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                <span className={`w-2 h-2 rounded-full ${ownerTelegramConnected ? "bg-green-400" : isDark ? "bg-gray-600" : "bg-gray-400"}`} />
                <span className={`text-sm ${ownerTelegramConnected ? "text-green-400" : textSecondary}`}>
                  {ownerTelegramConnected
                    ? "Подключено — уведомления приходят в Telegram"
                    : "Не подключено — напишите /start вашему боту Staffix"}
                </span>
              </div>

              <p className={`text-xs ${textSecondary}`}>
                После сохранения username напишите /start вашему бизнес-боту в Telegram.
                Бот автоматически свяжет ваш аккаунт и начнёт отправлять уведомления.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
