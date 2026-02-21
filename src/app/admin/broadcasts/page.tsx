"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  Plus,
  Mail,
  MessageSquare,
  Bell,
  Send,
  Clock,
  FileText,
  Trash2,
  ChevronDown,
  Check,
  Users,
  BarChart3,
  Eye,
  MousePointer,
  Calendar,
  Paperclip,
  X,
} from "lucide-react";

interface Broadcast {
  id: string;
  name: string;
  subject: string | null;
  content: string;
  channel: string;
  targetPlan: string;
  targetStatus: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  totalRecipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  createdAt: string;
  _count: {
    deliveries: number;
  };
}

interface Stats {
  total: number;
  sent: number;
  scheduled: number;
  draft: number;
}

const CHANNEL_OPTIONS = [
  { id: "email", name: "Email", icon: <Mail className="h-4 w-4" /> },
  { id: "telegram", name: "Telegram", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "in_app", name: "В приложении", icon: <Bell className="h-4 w-4" /> },
];

const PLAN_OPTIONS = [
  { id: "all", name: "Все планы" },
  { id: "trial", name: "Trial" },
  { id: "pro", name: "Pro" },
  { id: "business", name: "Business" },
];

const STATUS_OPTIONS = [
  { id: "all", name: "Все статусы" },
  { id: "active", name: "Активные" },
  { id: "expired", name: "Истёкшие" },
  { id: "expiring", name: "Истекают скоро" },
];

interface Attachment {
  filename: string;
  content: string; // base64
  size: number;
}

