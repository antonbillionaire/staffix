"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  Search,
  Loader2,
  User,
  Bot,
  Clock,
  ChevronLeft,
  Phone,
  Instagram,
  Send,
  RefreshCw,
} from "lucide-react";

interface ConversationItem {
  id: string;
  name: string | null;
  channel: string;
  stage: string;
  messageCount: number;
  lastMessage: string;
  lastMessageRole: string;
  updatedAt: string;
  telegramUsername: string | null;
  whatsappPhone: string | null;
  instagramId: string | null;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const CHANNEL_META: Record<string, { label: string; color: string; bg: string; iconColor: string }> = {
  telegram: { label: "TG", color: "text-blue-400", bg: "bg-blue-500/20", iconColor: "text-blue-400" },
  whatsapp: { label: "WA", color: "text-green-400", bg: "bg-green-500/20", iconColor: "text-green-400" },
  instagram: { label: "IG", color: "text-pink-400", bg: "bg-pink-500/20", iconColor: "text-pink-400" },
};

const STAGE_META: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Новый" },
  interested: { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Заинтересован" },
  demo_requested: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Демо" },
  trial_started: { bg: "bg-green-500/10", text: "text-green-400", label: "Trial" },
  converted: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Конвертирован" },
  lost: { bg: "bg-gray-500/10", text: "text-gray-400", label: "Потерян" },
};

function ChannelIcon({ channel, className = "h-4 w-4" }: { channel: string; className?: string }) {
  const meta = CHANNEL_META[channel];
  const iconClass = `${className} ${meta?.iconColor || "text-gray-400"}`;
  switch (channel) {
    case "whatsapp":
      return <Phone className={iconClass} />;
    case "instagram":
      return <Instagram className={iconClass} />;
    default:
      return <Send className={iconClass} />;
  }
}

function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_META[stage] || { bg: "bg-gray-500/10", text: "text-gray-400", label: stage };
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export default function AdminMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterChannel !== "all") params.set("channel", filterChannel);
      const res = await fetch(`/api/admin/sales-conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [filterChannel]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = async (conv: ConversationItem) => {
    setLoadingMessages(true);
    setSelectedId(conv.id);
    setSelectedConv(conv);
    try {
      const res = await fetch(`/api/admin/sales-conversations?id=${conv.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.history || []);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }
    if (hours < 168) {
      return d.toLocaleDateString("ru-RU", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  const getDisplayName = (item: ConversationItem) => {
    if (item.name) return item.name;
    if (item.telegramUsername) return `@${item.telegramUsername}`;
    if (item.whatsappPhone) return item.whatsappPhone;
    if (item.instagramId) return `IG:${item.instagramId.slice(-6)}`;
    return `Лид #${item.id.slice(-4)}`;
  };

  const getContactInfo = (conv: ConversationItem) => {
    if (conv.telegramUsername) return `@${conv.telegramUsername}`;
    if (conv.whatsappPhone) return conv.whatsappPhone;
    if (conv.instagramId) return `ID: ${conv.instagramId}`;
    return "";
  };

  // Filter by search
  const filteredConversations = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.telegramUsername && c.telegramUsername.toLowerCase().includes(q)) ||
      (c.whatsappPhone && c.whatsappPhone.includes(q)) ||
      (c.instagramId && c.instagramId.includes(q)) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Сообщения (Sales Bot)</h1>
          <p className="text-gray-400">
            {conversations.length} переписок с Виктором
          </p>
        </div>
        <button
          onClick={fetchConversations}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      <div className="flex bg-[#12122a] border border-white/5 rounded-xl overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        {/* Left panel - conversation list */}
        <div className={`w-80 flex-shrink-0 border-r border-white/5 flex flex-col ${selectedId ? "hidden sm:flex" : "flex"}`}>
          {/* Search & filters */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени, username..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              />
            </div>
            {/* Channel filter buttons */}
            <div className="flex gap-1 mt-2">
              {[
                { key: "all", label: "Все" },
                { key: "telegram", label: "TG" },
                { key: "whatsapp", label: "WA" },
                { key: "instagram", label: "IG" },
              ].map((ch) => (
                <button
                  key={ch.key}
                  onClick={() => setFilterChannel(ch.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterChannel === ch.key
                      ? "bg-orange-500 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Нет переписок</p>
              </div>
            ) : (
              filteredConversations.map((item) => {
                const isSelected = selectedId === item.id;
                const meta = CHANNEL_META[item.channel] || CHANNEL_META.telegram;

                return (
                  <button
                    key={item.id}
                    onClick={() => fetchMessages(item)}
                    className={`w-full text-left p-3 border-b border-white/5 transition-colors ${
                      isSelected ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <ChannelIcon channel={item.channel} className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="font-medium text-sm text-white truncate">
                              {getDisplayName(item)}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 bg-white/10 text-gray-400`}>
                              {meta.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatTime(item.updatedAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <StageBadge stage={item.stage} />
                          <span className="text-xs text-gray-500">
                            {item.messageCount} сообщ.
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {item.lastMessageRole === "assistant" ? "Виктор: " : ""}
                          {item.lastMessage}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel - chat */}
        <div className={`flex-1 flex flex-col ${!selectedId ? "hidden sm:flex" : "flex"}`}>
          {selectedId && selectedConv ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <button
                  onClick={() => { setSelectedId(null); setSelectedConv(null); }}
                  className="sm:hidden p-2 hover:bg-white/5 rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-400" />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  CHANNEL_META[selectedConv.channel]?.bg || "bg-blue-500/20"
                }`}>
                  <ChannelIcon channel={selectedConv.channel} className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">
                      {getDisplayName(selectedConv)}
                    </p>
                    <StageBadge stage={selectedConv.stage} />
                  </div>
                  <p className="text-xs text-gray-400">
                    {CHANNEL_META[selectedConv.channel]?.label || selectedConv.channel}
                    {getContactInfo(selectedConv) && ` \u00B7 ${getContactInfo(selectedConv)}`}
                    {` \u00B7 ${messages.length} сообщений`}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p>Нет сообщений</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[75%] flex gap-2 ${msg.role === "user" ? "" : "flex-row-reverse"}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                          msg.role === "user" ? "bg-gray-700" : "bg-orange-500/20"
                        }`}>
                          {msg.role === "user" ? (
                            <User className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Bot className="h-4 w-4 text-orange-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-medium ${
                              msg.role === "user" ? "text-gray-500" : "text-orange-400"
                            }`}>
                              {msg.role === "user" ? getDisplayName(selectedConv) : "Виктор"}
                            </span>
                          </div>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                              msg.role === "user"
                                ? "bg-white/10 text-white"
                                : "bg-orange-600 text-white"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Выберите переписку</p>
                <p className="text-sm mt-1">Нажмите на лида слева чтобы увидеть диалог с Виктором</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
