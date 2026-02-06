"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X, User } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Staff {
  id: number;
  name: string;
  role: string;
}

export default function StaffPage() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [staff, setStaff] = useState<Staff[]>([
    { id: 1, name: "Анна", role: "Стилист" },
    { id: 2, name: "Мария", role: "Мастер маникюра" },
    { id: 3, name: "Ольга", role: "Парикмахер" },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
  });

  const openModal = (person?: Staff) => {
    if (person) {
      setEditingStaff(person);
      setFormData({
        name: person.name,
        role: person.role,
      });
    } else {
      setEditingStaff(null);
      setFormData({ name: "", role: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({ name: "", role: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingStaff) {
      setStaff(
        staff.map((s) =>
          s.id === editingStaff.id
            ? {
                ...s,
                name: formData.name,
                role: formData.role,
              }
            : s
        )
      );
    } else {
      setStaff([
        ...staff,
        {
          id: Date.now(),
          name: formData.name,
          role: formData.role,
        },
      ]);
    }

    closeModal();
  };

  const deletePerson = (id: number) => {
    if (confirm(t("staffPage.deleteConfirm"))) {
      setStaff(staff.filter((s) => s.id !== id));
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t("staffPage.title")}</h2>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {t("staffPage.subtitle")}
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t("staffPage.add")}
        </button>
      </div>

      {/* Staff list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staff.length === 0 ? (
          <div className={`col-span-full ${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border p-8 text-center ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            <p>{t("staffPage.noStaff")}</p>
            <p className="text-sm mt-1">
              {t("staffPage.noStaffDesc")}
            </p>
          </div>
        ) : (
          staff.map((person) => (
            <div
              key={person.id}
              className={`${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border p-4`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${isDark ? "bg-blue-500/20" : "bg-blue-100"} rounded-full flex items-center justify-center`}>
                    <User className={`h-6 w-6 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                  </div>
                  <div>
                    <h3 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{person.name}</h3>
                    <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>{person.role}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openModal(person)}
                    className={`${isDark ? "text-gray-500 hover:text-blue-400" : "text-gray-400 hover:text-blue-600"} p-1`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deletePerson(person.id)}
                    className={`${isDark ? "text-gray-500 hover:text-red-400" : "text-gray-400 hover:text-red-600"} p-1`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-[#12122a]" : "bg-white"} rounded-lg p-6 w-full max-w-md mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {editingStaff ? t("staffPage.editStaff") : t("staffPage.newStaff")}
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
                  {t("staffPage.name")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t("staffPage.namePlaceholder")}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>
                  {t("staffPage.role")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  placeholder={t("staffPage.rolePlaceholder")}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`flex-1 px-4 py-2 border rounded-lg font-medium ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  {t("staffPage.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  {editingStaff ? t("staffPage.save") : t("staffPage.add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
