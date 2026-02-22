"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, User, Loader2, Camera, CalendarDays, MessageCircle, BedDouble } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";

interface Staff {
  id: string;
  name: string;
  role: string;
  photo: string | null;
  telegramUsername: string | null;
  telegramChatId: string | null;
  notificationsEnabled: boolean;
}

interface ScheduleDay {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorkday: boolean;
}

interface TimeOff {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  notes: string | null;
  createdBy: string;
}

const DAY_NAMES_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

const DEFAULT_SCHEDULE: ScheduleDay[] = DAY_ORDER.map((day) => ({
  dayOfWeek: day,
  startTime: "09:00",
  endTime: "18:00",
  isWorkday: day >= 1 && day <= 5, // Mon-Fri by default
}));

const REASON_LABELS: Record<string, string> = {
  vacation: "Отпуск",
  sick: "Больничный",
  personal: "Личные обстоятельства",
  other: "Другое",
};

const REASON_COLORS: Record<string, string> = {
  vacation: "text-blue-400 bg-blue-400/10",
  sick: "text-red-400 bg-red-400/10",
  personal: "text-yellow-400 bg-yellow-400/10",
  other: "text-gray-400 bg-gray-400/10",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export default function StaffPage() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    photo: "",
    telegramUsername: "",
    notificationsEnabled: true,
  });

  // Schedule modal
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleStaffId, setScheduleStaffId] = useState<string | null>(null);
  const [scheduleStaffName, setScheduleStaffName] = useState("");
  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Time-off modal
  const [isTimeOffOpen, setIsTimeOffOpen] = useState(false);
  const [timeOffStaffId, setTimeOffStaffId] = useState<string | null>(null);
  const [timeOffStaffName, setTimeOffStaffName] = useState("");
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [loadingTimeOffs, setLoadingTimeOffs] = useState(false);
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    startDate: "",
    endDate: "",
    reason: "vacation",
    notes: "",
  });

  const dayNames = language === "en" ? DAY_NAMES_EN : DAY_NAMES_RU;

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/staff");
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const openModal = (person?: Staff) => {
    if (person) {
      setEditingStaff(person);
      setFormData({
        name: person.name,
        role: person.role,
        photo: person.photo || "",
        telegramUsername: person.telegramUsername || "",
        notificationsEnabled: person.notificationsEnabled,
      });
    } else {
      setEditingStaff(null);
      setFormData({ name: "", role: "", photo: "", telegramUsername: "", notificationsEnabled: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({ name: "", role: "", photo: "", telegramUsername: "", notificationsEnabled: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingStaff) {
        const res = await fetch(`/api/staff/${editingStaff.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const data = await res.json();
          setStaff(staff.map((s) =>
            s.id === editingStaff.id ? data.staff : s
          ));
        }
      } else {
        const res = await fetch("/api/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const data = await res.json();
          setStaff([...staff, data.staff]);
        }
      }
    } catch (error) {
      console.error("Error saving staff:", error);
    } finally {
      setSaving(false);
      closeModal();
    }
  };

  const deletePerson = async (id: string) => {
    if (confirm(t("staffPage.deleteConfirm"))) {
      try {
        const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
        if (res.ok) {
          setStaff(staff.filter((s) => s.id !== id));
        }
      } catch (error) {
        console.error("Error deleting staff:", error);
      }
    }
  };

  // Schedule functions
  const openSchedule = async (person: Staff) => {
    setScheduleStaffId(person.id);
    setScheduleStaffName(person.name);
    setIsScheduleOpen(true);

    try {
      const res = await fetch(`/api/staff/${person.id}/schedule`);
      if (res.ok) {
        const data = await res.json();
        if (data.schedule && data.schedule.length > 0) {
          const merged = DAY_ORDER.map((day) => {
            const existing = data.schedule.find((s: ScheduleDay) => s.dayOfWeek === day);
            return existing || { dayOfWeek: day, startTime: "09:00", endTime: "18:00", isWorkday: day >= 1 && day <= 5 };
          });
          setSchedule(merged);
        } else {
          setSchedule([...DEFAULT_SCHEDULE]);
        }
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
      setSchedule([...DEFAULT_SCHEDULE]);
    }
  };

  const saveSchedule = async () => {
    if (!scheduleStaffId) return;
    setSavingSchedule(true);

    try {
      const res = await fetch(`/api/staff/${scheduleStaffId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
      if (res.ok) {
        setIsScheduleOpen(false);
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
    } finally {
      setSavingSchedule(false);
    }
  };

  const updateScheduleDay = (dayOfWeek: number, field: string, value: string | boolean) => {
    setSchedule(schedule.map((d) =>
      d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d
    ));
  };

  // Time-off functions
  const openTimeOff = async (person: Staff) => {
    setTimeOffStaffId(person.id);
    setTimeOffStaffName(person.name);
    setIsTimeOffOpen(true);
    setTimeOffForm({ startDate: "", endDate: "", reason: "vacation", notes: "" });
    setLoadingTimeOffs(true);

    try {
      const res = await fetch(`/api/staff/${person.id}/time-off`);
      if (res.ok) {
        const data = await res.json();
        setTimeOffs(data.timeOffs || []);
      }
    } catch (error) {
      console.error("Error loading time-offs:", error);
    } finally {
      setLoadingTimeOffs(false);
    }
  };

  const saveTimeOff = async () => {
    if (!timeOffStaffId || !timeOffForm.startDate || !timeOffForm.endDate) return;
    setSavingTimeOff(true);

    try {
      const res = await fetch(`/api/staff/${timeOffStaffId}/time-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(timeOffForm),
      });
      if (res.ok) {
        const data = await res.json();
        setTimeOffs((prev) => [...prev, data.timeOff].sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        ));
        setTimeOffForm({ startDate: "", endDate: "", reason: "vacation", notes: "" });
      }
    } catch (error) {
      console.error("Error saving time-off:", error);
    } finally {
      setSavingTimeOff(false);
    }
  };

  const deleteTimeOff = async (timeOffId: string) => {
    if (!timeOffStaffId) return;

    try {
      const res = await fetch(`/api/staff/${timeOffStaffId}/time-off/${timeOffId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTimeOffs((prev) => prev.filter((t) => t.id !== timeOffId));
      }
    } catch (error) {
      console.error("Error deleting time-off:", error);
    }
  };

  // Count upcoming time-offs for badge
  const getUpcomingTimeOffCount = (staffId: string) => {
    // We don't preload per-staff counts on page load — just use badge from staff card state
    return 0; // Badges shown only inside modal
  };
  void getUpcomingTimeOffCount; // suppress unused warning

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
        {loading ? (
          <div className={`col-span-full ${isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200"} rounded-lg border p-8 text-center ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Загрузка...</p>
          </div>
        ) : staff.length === 0 ? (
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
                  {person.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.photo}
                      alt={person.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className={`w-12 h-12 ${isDark ? "bg-blue-500/20" : "bg-blue-100"} rounded-full flex items-center justify-center`}>
                      <User className={`h-6 w-6 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
                    </div>
                  )}
                  <div>
                    <h3 className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{person.name}</h3>
                    <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>{person.role}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openSchedule(person)}
                    className={`${isDark ? "text-gray-500 hover:text-purple-400" : "text-gray-400 hover:text-purple-600"} p-1`}
                    title="Расписание"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openTimeOff(person)}
                    className={`${isDark ? "text-gray-500 hover:text-orange-400" : "text-gray-400 hover:text-orange-600"} p-1`}
                    title="Отпуска и больничные"
                  >
                    <BedDouble className="h-4 w-4" />
                  </button>
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
              {/* Telegram status */}
              {person.telegramUsername && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                  <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
                  <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {person.telegramUsername}
                  </span>
                  <span className={`ml-auto text-xs flex items-center gap-1 ${person.telegramChatId ? "text-green-400" : isDark ? "text-gray-600" : "text-gray-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${person.telegramChatId ? "bg-green-400" : isDark ? "bg-gray-600" : "bg-gray-400"}`} />
                    {person.telegramChatId ? t("staffPage.connected") : t("staffPage.notConnected")}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Staff Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-[#12122a]" : "bg-white"} rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto`}>
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

              {/* Telegram Username */}
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>
                  Telegram
                </label>
                <input
                  type="text"
                  value={formData.telegramUsername}
                  onChange={(e) =>
                    setFormData({ ...formData, telegramUsername: e.target.value })
                  }
                  placeholder="@username"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                />
                <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  {t("staffPage.telegramHint")}
                </p>
              </div>

              {/* Notifications toggle */}
              <div className="flex items-center justify-between">
                <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {t("staffPage.notifications")}
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, notificationsEnabled: !formData.notificationsEnabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${formData.notificationsEnabled ? "bg-blue-600" : isDark ? "bg-white/10" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formData.notificationsEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {/* Photo */}
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>
                  Фото
                </label>
                <div className="flex items-center gap-3">
                  {formData.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formData.photo}
                      alt="preview"
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className={`w-12 h-12 ${isDark ? "bg-white/5" : "bg-gray-100"} rounded-full flex items-center justify-center`}>
                      <Camera className={`h-5 w-5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                    </div>
                  )}
                  <label className={`cursor-pointer text-sm px-3 py-1.5 border rounded-lg ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                    Загрузить
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 500 * 1024) {
                            alert("Файл слишком большой (макс. 500 KB)");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFormData({ ...formData, photo: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {formData.photo && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, photo: "" })}
                      className="text-sm text-red-500 hover:text-red-400"
                    >
                      Удалить
                    </button>
                  )}
                </div>
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
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingStaff ? t("staffPage.save") : t("staffPage.add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-[#12122a]" : "bg-white"} rounded-lg p-6 w-full max-w-lg mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                {t("staffPage.scheduleTitle")} — {scheduleStaffName}
              </h3>
              <button
                onClick={() => setIsScheduleOpen(false)}
                className={`${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {DAY_ORDER.map((dayIdx) => {
                const day = schedule.find((d) => d.dayOfWeek === dayIdx);
                if (!day) return null;
                return (
                  <div key={dayIdx} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 rounded-lg ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-8 text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                        {dayNames[dayIdx]}
                      </span>

                      {/* Workday toggle */}
                      <button
                        type="button"
                        onClick={() => updateScheduleDay(dayIdx, "isWorkday", !day.isWorkday)}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${day.isWorkday ? "bg-blue-600" : isDark ? "bg-white/10" : "bg-gray-300"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${day.isWorkday ? "translate-x-5" : ""}`} />
                      </button>
                    </div>

                    {day.isWorkday ? (
                      <div className="flex items-center gap-2 flex-1 pl-11 sm:pl-0">
                        <input
                          type="time"
                          value={day.startTime}
                          onChange={(e) => updateScheduleDay(dayIdx, "startTime", e.target.value)}
                          className={`px-2 py-1 text-sm border rounded ${isDark ? "bg-white/5 border-white/10 text-white" : "border-gray-300"}`}
                        />
                        <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>—</span>
                        <input
                          type="time"
                          value={day.endTime}
                          onChange={(e) => updateScheduleDay(dayIdx, "endTime", e.target.value)}
                          className={`px-2 py-1 text-sm border rounded ${isDark ? "bg-white/5 border-white/10 text-white" : "border-gray-300"}`}
                        />
                      </div>
                    ) : (
                      <span className={`text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                        {t("staffPage.dayOff")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsScheduleOpen(false)}
                className={`flex-1 px-4 py-2 border rounded-lg font-medium ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                {t("staffPage.cancel")}
              </button>
              <button
                type="button"
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSchedule && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("staffPage.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time-Off Modal */}
      {isTimeOffOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-[#12122a]" : "bg-white"} rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  Отпуска и больничные
                </h3>
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>{timeOffStaffName}</p>
              </div>
              <button
                onClick={() => setIsTimeOffOpen(false)}
                className={`${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add new time-off form */}
            <div className={`rounded-lg p-4 mb-4 ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
              <h4 className={`text-sm font-medium mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Добавить период
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      Начало
                    </label>
                    <input
                      type="date"
                      value={timeOffForm.startDate}
                      onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value })}
                      className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white" : "border-gray-300"}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      Конец
                    </label>
                    <input
                      type="date"
                      value={timeOffForm.endDate}
                      onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })}
                      min={timeOffForm.startDate}
                      className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white" : "border-gray-300"}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Причина
                  </label>
                  <select
                    value={timeOffForm.reason}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                    className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-[#12122a] border-white/10 text-white" : "border-gray-300 bg-white"}`}
                  >
                    <option value="vacation">Отпуск</option>
                    <option value="sick">Больничный</option>
                    <option value="personal">Личные обстоятельства</option>
                    <option value="other">Другое</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                    Примечание (необязательно)
                  </label>
                  <input
                    type="text"
                    value={timeOffForm.notes}
                    onChange={(e) => setTimeOffForm({ ...timeOffForm, notes: e.target.value })}
                    placeholder="Например: поездка в другой город"
                    className={`w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-white/5 border-white/10 text-white placeholder-gray-500" : "border-gray-300"}`}
                  />
                </div>

                <button
                  onClick={saveTimeOff}
                  disabled={savingTimeOff || !timeOffForm.startDate || !timeOffForm.endDate}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingTimeOff && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Добавить период
                </button>
              </div>
            </div>

            {/* Existing time-offs */}
            <div>
              <h4 className={`text-sm font-medium mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Запланированные периоды
              </h4>

              {loadingTimeOffs ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : timeOffs.length === 0 ? (
                <p className={`text-sm text-center py-4 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  Нет запланированных периодов
                </p>
              ) : (
                <div className="space-y-2">
                  {timeOffs.map((t) => {
                    const isPast = new Date(t.endDate) < new Date();
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          isPast
                            ? isDark ? "bg-white/3 opacity-50" : "bg-gray-50 opacity-60"
                            : isDark ? "bg-white/5" : "bg-gray-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REASON_COLORS[t.reason] || REASON_COLORS.other}`}>
                              {REASON_LABELS[t.reason] || t.reason}
                            </span>
                            {isPast && (
                              <span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>
                                прошёл
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                            {formatDate(t.startDate)}
                            {t.startDate !== t.endDate && ` — ${formatDate(t.endDate)}`}
                          </p>
                          {t.notes && (
                            <p className={`text-xs mt-0.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                              {t.notes}
                            </p>
                          )}
                        </div>
                        {!isPast && (
                          <button
                            onClick={() => deleteTimeOff(t.id)}
                            className={`ml-3 p-1.5 rounded ${isDark ? "text-gray-600 hover:text-red-400 hover:bg-red-400/10" : "text-gray-400 hover:text-red-600 hover:bg-red-50"} flex-shrink-0`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <button
                onClick={() => setIsTimeOffOpen(false)}
                className={`w-full px-4 py-2 border rounded-lg font-medium text-sm ${isDark ? "border-white/10 text-gray-300 hover:bg-white/5" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
