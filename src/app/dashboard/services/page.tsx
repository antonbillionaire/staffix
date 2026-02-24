"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
}

export default function ServicesPage() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration: "",
  });

  // CSV Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; errors?: string[] } | null>(null);

  // Загрузка услуг из базы данных
  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        price: service.price.toString(),
        duration: service.duration.toString(),
      });
    } else {
      setEditingService(null);
      setFormData({ name: "", description: "", price: "", duration: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData({ name: "", description: "", price: "", duration: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingService) {
        // Обновление существующей услуги
        const res = await fetch(`/api/services/${editingService.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const data = await res.json();
          setServices(services.map((s) =>
            s.id === editingService.id ? data.service : s
          ));
        }
      } else {
        // Создание новой услуги
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const data = await res.json();
          setServices([...services, data.service]);
        }
      }
    } catch (error) {
      console.error("Error saving service:", error);
    } finally {
      setSaving(false);
      closeModal();
    }
  };

  const deleteService = async (id: string) => {
    if (confirm(t("servicesPage.deleteConfirm"))) {
      try {
        const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
        if (res.ok) {
          setServices(services.filter((s) => s.id !== id));
        }
      } catch (error) {
        console.error("Error deleting service:", error);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const mod = await import("xlsx");
      const XLSX = mod.default || mod;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";", rawNumbers: true });
        setImportCsv(csv);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setImportCsv((ev.target?.result as string) || "");
      reader.readAsText(file, "utf-8");
    }
  };

  const handleImport = async () => {
    if (!importCsv.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/import/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await res.json();
      setImportResult({ message: data.message || data.error, errors: data.errors });
      if (data.created > 0) await fetchServices();
    } catch {
      setImportResult({ message: "Ошибка при импорте" });
    } finally {
      setImporting(false);
    }
  };

  const formatPrice = (price: number) => {
    const locale = language === "ru" ? "ru-RU" : language === "kz" ? "kk-KZ" : language === "uz" ? "uz-UZ" : "en-US";
    const currency = language === "en" ? "$" : language === "kz" ? " тг" : language === "uz" ? " so'm" : " сум";
    return price.toLocaleString(locale) + currency;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t("servicesPage.title")}</h2>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {t("servicesPage.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setIsImportOpen(true); setImportResult(null); setImportCsv(""); }}
            className={`px-3 py-2 rounded-lg font-medium flex items-center gap-2 text-sm border ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            <Upload className="h-4 w-4" />
            Импорт CSV
          </button>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("servicesPage.add")}
          </button>
        </div>
      </div>

      {/* Services list */}
      <div className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border overflow-hidden`}>
        {loading ? (
          <div className={`p-8 text-center ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Загрузка...</p>
          </div>
        ) : services.length === 0 ? (
          <div className={`p-8 text-center ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            <p>{t("servicesPage.noServices")}</p>
            <p className="text-sm mt-1">
              {t("servicesPage.noServicesDesc")}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className={`${isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"} border-b`}>
              <tr>
                <th className={`text-left px-4 py-3 text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {t("servicesPage.service")}
                </th>
                <th className={`text-left px-4 py-3 text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {t("servicesPage.price")}
                </th>
                <th className={`text-left px-4 py-3 text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {t("servicesPage.duration")}
                </th>
                <th className={`text-right px-4 py-3 text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {t("servicesPage.actions")}
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-200"}`}>
              {services.map((service) => (
                <tr key={service.id} className={`${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
                  <td className={`px-4 py-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                    <div className="font-medium">{service.name}</div>
                    {service.description && (
                      <div className={`text-sm mt-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        {service.description}
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {formatPrice(service.price)}
                  </td>
                  <td className={`px-4 py-3 ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                    {service.duration} {t("servicesPage.minutes")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openModal(service)}
                      className={`${isDark ? "text-gray-500 hover:text-blue-400" : "text-gray-400 hover:text-blue-600"} p-1`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteService(service.id)}
                      className={`${isDark ? "text-gray-500 hover:text-red-400" : "text-gray-400 hover:text-red-600"} p-1 ml-2`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-[#12122a]" : "bg-white"} rounded-lg p-6 w-full max-w-md mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {editingService ? t("servicesPage.editService") : t("servicesPage.newService")}
              </h3>
              <button
                onClick={closeModal}
                className={`${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>
                  {t("servicesPage.serviceName")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t("servicesPage.serviceNamePlaceholder")}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Опишите процедуру, что входит, особенности..."
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>
                  {t("servicesPage.priceCurrency")}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="100000"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>
                  {t("servicesPage.durationMinutes")}
                </label>
                <input
                  type="number"
                  required
                  min="5"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  placeholder="60"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`flex-1 px-4 py-2 border rounded-lg font-medium ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {t("servicesPage.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingService ? t("servicesPage.save") : t("servicesPage.add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-[#12122a]" : "bg-white"} rounded-lg p-6 w-full max-w-lg mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Импорт услуг
              </h3>
              <button onClick={() => setIsImportOpen(false)} className={`${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={`text-sm mb-4 p-3 rounded-lg ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-600"}`}>
              <p className="font-medium mb-1">Формат CSV (колонки через запятую или точку с запятой):</p>
              <code className={`text-xs block ${isDark ? "text-green-400" : "text-green-700"}`}>
                Название;Цена;Длительность (мин);Описание (необязательно)
              </code>
              <code className={`text-xs block mt-1 ${isDark ? "text-blue-400" : "text-blue-700"}`}>
                Стрижка;5000;30;Классическая стрижка волос
              </code>
              <p className="mt-2 text-xs">Первая строка может быть заголовком — она будет пропущена автоматически.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Загрузить файл .csv
                </label>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 ${isDark ? "text-gray-300" : "text-gray-700"}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Или вставьте текст CSV
                </label>
                <textarea
                  value={importCsv}
                  onChange={(e) => setImportCsv(e.target.value)}
                  rows={6}
                  placeholder={"Стрижка;5000;30\nМаникюр;3000;60\nПедикюр;4000;90"}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-600" : "border-gray-300"}`}
                />
              </div>
            </div>

            {importResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${importResult.errors && importResult.errors.length > 0 ? (isDark ? "bg-yellow-500/10 text-yellow-300" : "bg-yellow-50 text-yellow-800") : (isDark ? "bg-green-500/10 text-green-300" : "bg-green-50 text-green-800")}`}>
                <p className="font-medium">{importResult.message}</p>
                {importResult.errors?.map((e, i) => (
                  <p key={i} className="text-xs mt-1">• {e}</p>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setIsImportOpen(false)}
                className={`flex-1 px-4 py-2 border rounded-lg font-medium ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                Закрыть
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importCsv.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Импортировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
