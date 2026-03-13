"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  X,
  Loader2,
  Link2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

// ========================================
// ТИПЫ
// ========================================

type IntegrationType = "webhook" | "google_sheets" | "bitrix24" | "amocrm";

interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  events: string[];
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface FormField {
  key: string;
  labelKey: string;
  type: "text" | "url" | "password" | "textarea";
  required: boolean;
  placeholderKey?: string;
  placeholderFallback?: string;
}

const INTEGRATION_TYPES_CONFIG: {
  id: IntegrationType;
  label: string;
  descriptionKey: string;
  icon: string;
  fields: FormField[];
}[] = [
  {
    id: "webhook",
    label: "Universal Webhook",
    descriptionKey: "integrations.webhookDesc",
    icon: "🔗",
    fields: [
      { key: "url", labelKey: "integrations.webhookUrlLabel", type: "url", required: true, placeholderFallback: "https://hooks.zapier.com/hooks/..." },
      { key: "secret", labelKey: "integrations.webhookSecretLabel", type: "text", required: false, placeholderKey: "integrations.webhookSecretPlaceholder" },
    ],
  },
  {
    id: "bitrix24",
    label: "Bitrix24",
    descriptionKey: "integrations.bitrix24Desc",
    icon: "🏢",
    fields: [
      { key: "domain", labelKey: "integrations.bitrix24DomainLabel", type: "text", required: true, placeholderFallback: "mycompany.bitrix24.ru" },
      { key: "token", labelKey: "integrations.bitrix24TokenLabel", type: "text", required: true, placeholderKey: "integrations.bitrix24TokenPlaceholder" },
    ],
  },
  {
    id: "amocrm",
    label: "AmoCRM",
    descriptionKey: "integrations.amocrmDesc",
    icon: "💼",
    fields: [
      { key: "domain", labelKey: "integrations.amocrmDomainLabel", type: "text", required: true, placeholderKey: "integrations.amocrmDomainPlaceholder" },
      { key: "token", labelKey: "integrations.amocrmTokenLabel", type: "password", required: true, placeholderKey: "integrations.amocrmTokenPlaceholder" },
      { key: "pipelineId", labelKey: "integrations.amocrmPipelineLabel", type: "text", required: false, placeholderFallback: "123456" },
    ],
  },
  {
    id: "google_sheets",
    label: "Google Sheets",
    descriptionKey: "integrations.googleSheetsDesc",
    icon: "📊",
    fields: [
      { key: "spreadsheetId", labelKey: "integrations.sheetsIdLabel", type: "text", required: true, placeholderKey: "integrations.sheetsIdPlaceholder" },
      { key: "sheetName", labelKey: "integrations.sheetsNameLabel", type: "text", required: false, placeholderFallback: "Sheet1" },
      { key: "credentialsJson", labelKey: "integrations.sheetsCredentialsLabel", type: "textarea", required: true, placeholderFallback: '{"type":"service_account","project_id":"..."}' },
    ],
  },
];

const ALL_EVENT_IDS = ["booking_created", "booking_confirmed", "booking_cancelled", "new_client", "review_created", "message_received"];

const EVENT_LABEL_KEYS: Record<string, string> = {
  booking_created: "integrations.eventBookingCreated",
  booking_confirmed: "integrations.eventBookingConfirmed",
  booking_cancelled: "integrations.eventBookingCancelled",
  new_client: "integrations.eventNewClient",
  review_created: "integrations.eventReviewCreated",
  message_received: "integrations.eventMessageReceived",
};

// ========================================
// КОМПОНЕНТ
// ========================================

