"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Service {
  id: number;
  name: string;
  price: number;
  duration: number;
}

export default function ServicesPage() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [services, setServices] = useState<Service[]>([
    { id: 1, name: "Стрижка женская", price: 100000, duration: 60 },
    { id: 2, name: "Стрижка мужская", price: 50000, duration: 30 },
    { id: 3, name: "Маникюр", price: 80000, duration: 45 },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    duration: "",
  });

  const openModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        price: service.price.toString(),
        duration: service.duration.toString(),
      });
    } else {
      setEditingService(null);
      setFormData({ name: "", price: "", duration: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData({ name: "", price: "", duration: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingService) {
      setServices(
        services.map((s) =>
          s.id === editingService.id
            ? {
                ...s,
                name: formData.name,
                price: parseInt(formData.price),
                duration: parseInt(formData.duration),
              }
            : s
        )
      );
    } else {
      setServices([
        ...services,
        {
          id: Date.now(),
          name: formData.name,
          price: parseInt(formData.price),
          duration: parseInt(formData.duration),
        },
      ]);
    }

    closeModal();
  };

  const deleteService = (id: number) => {
    if (confirm(t("servicesPage.deleteConfirm"))) {
      setServices(services.filter((s) => s.id !== id));
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
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("servicesPage.add")}
        </button>
      </div>

      {/* Services list */}
      <div className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border overflow-hidden`}>
        {services.length === 0 ? (
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
                  <td className={`px-4 py-3 font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    {service.name}
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  {editingService ? t("servicesPage.save") : t("servicesPage.add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
