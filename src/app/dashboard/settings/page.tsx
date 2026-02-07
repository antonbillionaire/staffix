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
} from "lucide-react";

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

  // Notification settings
  const [notifications, setNotifications] = useState({
    newBookings: true,
    cancellations: true,
    lowMessages: true,
    trialEnding: true,
  });
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsSaved, setNotificationsSaved] = useState(false);

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
        </div>
      )}
    </div>
  );
}
