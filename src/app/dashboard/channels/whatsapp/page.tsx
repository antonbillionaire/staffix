"use client";

import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Save,
  ChevronDown,
  Clock,
  Users,
  TrendingUp,
  Zap,
  Shield,
  Phone,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

// WhatsApp icon (custom)
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function WhatsAppChannelPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState("");
  const [waSettings, setWaSettings] = useState({
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    active: false,
  });
  const [savingWa, setSavingWa] = useState(false);
  const [waSaved, setWaSaved] = useState(false);
  const [waError, setWaError] = useState("");

  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          if (data.business) {
            setBusinessId(data.business.id || "");
            setWaSettings({
              phoneNumberId: data.business.waPhoneNumberId || "",
              accessToken: "",
              verifyToken: data.business.waVerifyToken || "",
              active: data.business.waActive || false,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSaveWa = async () => {
    setSavingWa(true);
    setWaError("");
    try {
      const body: Record<string, unknown> = {
        waPhoneNumberId: waSettings.phoneNumberId,
        waVerifyToken: waSettings.verifyToken,
        waActive: waSettings.active,
      };
      if (waSettings.accessToken) body.waAccessToken = waSettings.accessToken;

      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка сохранения");
      }
      setWaSaved(true);
      setTimeout(() => setWaSaved(false), 3000);
    } catch (err) {
      setWaError(err instanceof Error ? err.message : "Ошибка сохранения настроек WhatsApp");
    }
    setSavingWa(false);
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
          {waSettings.active && (
            <span className="ml-2 flex items-center gap-1.5 text-sm text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Активен
            </span>
          )}
        </div>
        <p className={textSecondary}>
          Подключите WhatsApp Business API для автоматических ответов клиентам
        </p>
      </div>

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

      {/* Settings */}
      <div className={`${cardBg} rounded-xl border ${borderColor} p-6 space-y-4`}>
        <h3 className={`text-lg font-semibold ${textPrimary}`}>Настройки WhatsApp Business API</h3>

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
                value={`https://staffix.io/api/whatsapp/webhook?businessId=${businessId}`}
                className={`flex-1 ${isDark ? "bg-white/5 border-white/10 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600"} border rounded-xl px-4 py-2.5 text-sm focus:outline-none`}
              />
              <button
                onClick={() => navigator.clipboard.writeText(`https://staffix.io/api/whatsapp/webhook?businessId=${businessId}`)}
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
            value={waSettings.phoneNumberId}
            onChange={(e) => setWaSettings({ ...waSettings, phoneNumberId: e.target.value })}
            placeholder="1234567890123456"
            className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50`}
          />
        </div>
        <div>
          <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1.5`}>Access Token</label>
          <input
            type="password"
            value={waSettings.accessToken}
            onChange={(e) => setWaSettings({ ...waSettings, accessToken: e.target.value })}
            placeholder="EAAxxxxxxxx..."
            className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50`}
          />
          <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"} mt-1`}>Токен уже сохранён (показан как ***). Введите новый только если хотите обновить.</p>
        </div>
        <div>
          <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1.5`}>Verify Token (придумайте сами)</label>
          <input
            type="text"
            value={waSettings.verifyToken}
            onChange={(e) => setWaSettings({ ...waSettings, verifyToken: e.target.value })}
            placeholder="my_secret_token_2025"
            className={`w-full ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50`}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={waSettings.active}
              onChange={(e) => setWaSettings({ ...waSettings, active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
          <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>Активировать WhatsApp канал</span>
        </div>

        <button
          onClick={handleSaveWa}
          disabled={savingWa}
          className="w-full bg-green-600/20 border border-green-500/30 text-green-300 py-3 px-4 rounded-xl font-medium hover:bg-green-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
        >
          {savingWa ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Сохраняем...</>
          ) : waSaved ? (
            <><Check className="h-4 w-4" /> Сохранено!</>
          ) : (
            <><Save className="h-4 w-4" /> Сохранить WhatsApp</>
          )}
        </button>
        {waError && <p className="text-red-400 text-sm mt-2">{waError}</p>}
      </div>
    </div>
  );
}
