"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessagesSquare,
  Loader2,
  User,
  Bot,
  ChevronLeft,
  ChevronRight,
  Phone,
  Instagram,
  Send,
  RefreshCw,
  Building2,
  Facebook,
} from "lucide-react";

// ─── Типы ────────────────────────────────────────────────────────────────

interface BusinessItem {
  id: string;
  name: string;
  businessType: string | null;
  dashboardMode: string | null;
  country: string | null;
  conversationCount: number;
  messageCount: number;
  lastActivity: string | null;
}

interface ConversationItem {
  id: string;
  type: "tg" | "channel";
  channel: string;
  clientName: string;
  clientId: string;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
  outcome: string | null;
}

interface MessageItem {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  channel: string;
  clientName: string;
  clientId: string;
  businessName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  summary: string | null;
  topic: string | null;
  outcome: string | null;
}

const CHANNEL_META: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  telegram: { label: "Telegram", bg: "bg-blue-500/15", text: "text-blue-300" },
  whatsapp: { label: "WhatsApp", bg: "bg-green-500/15", text: "text-green-300" },
  instagram: { label: "Instagram", bg: "bg-pink-500/15", text: "text-pink-300" },
  facebook: { label: "Facebook", bg: "bg-indigo-500/15", text: "text-indigo-300" },
  messenger: { label: "Messenger", bg: "bg-indigo-500/15", text: "text-indigo-300" },
};

function ChannelIcon({ channel, className = "h-4 w-4" }: { channel: string; className?: string }) {
  switch (channel) {
    case "whatsapp":
      return <Phone className={`${className} text-green-400`} />;
    case "instagram":
      return <Instagram className={`${className} text-pink-400`} />;
    case "facebook":
    case "messenger":
      return <Facebook className={`${className} text-indigo-400`} />;
    default:
      return <Send className={`${className} text-blue-400`} />;
  }
}

