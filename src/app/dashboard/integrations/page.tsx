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
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

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

const INTEGRATION_TYPES: {
  id: IntegrationType;
  label: string;
  description: string;
  icon: string;
  fields: FormField[];
}[] = [
  {
    id: "webhook",
    label: "Universal Webhook",
    description:
      "Отправка событий на любой HTTP endpoint. Работает с Zapier, Make, n8n и любым API.",
    icon: "🔗",
    fields: [
      { key: "url", label: "URL endpoint", type: "url", required: true, placeholder: "https://hooks.zapier.com/hooks/..." },
      { key: "secret", label: "Secret (HMAC подпись)", type: "text", required: false, placeholder: "необязательно" },
    ],
  },
  {
    id: "bitrix24",
    label: "Bitrix24",
    description: "Создаёт контакты и сделки в Bitrix24 CRM при новых записях.",
    icon: "🏢",
    fields: [
      { key: "domain", label: "Домен Bitrix24", type: "text", required: true, placeholder: "mycompany.bitrix24.ru" },
      { key: "token", label: "Incoming Webhook Token", type: "text", required: true, placeholder: "из раздела Приложения → Вебхуки" },
    ],
  },
  {
    id: "amocrm",
    label: "AmoCRM",
    description: "Создаёт контакты и сделки в AmoCRM при новых записях.",
    icon: "💼",
    fields: [
      { key: "domain", label: "Поддомен AmoCRM", type: "text", required: true, placeholder: "mycompany (без .amocrm.ru)" },
      { key: "token", label: "Access Token", type: "password", required: true, placeholder: "из интеграции AmoCRM" },
      { key: "pipelineId", label: "ID воронки (необязательно)", type: "text", required: false, placeholder: "123456" },
    ],
  },
  {
    id: "google_sheets",
    label: "Google Sheets",
    description: "Записывает каждое событие новой строкой в Google Таблицу.",
    icon: "📊",
    fields: [
      { key: "spreadsheetId", label: "ID таблицы", type: "text", required: true, placeholder: "из URL таблицы: .../d/ID/edit" },
      { key: "sheetName", label: "Название листа", type: "text", required: false, placeholder: "Sheet1" },
      { key: "credentialsJson", label: "Credentials JSON (сервисный аккаунт)", type: "textarea", required: true, placeholder: '{"type":"service_account","project_id":"..."}' },
    ],
  },
];

const ALL_EVENTS: { id: string; label: string }[] = [
  { id: "booking_created", label: "Новая запись" },
  { id: "booking_confirmed", label: "Запись подтверждена" },
  { id: "booking_cancelled", label: "Запись отменена" },
  { id: "new_client", label: "Новый клиент" },
  { id: "review_created", label: "Новый отзыв" },
  { id: "message_received", label: "Входящее сообщение" },
];

interface FormField {
  key: string;
  label: string;
  type: "text" | "url" | "password" | "textarea";
  required: boolean;
  placeholder?: string;
}

// ========================================
// КОМПОНЕНТ
// ========================================

export default function IntegrationsPage() {
  const { theme } = useTheme();
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
        alert(data.error || "Ошибка создания");
        return;
      }
      setIsModalOpen(false);
      fetchIntegrations();
    } catch (e) {
      console.error(e);
      alert("Ошибка сети");
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
    if (!confirm("Удалить интеграцию?")) return;
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
      setTestResult((prev) => ({ ...prev, [id]: { success: false, error: "Ошибка сети" } }));
    } finally {
      setTestingId(null);
    }
  };

  const toggleEvent = (eventId: string) => {
    setFormEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const typeInfo = INTEGRATION_TYPES.find((t) => t.id === selectedType)!;

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
            <h1 className={`text-2xl font-bold ${text}`}>CRM Интеграции</h1>
            <p className={`mt-1 text-sm ${sub}`}>
              Автоматически передавайте данные о записях и клиентах во внешние системы
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить интеграцию
          </button>
        </div>

        {/* Список интеграций */}
        {integrations.length === 0 ? (
          <div className={`${card} border rounded-xl p-12 text-center`}>
            <Link2 className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
            <p className={`text-lg font-medium ${text}`}>Нет интеграций</p>
            <p className={`mt-2 text-sm ${sub}`}>
              Подключите Bitrix24, AmoCRM, Google Sheets или любой Webhook
            </p>
            <button
              onClick={openCreateModal}
              className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Добавить первую интеграцию
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => {
              const typeInfo = INTEGRATION_TYPES.find((t) => t.id === integration.type);
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
                              Активна
                            </span>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isDark ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"
                            } font-medium`}>
                              Отключена
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
                              {ALL_EVENTS.find((ev) => ev.id === e)?.label || e}
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
                              Синхр. {new Date(integration.lastSyncAt).toLocaleString("ru-RU")}
                            </span>
                          ) : (
                            <span className={`text-xs ${sub}`}>Ещё не запускалась</span>
                          )}
                        </div>

                        {/* Результат теста */}
                        {tr && (
                          <div className={`mt-2 text-xs ${tr.success ? "text-green-400" : "text-red-400"}`}>
                            {tr.success
                              ? "✓ Тест прошёл успешно"
                              : `✗ Ошибка: ${tr.error || "неизвестно"}`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Кнопки */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTest(integration.id)}
                        disabled={testingId === integration.id}
                        title="Тест"
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
                        title={integration.isActive ? "Отключить" : "Включить"}
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
                        title="Удалить"
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
            📋 Формат данных Webhook
          </h3>
          <pre className={`text-xs overflow-x-auto ${isDark ? "text-gray-300" : "text-gray-700"}`}>
{`{
  "event": "booking_created",
  "timestamp": "2026-02-23T10:30:00Z",
  "business": { "id": "...", "name": "${businessName}" },
  "client": { "name": "Алишер", "phone": "+998901234567", "totalVisits": 5 },
  "booking": {
    "service": "Стрижка", "master": "Рустам",
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
              <h2 className={`text-lg font-semibold ${text}`}>Новая интеграция</h2>
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
                <label className={`block text-sm font-medium mb-2 ${text}`}>Тип интеграции</label>
                <div className="grid grid-cols-2 gap-2">
                  {INTEGRATION_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedType(t.id);
                        setFormConfig({});
                      }}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                        selectedType === t.id
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : isDark
                          ? "border-gray-600 hover:border-gray-500 text-gray-300"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-sm font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
                <p className={`mt-2 text-xs ${sub}`}>{typeInfo.description}</p>
              </div>

              {/* Название */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  Название <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`Например: ${typeInfo.label} (${businessName})`}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`}
                />
              </div>

              {/* Поля конфигурации */}
              {typeInfo.fields.map((field) => (
                <div key={field.key}>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={formConfig[field.key] || ""}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
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
                      placeholder={field.placeholder}
                      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`}
                    />
                  )}
                </div>
              ))}

              {/* События */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${text}`}>
                  Какие события отправлять
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_EVENTS.map((event) => (
                    <label
                      key={event.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        formEvents.includes(event.id)
                          ? "border-blue-500 bg-blue-500/10"
                          : isDark
                          ? "border-gray-600 hover:border-gray-500"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formEvents.includes(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="hidden"
                      />
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                          formEvents.includes(event.id)
                            ? "bg-blue-500 border-blue-500"
                            : isDark
                            ? "border-gray-500"
                            : "border-gray-300"
                        }`}
                      >
                        {formEvents.includes(event.id) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-xs ${formEvents.includes(event.id) ? "text-blue-400" : sub}`}>
                        {event.label}
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
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formName.trim() || formEvents.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
