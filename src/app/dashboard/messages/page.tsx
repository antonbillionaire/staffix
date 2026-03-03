"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
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
  Facebook,
  Send,
} from "lucide-react";

interface ConversationItem {
  clientId: string;
  clientName: string | null;
  channel: "telegram" | "whatsapp" | "instagram" | "facebook";
  lastMessage: string;
  lastMessageRole: string;
  lastMessageAt: string;
  totalMessages: number;
  // Backwards compatibility
  clientTelegramId?: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

const CHANNEL_META: Record<string, { label: string; color: string; bg: string; iconColor: string }> = {
  telegram: { label: "TG", color: "text-blue-400", bg: "bg-blue-500/20", iconColor: "text-blue-400" },
  whatsapp: { label: "WA", color: "text-green-400", bg: "bg-green-500/20", iconColor: "text-green-400" },
  instagram: { label: "IG", color: "text-pink-400", bg: "bg-pink-500/20", iconColor: "text-pink-400" },
  facebook: { label: "FB", color: "text-blue-500", bg: "bg-blue-600/20", iconColor: "text-blue-500" },
};

function ChannelIcon({ channel, className = "h-4 w-4" }: { channel: string; className?: string }) {
  const meta = CHANNEL_META[channel];
  const iconClass = `${className} ${meta?.iconColor || "text-gray-400"}`;
  switch (channel) {
    case "whatsapp":
      return <Phone className={iconClass} />;
    case "instagram":
      return <Instagram className={iconClass} />;
    case "facebook":
      return <Facebook className={iconClass} />;
    default:
      return <Send className={iconClass} />;
  }
}

export default function MessagesPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [clientName, setClientName] = useState<string | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-500" : "text-gray-500";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  const activeBg = isDark ? "bg-white/10" : "bg-blue-50";

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterChannel) params.set("channel", filterChannel);
      const res = await fetch(`/api/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [search, filterChannel]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = async (clientId: string, channel: string) => {
    setLoadingMessages(true);
    setSelectedClient(clientId);
    setSelectedChannel(channel);
    try {
      const res = await fetch(`/api/conversations?clientId=${encodeURIComponent(clientId)}&channel=${channel}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setClientName(data.clientName || null);
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
    if (item.clientName) return item.clientName;
    const id = item.clientId || item.clientTelegramId || "";
    return `Клиент #${id.slice(-4)}`;
  };

  const getUniqueKey = (item: ConversationItem) => {
    return `${item.channel}:${item.clientId || item.clientTelegramId}`;
  };

  // Channel filter tabs
  const channelCounts: Record<string, number> = {};
  for (const c of conversations) {
    channelCounts[c.channel] = (channelCounts[c.channel] || 0) + 1;
  }

  return (
    <div className="h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-4">
        <h1 className={`text-2xl font-bold ${textPrimary}`}>Сообщения</h1>
        <p className={textSecondary}>Переписки AI-сотрудника с клиентами</p>
      </div>

      <div className={`flex-1 flex ${cardBg} border ${borderColor} rounded-xl overflow-hidden min-h-0`}>
        {/* Left panel — client list */}
        <div className={`w-80 flex-shrink-0 border-r ${borderColor} flex flex-col ${selectedClient ? "hidden sm:flex" : "flex"}`}>
          {/* Search */}
          <div className={`p-3 border-b ${borderColor}`}>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${textTertiary}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск клиента..."
                className={`w-full pl-9 pr-3 py-2 ${isDark ? "bg-white/5" : "bg-gray-50"} border ${isDark ? "border-white/10" : "border-gray-300"} rounded-lg ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm`}
              />
            </div>
            {/* Channel filter */}
            <div className="flex gap-1 mt-2 flex-wrap">
              <button
                onClick={() => setFilterChannel("")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  !filterChannel
                    ? "bg-blue-500 text-white"
                    : isDark
                    ? "bg-white/5 text-gray-400 hover:bg-white/10"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Все
              </button>
              {Object.entries(CHANNEL_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setFilterChannel(key === filterChannel ? "" : key)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterChannel === key
                      ? "bg-blue-500 text-white"
                      : isDark
                      ? "bg-white/5 text-gray-400 hover:bg-white/10"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className={`text-center py-12 px-4 ${textSecondary}`}>
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Нет переписок</p>
                <p className="text-xs mt-1">Переписки появятся когда клиенты напишут боту</p>
              </div>
            ) : (
              conversations.map((item) => {
                const itemKey = getUniqueKey(item);
                const isSelected = selectedClient === (item.clientId || item.clientTelegramId) && selectedChannel === item.channel;
                const meta = CHANNEL_META[item.channel] || CHANNEL_META.telegram;

                return (
                  <button
                    key={itemKey}
                    onClick={() => fetchMessages(item.clientId || item.clientTelegramId || "", item.channel)}
                    className={`w-full text-left p-3 border-b ${borderColor} transition-colors ${
                      isSelected ? activeBg : hoverBg
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <ChannelIcon channel={item.channel} className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={`font-medium text-sm ${textPrimary} truncate`}>
                              {getDisplayName(item)}
                            </p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              isDark ? "bg-white/10 text-gray-400" : "bg-gray-100 text-gray-500"
                            }`}>
                              {meta.label}
                            </span>
                          </div>
                          <span className={`text-xs ${textTertiary} flex-shrink-0`}>
                            {formatTime(item.lastMessageAt)}
                          </span>
                        </div>
                        <p className={`text-xs ${textSecondary} truncate mt-0.5`}>
                          {item.lastMessageRole === "assistant" ? "Бот: " : ""}
                          {item.lastMessage}
                        </p>
                        <p className={`text-xs ${textTertiary} mt-0.5`}>
                          {item.totalMessages} сообщ.
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel — chat */}
        <div className={`flex-1 flex flex-col ${!selectedClient ? "hidden sm:flex" : "flex"}`}>
          {selectedClient ? (
            <>
              {/* Chat header */}
              <div className={`p-4 border-b ${borderColor} flex items-center gap-3`}>
                <button
                  onClick={() => { setSelectedClient(null); setSelectedChannel(null); }}
                  className={`sm:hidden p-2 ${hoverBg} rounded-lg`}
                >
                  <ChevronLeft className={`h-5 w-5 ${textSecondary}`} />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  CHANNEL_META[selectedChannel || "telegram"]?.bg || "bg-blue-500/20"
                }`}>
                  <ChannelIcon channel={selectedChannel || "telegram"} className="h-5 w-5" />
                </div>
                <div>
                  <p className={`font-medium ${textPrimary}`}>
                    {clientName || `Клиент #${selectedClient.slice(-4)}`}
                  </p>
                  <p className={`text-xs ${textSecondary}`}>
                    {CHANNEL_META[selectedChannel || "telegram"]?.label || "Telegram"} &middot; {selectedClient}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className={`text-center py-12 ${textSecondary}`}>
                    <p>Нет сообщений</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[75%] flex gap-2 ${msg.role === "user" ? "" : "flex-row-reverse"}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                          msg.role === "user"
                            ? isDark ? "bg-gray-700" : "bg-gray-200"
                            : isDark ? "bg-blue-500/20" : "bg-blue-100"
                        }`}>
                          {msg.role === "user" ? (
                            <User className={`h-4 w-4 ${textSecondary}`} />
                          ) : (
                            <Bot className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                              msg.role === "user"
                                ? isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-900"
                                : "bg-blue-600 text-white"
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1 mt-1 ${msg.role === "user" ? "" : "justify-end"}`}>
                            <Clock className={`h-3 w-3 ${textTertiary}`} />
                            <span className={`text-xs ${textTertiary}`}>
                              {formatTime(msg.createdAt)}
                            </span>
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
            <div className={`flex-1 flex items-center justify-center ${textSecondary}`}>
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Выберите клиента</p>
                <p className="text-sm mt-1">Нажмите на клиента слева чтобы увидеть переписку</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