function ChannelBadge({ channel }: { channel: string }) {
  const m = CHANNEL_META[channel] || {
    label: channel,
    bg: "bg-gray-500/15",
    text: "text-gray-300",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${m.bg} ${m.text}`}
    >
      {m.label}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "только что";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} мин назад`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} дн. назад`;
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Главный компонент ───────────────────────────────────────────────────

export default function AdminConversationsPage() {
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessItem | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [convDetail, setConvDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);

  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ─── Загрузка списка бизнесов ──────────────────────────────────────────
  const fetchBusinesses = useCallback(async () => {
    setLoadingBusinesses(true);
    try {
      const res = await fetch("/api/admin/conversations");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBusinesses(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  // ─── Загрузка диалогов выбранного бизнеса ──────────────────────────────
  const fetchConversations = useCallback(async (businessId: string) => {
    setLoadingConversations(true);
    setConversations([]);
    setSelectedConv(null);
    setMessages([]);
    setConvDetail(null);
    try {
      const res = await fetch(`/api/admin/conversations?businessId=${businessId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // ─── Загрузка сообщений конкретного диалога ────────────────────────────
  const fetchMessages = useCallback(async (conv: ConversationItem) => {
    setLoadingMessages(true);
    setMessages([]);
    setConvDetail(null);
    try {
      const res = await fetch(
        `/api/admin/conversations?conversationId=${conv.id}&type=${conv.type}`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setConvDetail(data.conversation);
      setMessages(data.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ─── Рендер ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-[1600px] mx-auto p-6">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MessagesSquare className="h-7 w-7 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">Переписки клиентов</h1>
              <p className="text-sm text-zinc-400">
                Общение AI-ботов наших пользователей с их клиентами. PII маскируется автоматически.
              </p>
            </div>
          </div>
          <button
            onClick={fetchBusinesses}
            disabled={loadingBusinesses}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loadingBusinesses ? "animate-spin" : ""}`} />
            Обновить
          </button>
        </div>

        {/* Трёхколоночная сетка */}
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-180px)]">
          {/* Колонка 1: бизнесы */}
          <div className="col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
              Бизнесы ({businesses.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingBusinesses ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                </div>
              ) : businesses.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500 text-center">
                  Нет бизнесов с диалогами
                </div>
              ) : (
                businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBusiness(b);
                      fetchConversations(b.id);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition ${
                      selectedBusiness?.id === b.id ? "bg-zinc-800/70" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{b.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 ml-5">
                      <span>{b.conversationCount} диалогов</span>
                      <span>·</span>
                      <span>{b.messageCount} сообщ.</span>
                    </div>
                    <div className="ml-5 text-[11px] text-zinc-600 mt-0.5">
                      {fmtDate(b.lastActivity)}
                      {b.dashboardMode === "sales" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                          sales
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Колонка 2: диалоги */}
          <div className="col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
              {selectedBusiness ? (
                <>
                  <span className="truncate">Диалоги — {selectedBusiness.name}</span>
                  <span className="text-zinc-600">({conversations.length})</span>
                </>
              ) : (
                "Выберите бизнес слева"
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {!selectedBusiness ? (
                <div className="p-4 text-sm text-zinc-500 text-center">
                  ←
                </div>
              ) : loadingConversations ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500 text-center">
                  Диалогов пока нет
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={`${c.type}-${c.id}`}
                    onClick={() => {
                      setSelectedConv(c);
                      fetchMessages(c);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition ${
                      selectedConv?.id === c.id ? "bg-zinc-800/70" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ChannelIcon channel={c.channel} className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{c.clientName}</span>
                      <ChannelBadge channel={c.channel} />
                    </div>
                    <div className="text-[11px] text-zinc-500 ml-5 truncate">
                      {c.clientId}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-600 ml-5 mt-0.5">
                      <span>{c.messageCount} сообщ.</span>
                      <span>·</span>
                      <span>{fmtDate(c.updatedAt)}</span>
                      {c.outcome && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400">{c.outcome}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Колонка 3: сообщения */}
          <div className="col-span-6 bg-zinc-900/50 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
            {!selectedConv ? (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                Выберите диалог чтобы посмотреть переписку
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => {
                        setSelectedConv(null);
                        setMessages([]);
                        setConvDetail(null);
                      }}
                      className="lg:hidden p-1 hover:bg-zinc-800 rounded"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <ChannelIcon channel={selectedConv.channel} />
                    <span className="font-semibold">{selectedConv.clientName}</span>
                    <ChannelBadge channel={selectedConv.channel} />
                    <ChevronRight className="h-3 w-3 text-zinc-600" />
                    <span className="text-zinc-400 text-sm">
                      {convDetail?.businessName || selectedBusiness?.name}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 ml-6 flex items-center gap-3 flex-wrap">
                    <span>{selectedConv.clientId}</span>
                    <span>·</span>
                    <span>{selectedConv.messageCount} сообщ.</span>
                    <span>·</span>
                    <span>Открыт {fmtDate(selectedConv.createdAt)}</span>
                    {convDetail?.topic && (
                      <>
                        <span>·</span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {convDetail.topic}
                        </span>
                      </>
                    )}
                  </div>
                  {convDetail?.summary && (
                    <div className="mt-3 ml-6 text-xs text-zinc-400 italic bg-zinc-800/50 rounded p-2">
                      📝 {convDetail.summary}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-sm text-zinc-500 text-center py-8">
                      Сообщений нет
                    </div>
                  ) : (
                    messages.map((m) => (
                      <MessageBubble key={m.id} message={m} />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Сообщение ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: MessageItem }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-blue-500/20 text-blue-300" : "bg-purple-500/20 text-purple-300"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs font-medium ${
              isUser ? "text-blue-300" : "text-purple-300"
            }`}
          >
            {isUser ? "Клиент" : "Бот"}
          </span>
          <span className="text-[11px] text-zinc-600">{fmtTime(message.createdAt)}</span>
        </div>
        <div
          className={`text-sm whitespace-pre-wrap break-words rounded-lg px-3 py-2 ${
            isUser ? "bg-blue-500/10 text-zinc-200" : "bg-zinc-800/70 text-zinc-100"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
