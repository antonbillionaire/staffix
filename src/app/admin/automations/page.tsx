"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Zap,
  Clock,
  Mail,
  MessageSquare,
  Bell,
  Play,
  Pause,
  Trash2,
  ChevronDown,
  Check,
  AlertTriangle,
  Users,
  Calendar,
  TrendingUp,
} from "lucide-react";

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerParams: Record<string, unknown>;
  action: string;
  actionParams: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  executionsLast30Days: number;
  _count: {
    executions: number;
  };
}

interface TriggerType {
  id: string;
  name: string;
  description: string;
  params: string[];
}

interface ActionType {
  id: string;
  name: string;
  description: string;
  params: string[];
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  trial_expiring: <Clock className="h-4 w-4" />,
  trial_expired: <AlertTriangle className="h-4 w-4" />,
  subscription_expiring: <Calendar className="h-4 w-4" />,
  messages_low: <MessageSquare className="h-4 w-4" />,
  user_inactive: <Users className="h-4 w-4" />,
  new_signup: <TrendingUp className="h-4 w-4" />,
  booking_created: <Calendar className="h-4 w-4" />,
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  send_email: <Mail className="h-4 w-4" />,
  send_telegram: <MessageSquare className="h-4 w-4" />,
  extend_trial: <Clock className="h-4 w-4" />,
  add_messages: <Plus className="h-4 w-4" />,
  notify_admin: <Bell className="h-4 w-4" />,
  add_tag: <Users className="h-4 w-4" />,
};

export default function AdminAutomationsPage() {
  const [loading, setLoading] = useState(true);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [triggers, setTriggers] = useState<Record<string, TriggerType>>({});
  const [actions, setActions] = useState<Record<string, ActionType>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger: "",
    triggerParams: {} as Record<string, string>,
    action: "",
    actionParams: {} as Record<string, string>,
  });

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const res = await fetch("/api/admin/automations");
      if (res.ok) {
        const data = await res.json();
        setAutomations(data.automations || []);
        setTriggers(data.triggers || {});
        setActions(data.actions || {});
      }
    } catch (error) {
      console.error("Error fetching automations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Автоматизация создана" });
        setShowCreateModal(false);
        setFormData({
          name: "",
          description: "",
          trigger: "",
          triggerParams: {},
          action: "",
          actionParams: {},
        });
        fetchAutomations();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Ошибка создания" });
      }
    } catch {
      setMessage({ type: "error", text: "Ошибка сервера" });
    } finally {
      setCreating(false);
    }
  };

  const toggleAutomation = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        fetchAutomations();
      }
    } catch (error) {
      console.error("Error toggling automation:", error);
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm("Удалить автоматизацию?")) return;

    try {
      const res = await fetch(`/api/admin/automations/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAutomations();
      }
    } catch (error) {
      console.error("Error deleting automation:", error);
    }
  };

  const selectedTrigger = formData.trigger ? triggers[formData.trigger] : null;
  const selectedAction = formData.action ? actions[formData.action] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Автоматизации</h1>
          <p className="text-gray-400">
            Автоматические действия по триггерам
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white font-medium rounded-xl hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Новая автоматизация
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Всего автоматизаций</p>
              <p className="text-2xl font-bold text-white">{automations.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Play className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Активных</p>
              <p className="text-2xl font-bold text-white">
                {automations.filter((a) => a.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Выполнено за 30 дней</p>
              <p className="text-2xl font-bold text-white">
                {automations.reduce((sum, a) => sum + (a.executionsLast30Days || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Automations list */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl">
        {automations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет автоматизаций</p>
            <p className="text-sm mt-1">Создайте первую автоматизацию</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {automations.map((automation) => (
              <div
                key={automation.id}
                className="p-4 flex items-center gap-4 hover:bg-white/5"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    automation.isActive
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  <Zap className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{automation.name}</p>
                    {automation.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400">
                        Активна
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/10 text-gray-400">
                        Остановлена
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      {TRIGGER_ICONS[automation.trigger]}
                      {triggers[automation.trigger]?.name || automation.trigger}
                    </span>
                    <span>→</span>
                    <span className="flex items-center gap-1">
                      {ACTION_ICONS[automation.action]}
                      {actions[automation.action]?.name || automation.action}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    {automation._count?.executions || 0} выполнений
                  </p>
                  <p className="text-xs text-gray-500">
                    {automation.executionsLast30Days || 0} за 30 дней
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAutomation(automation.id, automation.isActive)}
                    className={`p-2 rounded-lg transition-colors ${
                      automation.isActive
                        ? "hover:bg-yellow-500/10 text-yellow-400"
                        : "hover:bg-green-500/10 text-green-400"
                    }`}
                    title={automation.isActive ? "Остановить" : "Запустить"}
                  >
                    {automation.isActive ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteAutomation(automation.id)}
                    className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">Новая автоматизация</h2>
              <p className="text-gray-400 text-sm mt-1">
                Настройте триггер и действие
              </p>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Название
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Напоминание об истечении триала"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Опционально..."
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Когда срабатывает (триггер)
                </label>
                <div className="relative">
                  <select
                    value={formData.trigger}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trigger: e.target.value,
                        triggerParams: {},
                      })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                    required
                  >
                    <option value="">Выберите триггер...</option>
                    {Object.values(triggers).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
                {selectedTrigger && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedTrigger.description}
                  </p>
                )}
              </div>

              {/* Trigger params */}
              {selectedTrigger?.params?.map((param) => (
                <div key={param}>
                  <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                    {param.replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    value={formData.triggerParams[param] || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        triggerParams: {
                          ...formData.triggerParams,
                          [param]: e.target.value,
                        },
                      })
                    }
                    placeholder={param === "days_before" ? "3" : param === "percentage" ? "20" : ""}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Что делать (действие)
                </label>
                <div className="relative">
                  <select
                    value={formData.action}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        action: e.target.value,
                        actionParams: {},
                      })
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                    required
                  >
                    <option value="">Выберите действие...</option>
                    {Object.values(actions).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
                {selectedAction && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedAction.description}
                  </p>
                )}
              </div>

              {/* Action params */}
              {selectedAction?.params?.map((param) => (
                <div key={param}>
                  <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                    {param.replace(/_/g, " ")}
                  </label>
                  {param === "template" || param === "message" ? (
                    <textarea
                      value={formData.actionParams[param] || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          actionParams: {
                            ...formData.actionParams,
                            [param]: e.target.value,
                          },
                        })
                      }
                      placeholder={
                        param === "message"
                          ? "Привет! Ваш триал скоро истечёт..."
                          : "Шаблон email..."
                      }
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData.actionParams[param] || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          actionParams: {
                            ...formData.actionParams,
                            [param]: e.target.value,
                          },
                        })
                      }
                      placeholder={
                        param === "days"
                          ? "7"
                          : param === "count"
                          ? "100"
                          : param === "subject"
                          ? "Тема письма"
                          : ""
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  )}
                </div>
              ))}

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 font-medium transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
