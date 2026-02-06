"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Send,
  Plus,
  Loader2,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Crown,
  Sparkles,
  Moon,
  X,
  MessageSquare,
} from "lucide-react";

interface BroadcastStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
}

interface Broadcast {
  id: string;
  title: string;
  content: string;
  status: string;
  targetSegment: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  stats: BroadcastStats;
}

const segmentLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  all: { label: "Все клиенты", icon: <Users className="h-4 w-4" />, color: "text-blue-400" },
  vip: { label: "VIP", icon: <Crown className="h-4 w-4" />, color: "text-yellow-400" },
  active: { label: "Активные", icon: <Sparkles className="h-4 w-4" />, color: "text-green-400" },
  inactive: { label: "Неактивные", icon: <Moon className="h-4 w-4" />, color: "text-gray-400" },
};

const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Черновик", bg: "bg-gray-500/10", text: "text-gray-400" },
  scheduled: { label: "Запланирована", bg: "bg-blue-500/10", text: "text-blue-400" },
  sending: { label: "Отправляется", bg: "bg-yellow-500/10", text: "text-yellow-400" },
  sent: { label: "Отправлена", bg: "bg-green-500/10", text: "text-green-400" },
  cancelled: { label: "Отменена", bg: "bg-red-500/10", text: "text-red-400" },
};

export default function BroadcastsPage() {
  const { theme } = useTheme();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetSegment, setTargetSegment] = useState("all");
  const [sendNow, setSendNow] = useState(true);
  const [creating, setCreating] = useState(false);

  // Theme-aware styles
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-500" : "text-gray-500";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";
  const modalBg = isDark ? "bg-[#1a1a2e]" : "bg-white";

  useEffect(() => {
    fetchBroadcasts();
  }, [filter]);

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch(`/api/broadcasts?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.broadcasts || []);
      }
    } catch (error) {
      console.error("Error fetching broadcasts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          targetSegment,
          sendNow,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setTitle("");
        setContent("");
        setTargetSegment("all");
        setSendNow(true);
        fetchBroadcasts();
      } else {
        const error = await res.json();
        alert(error.error || "Ошибка при создании рассылки");
      }
    } catch (error) {
      console.error("Error creating broadcast:", error);
      alert("Ошибка при создании рассылки");
    } finally {
      setCreating(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Рассылки</h1>
          <p className={`${textSecondary} mt-1`}>
            Отправляйте сообщения своим клиентам в Telegram
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Новая рассылка
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span className={`text-xs ${textSecondary}`}>Всего рассылок</span>
          </div>
          <p className={`text-2xl font-bold ${textPrimary}`}>{broadcasts.length}</p>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className={`text-xs ${textSecondary}`}>Отправлено</span>
          </div>
          <p className={`text-2xl font-bold ${textPrimary}`}>
            {broadcasts.filter((b) => b.status === "sent").length}
          </p>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className={`text-xs ${textSecondary}`}>Черновики</span>
          </div>
          <p className={`text-2xl font-bold ${textPrimary}`}>
            {broadcasts.filter((b) => b.status === "draft").length}
          </p>
        </div>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-4 w-4 text-purple-500" />
            <span className={`text-xs ${textSecondary}`}>Доставлено сообщений</span>
          </div>
          <p className={`text-2xl font-bold ${textPrimary}`}>
            {broadcasts.reduce((sum, b) => sum + b.stats.sent, 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "Все" },
          { key: "sent", label: "Отправленные" },
          { key: "draft", label: "Черновики" },
          { key: "scheduled", label: "Запланированные" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-blue-600 text-white"
                : `${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} ${textSecondary}`
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Broadcasts List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : broadcasts.length === 0 ? (
        <div className={`${cardBg} border ${borderColor} rounded-xl p-12 text-center`}>
          <Send className={`h-12 w-12 ${isDark ? "text-gray-600" : "text-gray-400"} mx-auto mb-4`} />
          <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>Нет рассылок</h3>
          <p className={`${textSecondary} mb-4`}>
            Создайте первую рассылку для ваших клиентов
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Создать рассылку
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((broadcast) => {
            const segment = segmentLabels[broadcast.targetSegment] || segmentLabels.all;
            const status = statusLabels[broadcast.status] || statusLabels.draft;

            return (
              <div
                key={broadcast.id}
                className={`${cardBg} border ${borderColor} rounded-xl p-5 hover:border-blue-500/20 transition-colors`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-lg font-medium ${textPrimary} truncate`}>
                        {broadcast.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className={`${textSecondary} text-sm mb-3 line-clamp-2`}>
                      {broadcast.content}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`flex items-center gap-1 ${segment.color}`}>
                        {segment.icon}
                        {segment.label}
                      </span>
                      <span className={textTertiary}>
                        {formatDate(broadcast.createdAt)}
                      </span>
                      {broadcast.sentAt && (
                        <span className={textTertiary}>
                          Отправлена: {formatDate(broadcast.sentAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 ml-4">
                    <div className="text-center">
                      <p className={`text-xl font-bold ${textPrimary}`}>
                        {broadcast.stats.total}
                      </p>
                      <p className={`text-xs ${textTertiary}`}>Получателей</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-500">
                        {broadcast.stats.sent}
                      </p>
                      <p className={`text-xs ${textTertiary}`}>Доставлено</p>
                    </div>
                    {broadcast.stats.failed > 0 && (
                      <div className="text-center">
                        <p className="text-xl font-bold text-red-500">
                          {broadcast.stats.failed}
                        </p>
                        <p className={`text-xs ${textTertiary}`}>Ошибок</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${modalBg} rounded-2xl p-6 w-full max-w-lg border ${isDark ? "border-white/10" : "border-gray-200"}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${textPrimary}`}>Новая рассылка</h2>
              <button
                onClick={() => setShowModal(false)}
                className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors`}
              >
                <X className={`h-5 w-5 ${textSecondary}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Название рассылки
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Новогодняя акция"
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:border-blue-500`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Текст сообщения
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Напишите текст рассылки..."
                  rows={4}
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Получатели
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(segmentLabels).map(([key, { label, icon, color }]) => (
                    <button
                      key={key}
                      onClick={() => setTargetSegment(key)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        targetSegment === key
                          ? "bg-blue-600 text-white"
                          : `${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} ${textSecondary}`
                      }`}
                    >
                      <span className={targetSegment === key ? "text-white" : color}>
                        {icon}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`flex items-center gap-3 p-3 ${isDark ? "bg-white/5" : "bg-gray-100"} rounded-xl`}>
                <input
                  type="checkbox"
                  id="sendNow"
                  checked={sendNow}
                  onChange={(e) => setSendNow(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="sendNow" className={textSecondary}>
                  Отправить сразу
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className={`flex-1 px-4 py-3 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} ${textSecondary} rounded-xl font-medium transition-colors`}
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim() || !content.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sendNow ? "Отправить" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
