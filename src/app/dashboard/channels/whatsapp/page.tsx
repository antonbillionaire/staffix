"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Save,
  Clock,
  Users,
  TrendingUp,
  Zap,
  Shield,
  Phone,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Unplug,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

// Extend Window for Facebook SDK
declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>
      ) => void;
    };
  }
}

// WhatsApp icon (custom)
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function WhatsAppChannelPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState("");
  const [connected, setConnected] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [showManualSetup, setShowManualSetup] = useState(false);

  // Phone selection state
  const [phones, setPhones] = useState<
    Array<{ phoneId: string; phoneNumber: string; verifiedName: string; wabaName: string }>
  >([]);
  const [selectingPhone, setSelectingPhone] = useState<string | null>(null);
  const [savedCode, setSavedCode] = useState("");

  // Manual setup state
  const [manualSettings, setManualSettings] = useState({
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    active: false,
  });
  const [savingManual, setSavingManual] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);

  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_WA_EMBEDDED_SIGNUP_CONFIG_ID;

  // Load business data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          if (data.business) {
            setBusinessId(data.business.id || "");
            setConnected(!!data.business.waActive && !!data.business.waPhoneNumberId);
            setPhoneNumber(data.business.waPhoneNumberId || "");
            setManualSettings({
              phoneNumberId: data.business.waPhoneNumberId || "",
              accessToken: "",
              verifyToken: data.business.waVerifyToken || "",
              active: data.business.waActive || false,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Load Facebook SDK
  useEffect(() => {
    if (!metaAppId) return;

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: metaAppId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v21.0",
      });
      setSdkLoaded(true);
    };

    // Check if SDK is already loaded
    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);

    return () => {
      // Cleanup not needed for FB SDK
    };
  }, [metaAppId]);

  // Handle Embedded Signup
  const handleConnectWhatsApp = useCallback(() => {
    if (!window.FB || !configId) {
      setError("Facebook SDK не загружен. Попробуйте обновить страницу или используйте ручную настройку.");
      return;
    }

    setConnecting(true);
    setError("");

    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          const code = response.authResponse.code;
          setSavedCode(code);

          // Send code to backend
          fetch("/api/auth/whatsapp/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, businessId }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.needsSelection) {
                // Multiple phones — show selection
                setPhones(data.phones);
                setConnecting(false);
              } else if (data.success) {
                setConnected(true);
                setPhoneNumber(data.phoneNumber || "");
                setSuccess(`WhatsApp подключён! Номер: ${data.phoneNumber}`);
                setConnecting(false);
              } else {
                setError(data.error || "Ошибка подключения");
                setConnecting(false);
              }
            })
            .catch((err) => {
              setError(err.message || "Ошибка подключения");
              setConnecting(false);
            });
        } else {
          setConnecting(false);
          // User cancelled or denied
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      }
    );
  }, [configId, businessId]);

  // Handle phone selection (when multiple numbers)
  const handleSelectPhone = async (phoneId: string) => {
    setSelectingPhone(phoneId);
    setError("");
    try {
      const res = await fetch("/api/auth/whatsapp/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: savedCode, businessId, phoneNumberId: phoneId }),
      });
      const data = await res.json();
      if (data.success) {
        setConnected(true);
        setPhoneNumber(data.phoneNumber || "");
        setPhones([]);
        setSuccess(`WhatsApp подключён! Номер: ${data.phoneNumber}`);
      } else {
        setError(data.error || "Ошибка подключения");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка подключения");
    }
    setSelectingPhone(null);
  };

  // Disconnect WhatsApp
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/channels?channel=whatsapp`, { method: "DELETE" });
      if (res.ok) {
        setConnected(false);
        setPhoneNumber("");
        setSuccess("WhatsApp отключён");
      }
    } catch (err) {
      setError("Ошибка отключения");
    }
    setDisconnecting(false);
  };

  // Manual save
  const handleSaveManual = async () => {
    setSavingManual(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        waPhoneNumberId: manualSettings.phoneNumberId,
        waVerifyToken: manualSettings.verifyToken,
        waActive: manualSettings.active,
      };
      if (manualSettings.accessToken) body.waAccessToken = manualSettings.accessToken;

      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка сохранения");
      }
      setManualSaved(true);
      setConnected(manualSettings.active && !!manualSettings.phoneNumberId);
      setTimeout(() => setManualSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    }
    setSavingManual(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
            <WhatsAppIcon className="h-5 w-5 text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>WhatsApp</h1>
          {connected && (
            <span className="ml-2 flex items-center gap-1.5 text-sm text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Подключён
            </span>
          )}
        </div>
        <p className={textSecondary}>
          Подключите WhatsApp Business для автоматических ответов клиентам
        </p>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {/* Connected state */}
      {connected && (
        <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <WhatsAppIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>WhatsApp подключён</h3>
                <p className={`text-sm ${textSecondary}`}>
                  Phone Number ID: {phoneNumber}
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Отключить
            </button>
          </div>
        </div>
      )}

      {/* Phone selection (multiple numbers) */}
      {phones.length > 0 && (
        <div className={`${cardBg} border ${borderColor} rounded-xl p-6 space-y-4`}>
          <h3 className={`text-lg font-semibold ${textPrimary}`}>
            Выберите номер WhatsApp
          </h3>
          <p className={textSecondary}>
            У вас несколько номеров. Выберите, к какому подключить AI-сотрудника.
          </p>
          <div className="space-y-3">
            {phones.map((phone) => (
              <button
                key={phone.phoneId}
                onClick={() => handleSelectPhone(phone.phoneId)}
                disabled={!!selectingPhone}
                className={`w-full text-left ${cardBg} border ${
                  selectingPhone === phone.phoneId
                    ? "border-green-500 ring-2 ring-green-500/30"
                    : `${borderColor} hover:border-green-500/50`
                } rounded-xl p-5 transition-all ${
                  selectingPhone && selectingPhone !== phone.phoneId ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className={`font-semibold ${textPrimary}`}>
                        {phone.phoneNumber}
                      </h4>
                      <p className={`text-sm ${textSecondary}`}>
                        {phone.verifiedName} — {phone.wabaName}
                      </p>
                    </div>
                  </div>
                  {selectingPhone === phone.phoneId ? (
                    <Loader2 className="h-5 w-5 animate-spin text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-green-600 to-emerald-600 text-white flex-shrink-0">
                      Выбрать
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Connect button (not connected, no phone selection) */}
      {!connected && phones.length === 0 && (
        <>
          {/* Benefits */}
          <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
              Преимущества WhatsApp для бизнеса
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Phone, color: "text-green-400", bg: "bg-green-500/20", title: "Личный контакт", desc: "WhatsApp — самый личный канал. Клиенты отвечают охотнее" },
                { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/20", title: "Мгновенные ответы", desc: "AI отвечает за секунды — клиент не уходит к конкуренту" },
                { icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/20", title: "98% открываемость", desc: "Сообщения в WhatsApp читают в 5 раз чаще чем email" },
                { icon: Shield, color: "text-yellow-400", bg: "bg-yellow-500/20", title: "Верифицированный бизнес", desc: "Официальный бизнес-аккаунт вызывает доверие у клиентов" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className={`w-10 h-10 ${item.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <h4 className={`font-medium ${textPrimary} mb-0.5`}>{item.title}</h4>
                    <p className={`text-sm ${textSecondary}`}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connect via Embedded Signup */}
          {configId && (
            <div className={`${cardBg} border ${borderColor} rounded-xl p-6 text-center space-y-4`}>
              <h3 className={`text-lg font-semibold ${textPrimary}`}>
                Подключить WhatsApp в один клик
              </h3>
              <p className={textSecondary}>
                Авторизуйтесь через Facebook — мы автоматически подключим ваш WhatsApp Business
              </p>
              <button
                onClick={handleConnectWhatsApp}
                disabled={connecting || !sdkLoaded}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 transition-all shadow-lg shadow-green-500/20"
              >
                {connecting ? (
                  <><Loader2 className="h-6 w-6 animate-spin" /> Подключаем...</>
                ) : (
                  <><WhatsAppIcon className="h-6 w-6" /> Подключить WhatsApp</>
                )}
              </button>
              {!sdkLoaded && metaAppId && (
                <p className={`text-xs ${textSecondary}`}>Загрузка Facebook SDK...</p>
              )}
            </div>
          )}

          {/* Manual setup (fallback) */}
          <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
            <button
              onClick={() => setShowManualSetup(!showManualSetup)}
              className={`w-full flex items-center justify-between p-4 ${textSecondary} hover:${isDark ? "bg-white/5" : "bg-gray-50"} transition-colors`}
            >
              <span className="text-sm font-medium">
                {configId ? "Расширенная настройка (вручную)" : "Настройка WhatsApp Business API"}
              </span>
              {showManualSetup ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {(showManualSetup || !configId) && (
              <div className="p-6 pt-0 space-y-4">
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700 space-y-2">
                  <p className="font-semibold text-gray-900">Пошаговая инструкция:</p>
                  <div className="space-y-1.5">
                    <p><span className="font-semibold text-gray-900">Шаг 1.</span> Купите отдельную симкарту — номер не должен быть зарегистрирован в WhatsApp</p>
                    <p><span className="font-semibold text-gray-900">Шаг 2.</span> Установите WhatsApp Business, зарегистрируйте эту симку (получите SMS-код)</p>
                    <p><span className="font-semibold text-gray-900">Шаг 3.</span> Откройте <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="underline text-blue-600 hover:text-blue-700">developers.facebook.com</a> → ваше приложение → WhatsApp → API Setup → скопируйте <strong className="text-gray-900">Phone Number ID</strong> и <strong className="text-gray-900">Access Token</strong></p>
                    <p><span className="font-semibold text-gray-900">Шаг 4.</span> Вставьте данные в поля ниже → придумайте Verify Token → нажмите Сохранить → скопируйте Webhook URL</p>
                    <p><span className="font-semibold text-gray-900">Шаг 5.</span> Вернитесь в Meta Developers → WhatsApp → Configuration → вставьте Webhook URL и Verify Token → выберите событие <strong className="text-gray-900">messages</strong> → Verify and Save</p>
                    <p><span className="font-semibold text-gray-900">Шаг 6.</span> Включите тоггл «Активировать WhatsApp» → Сохранить</p>
                  </div>
                  <p className="text-xs text-gray-500 pt-1">Не получается? Напишите в <a href="/dashboard/support" className="underline text-blue-600 hover:text-blue-700">поддержку</a> — поможем за 15 минут</p>
                </div>

                {/* Webhook URL */}
                {businessId && (
                  <div>
                    <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1.5`}>Webhook URL (скопируйте в Meta)</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={`https://staffix.io/api/whatsapp/webhook`}
                        className={`flex-1 ${isDark ? "bg-white/5 border-white/10 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600"} border rounded-xl px-4 py-2.5 text-sm focus:outline-none`}
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(`https://staffix.io/api/whatsapp/webhook`)}
                        className={`px-3 ${isDark ? "bg-white/10 hover:bg-white/20 border-white/10" : "bg-gray-100 hover:bg-gray-200 border-gray-200"} border rounded-xl transition-colors`}
                      >
                        <Copy className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1.5`}>Phone Number ID</label>
                  <input
                    type="text"
                    value={manualSettings.phoneNumberId}
                    onChange={(e) => setManualSettings({ ...manualSettings, phoneNumberId: e.target.value })}
                    placeholder="1234567890123456"
                    className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1.5`}>Access Token</label>
                  <input
                    type="password"
                    value={manualSettings.accessToken}
                    onChange={(e) => setManualSettings({ ...manualSettings, accessToken: e.target.value })}
                    placeholder="EAAxxxxxxxx..."
                    className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50`}
                  />
                  <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"} mt-1`}>Введите новый только если хотите обновить.</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1.5`}>Verify Token (придумайте сами)</label>
                  <input
                    type="text"
                    value={manualSettings.verifyToken}
                    onChange={(e) => setManualSettings({ ...manualSettings, verifyToken: e.target.value })}
                    placeholder="my_secret_token_2025"
                    className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50`}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualSettings.active}
                      onChange={(e) => setManualSettings({ ...manualSettings, active: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                  </label>
                  <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>Активировать WhatsApp канал</span>
                </div>

                <button
                  onClick={handleSaveManual}
                  disabled={savingManual}
                  className="w-full bg-green-600/20 border border-green-500/30 text-green-300 py-3 px-4 rounded-xl font-medium hover:bg-green-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {savingManual ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Сохраняем...</>
                  ) : manualSaved ? (
                    <><Check className="h-4 w-4" /> Сохранено!</>
                  ) : (
                    <><Save className="h-4 w-4" /> Сохранить</>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