export default function IntegrationsPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; error?: string }>>({});

  // Форма
  const [selectedType, setSelectedType] = useState<IntegrationType>("webhook");
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [formEvents, setFormEvents] = useState<string[]>(["booking_created", "booking_confirmed"]);

  // Guide modal
  const [showGuide, setShowGuide] = useState<IntegrationType | null>(null);

  // Загружаем бизнес-данные
  useEffect(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((d) => {
        if (d.business?.id) {
          setBusinessId(d.business.id);
          setBusinessName(d.business.name);
        }
      })
      .catch(console.error);
  }, []);

  const fetchIntegrations = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations?businessId=${businessId}`);
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const openCreateModal = () => {
    setSelectedType("webhook");
    setFormName("");
    setFormConfig({});
    setFormEvents(["booking_created", "booking_confirmed"]);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (!businessId || !formName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          type: selectedType,
          name: formName.trim(),
          config: formConfig,
          events: formEvents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || t("integrations.createError"));
        return;
      }
      setIsModalOpen(false);
      fetchIntegrations();
    } catch (e) {
      console.error(e);
      alert(t("integrations.networkError"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/integrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchIntegrations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("integrations.deleteConfirm"))) return;
    await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    fetchIntegrations();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult((prev) => ({ ...prev, [id]: { success: false } }));
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: id }),
      });
      const data = await res.json();
      setTestResult((prev) => ({
        ...prev,
        [id]: { success: data.success, error: data.error },
      }));
      fetchIntegrations();
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: { success: false, error: t("integrations.networkError") } }));
    } finally {
      setTestingId(null);
    }
  };

  const toggleEvent = (eventId: string) => {
    setFormEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const typeInfo = INTEGRATION_TYPES_CONFIG.find((t) => t.id === selectedType)!;

  // ========================================
  // СТИЛИ
  // ========================================

  const bg = isDark ? "bg-gray-900" : "bg-gray-50";
  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500";
  const modalBg = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bg}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`${bg} min-h-screen p-6`}>
      <div className="max-w-4xl mx-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold ${text}`}>{t("integrations.title")}</h1>
            <p className={`mt-1 text-sm ${sub}`}>
              {t("integrations.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGuide("webhook")}
              className={`flex items-center gap-2 px-4 py-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-lg text-sm font-medium ${sub} transition-colors`}
            >
              <BookOpen className="w-4 h-4" />
              {t("integrations.howToConnect")}
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("integrations.addIntegration")}
            </button>
          </div>
        </div>

        {/* Список интеграций */}
        {integrations.length === 0 ? (
          <div className={`${card} border rounded-xl p-12 text-center`}>
            <Link2 className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
            <p className={`text-lg font-medium ${text}`}>{t("integrations.noIntegrations")}</p>
            <p className={`mt-2 text-sm ${sub}`}>
              {t("integrations.noIntegrationsDesc")}
            </p>
            <button
              onClick={openCreateModal}
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              {t("integrations.addFirst")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => {
              const typeInfo = INTEGRATION_TYPES_CONFIG.find((t) => t.id === integration.type);
              const tr = testResult[integration.id];
              return (
                <div key={integration.id} className={`${card} border rounded-xl p-5`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{typeInfo?.icon || "🔌"}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold ${text}`}>{integration.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                          }`}>
                            {typeInfo?.label || integration.type}
                          </span>
                          {integration.isActive ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">
                              {t("integrations.active")}
                            </span>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isDark ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"
                            } font-medium`}>
                              {t("integrations.disabled")}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {integration.events.map((e) => (
                            <span
                              key={e}
                              className={`text-xs px-2 py-0.5 rounded ${
                                isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {EVENT_LABEL_KEYS[e] ? t(EVENT_LABEL_KEYS[e]) : e}
                            </span>
                          ))}
                        </div>

                        {/* Статус последней синхронизации */}
                        <div className="mt-2 flex items-center gap-2">
                          {integration.lastError ? (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <XCircle className="w-3 h-3" />
                              {integration.lastError.slice(0, 80)}
                            </span>
                          ) : integration.lastSyncAt ? (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle2 className="w-3 h-3" />
                              {t("integrations.syncAt")} {new Date(integration.lastSyncAt).toLocaleString("ru-RU")}
                            </span>
                          ) : (
                            <span className={`text-xs ${sub}`}>{t("integrations.notRunYet")}</span>
                          )}
                        </div>

                        {/* Результат теста */}
                        {tr && (
                          <div className={`mt-2 text-xs ${tr.success ? "text-green-400" : "text-red-400"}`}>
                            {tr.success
                              ? `✓ ${t("integrations.testSuccess")}`
                              : `✗ ${t("integrations.testError")}: ${tr.error || t("integrations.unknown")}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Кнопки */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTest(integration.id)}
                        disabled={testingId === integration.id}
                        title={t("integrations.test")}
                        className={`p-2 rounded-lg transition-colors ${
                          isDark
                            ? "hover:bg-gray-700 text-gray-400 hover:text-white"
                            : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {testingId === integration.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggle(integration.id, integration.isActive)}
                        title={integration.isActive ? t("integrations.disable") : t("integrations.enable")}
                        className={`p-2 rounded-lg transition-colors ${
                          isDark
                            ? "hover:bg-gray-700 text-gray-400 hover:text-white"
                            : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {integration.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(integration.id)}
                        title={t("integrations.delete")}
                        className={`p-2 rounded-lg transition-colors ${
                          isDark
                            ? "hover:bg-red-900/30 text-gray-400 hover:text-red-400"
                            : "hover:bg-red-50 text-gray-400 hover:text-red-500"
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Инфо блок */}
        <div className={`mt-8 p-5 rounded-xl border ${isDark ? "border-blue-500/20 bg-blue-500/5" : "border-blue-100 bg-blue-50"}`}>
          <h3 className={`font-semibold mb-3 ${isDark ? "text-blue-300" : "text-blue-700"}`}>
            {t("integrations.webhookDataFormat")}
          </h3>
          <pre className={`text-xs overflow-x-auto ${isDark ? "text-gray-300" : "text-gray-700"}`}>
{`{
  "event": "booking_created",
  "timestamp": "2026-02-23T10:30:00Z",
  "business": { "id": "...", "name": "${businessName}" },
  "client": { "name": "Alisher", "phone": "+998901234567", "totalVisits": 5 },
  "booking": {
    "service": "Haircut", "master": "Rustam",
    "date": "2026-02-25T14:00:00Z", "price": 25000, "status": "confirmed"
  }
}`}
          </pre>
        </div>
      </div>

      {/* ========================================
          МОДАЛКА СОЗДАНИЯ
      ======================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`${modalBg} border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className={`text-lg font-semibold ${text}`}>{t("integrations.newIntegration")}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Выбор типа */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${text}`}>{t("integrations.integrationType")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {INTEGRATION_TYPES_CONFIG.map((t2) => (
                    <button
                      key={t2.id}
                      onClick={() => {
                        setSelectedType(t2.id);
                        setFormConfig({});
                      }}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                        selectedType === t2.id
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : isDark
                          ? "border-gray-600 hover:border-gray-500 text-gray-300"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      <span className="text-xl">{t2.icon}</span>
                      <span className="text-sm font-medium">{t2.label}</span>
                    </button>
                  ))}
                </div>
                <p className={`mt-2 text-xs ${sub}`}>{t(typeInfo.descriptionKey)}</p>
              </div>

              {/* Название */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  {t("integrations.name")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`${t("integrations.example")}: ${typeInfo.label} (${businessName})`}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`}
                />
              </div>

              {/* Поля конфигурации */}
              {typeInfo.fields.map((field) => (
                <div key={field.key}>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>
                    {t(field.labelKey)}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={formConfig[field.key] || ""}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholderFallback}
                      rows={5}
                      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors font-mono text-xs ${input}`}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formConfig[field.key] || ""}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholderFallback}
                      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`}
                    />
                  )}
                </div>
              ))}

              {/* События */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${text}`}>
                  {t("integrations.eventsToSend")}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_EVENT_IDS.map((eventId) => (
                    <label
                      key={eventId}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        formEvents.includes(eventId)
                          ? "border-blue-500 bg-blue-500/10"
                          : isDark
                          ? "border-gray-600 hover:border-gray-500"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formEvents.includes(eventId)}
                        onChange={() => toggleEvent(eventId)}
                        className="hidden"
                      />
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                          formEvents.includes(eventId)
                            ? "bg-blue-500 border-blue-500"
                            : isDark
                            ? "border-gray-500"
                            : "border-gray-300"
                        }`}
                      >
                        {formEvents.includes(eventId) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs ${formEvents.includes(eventId) ? "text-blue-400" : sub}`}>
                        {t(EVENT_LABEL_KEYS[eventId])}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 p-5 border-t border-gray-700">
              <button
                onClick={() => setIsModalOpen(false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {t("integrations.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formName.trim() || formEvents.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("integrations.create")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${card} border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between p-6 border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-blue-500" />
                <h2 className={`text-lg font-bold ${text}`}>{t("integrations.howToConnectTitle")}</h2>
              </div>
              <button onClick={() => setShowGuide(null)} className={`p-2 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                <X className={`h-5 w-5 ${sub}`} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Tab selector */}
              <div className="flex gap-2 flex-wrap">
                {INTEGRATION_TYPES_CONFIG.map((t2) => (
                  <button
                    key={t2.id}
                    onClick={() => setShowGuide(t2.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      showGuide === t2.id ? "bg-blue-600 text-white" : `${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} ${sub}`
                    }`}
                  >
                    {t2.icon} {t2.label}
                  </button>
                ))}
              </div>

              {/* Guide content */}
              <div className={`text-sm ${text} space-y-4`}>
                {showGuide === "webhook" && (
                  <>
                    <h3 className="font-bold text-lg">Universal Webhook</h3>
                    <p className={sub}>{t("integrations.webhookGuideDesc")}</p>
                    <ol className="list-decimal list-inside space-y-3">
                      <li><strong>{t("integrations.guideStep1Create")}</strong> {t("integrations.guideStep1Desc")}</li>
                      <li><strong>{t("integrations.guideStep2Copy")}</strong> {t("integrations.guideStep2Desc")}</li>
                      <li>{t("integrations.guideStep3")}</li>
                      <li>{t("integrations.guideStep4")}</li>
                      <li>{t("integrations.guideStep5")}</li>
                    </ol>
                    <div className={`p-4 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                      <p className="font-medium mb-2">{t("integrations.dataFormatJson")}</p>
                      <pre className={`text-xs ${sub} font-mono whitespace-pre-wrap`}>{`{
  "event": "booking_created",
  "timestamp": "2026-02-25T12:00:00Z",
  "data": {
    "client": { "name": "Ivan", "phone": "+7700..." },
    "booking": { "service": "Massage", "date": "2026-02-26", "price": 5000 }
  }
}`}</pre>
                    </div>
                  </>
                )}

                {showGuide === "bitrix24" && (
                  <>
                    <h3 className="font-bold text-lg">Bitrix24</h3>
                    <ol className="list-decimal list-inside space-y-3">
                      <li>{t("integrations.bitrix24GuideStep1")}</li>
                      <li>{t("integrations.bitrix24GuideStep2")}</li>
                      <li>{t("integrations.bitrix24GuideStep3")}</li>
                      <li>{t("integrations.bitrix24GuideStep4")}</li>
                      <li>{t("integrations.bitrix24GuideStep5")} {t("integrations.bitrix24GuideStep5Desc")}</li>
                      <li>{t("integrations.bitrix24GuideStep6")}</li>
                    </ol>
                  </>
                )}

                {showGuide === "amocrm" && (
                  <>
                    <h3 className="font-bold text-lg">AmoCRM</h3>
                    <ol className="list-decimal list-inside space-y-3">
                      <li>{t("integrations.amocrmGuideStep1")}</li>
                      <li>{t("integrations.amocrmGuideStep2")}</li>
                      <li>{t("integrations.amocrmGuideStep3")}</li>
                      <li>{t("integrations.amocrmGuideStep4")}</li>
                      <li>{t("integrations.amocrmGuideStep5")}</li>
                      <li>{t("integrations.amocrmGuideStep6")}</li>
                      <li>{t("integrations.amocrmGuideStep7")}</li>
                    </ol>
                  </>
                )}

                {showGuide === "google_sheets" && (
                  <>
                    <h3 className="font-bold text-lg">Google Sheets</h3>
                    <ol className="list-decimal list-inside space-y-3">
                      <li>{t("integrations.sheetsGuideStep1")}</li>
                      <li>{t("integrations.sheetsGuideStep2")}</li>
                      <li>{t("integrations.sheetsGuideStep3")}</li>
                      <li>{t("integrations.sheetsGuideStep4")}</li>
                      <li>{t("integrations.sheetsGuideStep5")}</li>
                      <li>{t("integrations.sheetsGuideStep6")}</li>
                      <li>{t("integrations.sheetsGuideStep7")}</li>
                    </ol>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