export default function AdminBroadcastsPage() {
  const [loading, setLoading] = useState(true);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, scheduled: 0, draft: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // File attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    content: "",
    channel: "email",
    targetPlan: "all",
    targetStatus: "all",
    sendNow: true,
    scheduledFor: "",
  });

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB per file

    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        setMessage({ type: "error", text: `Файл ${file.name} слишком большой (макс. 3MB)` });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachments((prev) => [
          ...prev,
          { filename: file.name, content: base64, size: file.size },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch("/api/admin/broadcasts");
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.broadcasts || []);
        setStats(data.stats || { total: 0, sent: 0, scheduled: 0, draft: 0 });
      }
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: formData.sendNow
            ? `Рассылка отправлена ${data.recipientsCount} получателям`
            : "Рассылка создана",
        });
        setShowCreateModal(false);
        setFormData({
          name: "",
          subject: "",
          content: "",
          channel: "email",
          targetPlan: "all",
          targetStatus: "all",
          sendNow: true,
          scheduledFor: "",
        });
        setAttachments([]);
        fetchBroadcasts();
      } else {
        setMessage({ type: "error", text: data.error || "Ошибка создания" });
      }
    } catch {
      setMessage({ type: "error", text: "Ошибка сервера" });
    } finally {
      setCreating(false);
    }
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm("Удалить рассылку?")) return;

    try {
      const res = await fetch(`/api/admin/broadcasts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchBroadcasts();
      }
    } catch (error) {
      console.error("Error deleting broadcast:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: "bg-gray-500/10", text: "text-gray-400", label: "Черновик" },
      scheduled: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Запланировано" },
      sending: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Отправляется" },
      sent: { bg: "bg-green-500/10", text: "text-green-400", label: "Отправлено" },
      cancelled: { bg: "bg-red-500/10", text: "text-red-400", label: "Отменено" },
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "telegram":
        return <MessageSquare className="h-4 w-4" />;
      case "in_app":
        return <Bell className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

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
          <h1 className="text-2xl font-bold text-white">Рассылки</h1>
          <p className="text-gray-400">
            Коммуникация с клиентами
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white font-medium rounded-xl hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Новая рассылка
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Mail className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Всего рассылок</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Check className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Отправлено</p>
              <p className="text-2xl font-bold text-white">{stats.sent}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Запланировано</p>
              <p className="text-2xl font-bold text-white">{stats.scheduled}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#12122a] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-500/10 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Черновики</p>
              <p className="text-2xl font-bold text-white">{stats.draft}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcasts list */}
      <div className="bg-[#12122a] border border-white/5 rounded-xl">
        {broadcasts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет рассылок</p>
            <p className="text-sm mt-1">Создайте первую рассылку</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className="p-4 flex items-center gap-4 hover:bg-white/5"
              >
                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-gray-400">
                  {getChannelIcon(broadcast.channel)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium">{broadcast.name}</p>
                    {getStatusBadge(broadcast.status)}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {broadcast.subject || broadcast.content.substring(0, 100)}
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-400">
                      <Users className="h-4 w-4" />
                      <span>{broadcast.totalRecipients}</span>
                    </div>
                    <p className="text-xs text-gray-500">Получателей</p>
                  </div>
                  {broadcast.status === "sent" && (
                    <>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-green-400">
                          <Check className="h-4 w-4" />
                          <span>{broadcast.delivered}</span>
                        </div>
                        <p className="text-xs text-gray-500">Доставлено</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-blue-400">
                          <Eye className="h-4 w-4" />
                          <span>{broadcast.opened}</span>
                        </div>
                        <p className="text-xs text-gray-500">Открыто</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-purple-400">
                          <MousePointer className="h-4 w-4" />
                          <span>{broadcast.clicked}</span>
                        </div>
                        <p className="text-xs text-gray-500">Кликов</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-right text-sm text-gray-400">
                  {broadcast.sentAt ? (
                    <p>{formatDate(broadcast.sentAt)}</p>
                  ) : broadcast.scheduledFor ? (
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(broadcast.scheduledFor)}
                    </p>
                  ) : (
                    <p>{formatDate(broadcast.createdAt)}</p>
                  )}
                </div>

                <button
                  onClick={() => deleteBroadcast(broadcast.id)}
                  className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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
              <h2 className="text-xl font-bold text-white">Новая рассылка</h2>
              <p className="text-gray-400 text-sm mt-1">
                Отправьте сообщение вашим клиентам
              </p>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Название рассылки
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Новогодняя акция"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Канал
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CHANNEL_OPTIONS.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, channel: ch.id })}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                        formData.channel === ch.id
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      {ch.icon}
                      <span className="text-sm">{ch.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject (for email) */}
              {formData.channel === "email" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Тема письма
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Специальное предложение для вас"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Сообщение
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Текст вашего сообщения..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Доступные переменные: {"{{name}}"}, {"{{business}}"}, {"{{plan}}"}
                </p>
              </div>

              {/* File attachments (email only) */}
              {formData.channel === "email" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Прикрепить файлы
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xlsx,.csv,.txt"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:border-white/20 hover:text-gray-300 transition-colors text-sm"
                  >
                    <Paperclip className="h-4 w-4" />
                    Прикрепить файл
                  </button>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {attachments.map((att, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                          <span className="text-sm text-gray-300 flex-1 truncate">{att.filename}</span>
                          <span className="text-xs text-gray-500">{formatFileSize(att.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="p-0.5 hover:text-red-400 text-gray-500 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Макс. 3MB на файл</p>
                </div>
              )}

              {/* Target audience */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    План
                  </label>
                  <div className="relative">
                    <select
                      value={formData.targetPlan}
                      onChange={(e) => setFormData({ ...formData, targetPlan: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                    >
                      {PLAN_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Статус
                  </label>
                  <div className="relative">
                    <select
                      value={formData.targetStatus}
                      onChange={(e) => setFormData({ ...formData, targetStatus: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Send options */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Когда отправить
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, sendNow: true, scheduledFor: "" })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                      formData.sendNow
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    Сейчас
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, sendNow: false })}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                      !formData.sendNow
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    Запланировать
                  </button>
                </div>
              </div>

              {/* Scheduled time */}
              {!formData.sendNow && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Дата и время
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledFor}
                    onChange={(e) => setFormData({ ...formData, scheduledFor: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required={!formData.sendNow}
                  />
                </div>
              )}

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
                  ) : formData.sendNow ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  {formData.sendNow ? "Отправить" : "Запланировать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
