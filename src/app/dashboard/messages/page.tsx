"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Mail,
  Send,
  Loader2,
  MessageSquare,
  Clock,
  ChevronLeft,
  CheckCircle,
  Circle,
  CheckCheck,
  RotateCcw,
} from "lucide-react";

interface SupportMessage {
  id: string;
  content: string;
  isFromSupport: boolean;
  isRead?: boolean;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

export default function MessagesPage() {
  const { theme } = useTheme();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedTicketIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedTicketIdRef.current = selectedTicket?.id || null;
  }, [selectedTicket]);

  // Theme-based classes
  const isDark = theme === "dark";
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/support");
      if (res.ok) {
        const data = await res.json();
        const newTickets = data.tickets || [];
        setTickets(newTickets);

        // Update selected ticket if it exists in new data
        if (selectedTicketIdRef.current) {
          const updated = newTickets.find((t: SupportTicket) => t.id === selectedTicketIdRef.current);
          if (updated) {
            setSelectedTicket(updated);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedTicket?.messages]);

  // Mark messages as read when selecting a ticket
  const selectTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);

    // Check if there are unread messages from support
    const hasUnread = ticket.messages.some(m => m.isFromSupport && !m.isRead);

    if (hasUnread) {
      try {
        await fetch(`/api/support/${ticket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markAsRead" }),
        });
        // Refresh to update unread count in sidebar
        fetchTickets();
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;

    setSending(true);
    try {
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local state
        setSelectedTicket({
          ...selectedTicket,
          messages: [...selectedTicket.messages, data.message],
          status: selectedTicket.status === "resolved" ? "open" : selectedTicket.status,
        });
        setNewMessage("");
        // Refresh tickets list
        fetchTickets();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket) return;

    setResolving(true);
    try {
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });

      if (res.ok) {
        setSelectedTicket({
          ...selectedTicket,
          status: "resolved",
        });
        fetchTickets();
      }
    } catch (error) {
      console.error("Error resolving ticket:", error);
    } finally {
      setResolving(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;

    setResolving(true);
    try {
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });

      if (res.ok) {
        setSelectedTicket({
          ...selectedTicket,
          status: "open",
        });
        fetchTickets();
      }
    } catch (error) {
      console.error("Error reopening ticket:", error);
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Вчера";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("ru", { weekday: "short" });
    } else {
      return date.toLocaleDateString("ru", { day: "numeric", month: "short" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "closed":
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
      case "resolved":
        return <CheckCheck className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "closed":
        return "Закрыт";
      case "resolved":
        return "Решён";
      case "in_progress":
        return "В работе";
      default:
        return "Открыт";
    }
  };

  // Check if ticket has unread messages from support
  const hasUnreadMessages = (ticket: SupportTicket) => {
    return ticket.messages.some(m => m.isFromSupport && !m.isRead);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className={`text-xl font-semibold ${textPrimary}`}>Сообщения</h2>
        <p className={`text-sm ${textSecondary}`}>
          Ваши обращения в поддержку и ответы
        </p>
      </div>

      <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
        <div className="flex h-[600px]">
          {/* Tickets list */}
          <div className={`w-80 border-r ${borderColor} flex flex-col ${selectedTicket ? 'hidden md:flex' : 'flex w-full md:w-80'}`}>
            <div className={`p-4 border-b ${borderColor}`}>
              <h3 className={`font-medium ${textPrimary}`}>Обращения</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
              {tickets.length === 0 ? (
                <div className="p-8 text-center">
                  <Mail className={`h-12 w-12 ${textSecondary} mx-auto mb-3`} />
                  <p className={textSecondary}>Нет обращений</p>
                  <p className={`text-sm ${textSecondary} mt-1`}>
                    Создайте обращение на странице Помощь
                  </p>
                </div>
              ) : (
                tickets.map((ticket) => {
                  const lastMessage = ticket.messages[ticket.messages.length - 1];
                  const unread = hasUnreadMessages(ticket);

                  return (
                    <button
                      key={ticket.id}
                      onClick={() => selectTicket(ticket)}
                      className={`w-full p-4 text-left border-b ${borderColor} hover:${isDark ? 'bg-white/5' : 'bg-gray-50'} transition-colors ${
                        selectedTicket?.id === ticket.id ? (isDark ? 'bg-white/10' : 'bg-blue-50') : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {unread && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                            )}
                            <p className={`font-medium ${textPrimary} truncate`}>
                              {ticket.subject}
                            </p>
                          </div>
                          <p className={`text-sm ${textSecondary} truncate mt-1`}>
                            {lastMessage?.content || "Нет сообщений"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs ${textSecondary}`}>
                            {formatDate(ticket.updatedAt)}
                          </span>
                          {getStatusIcon(ticket.status)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col ${!selectedTicket ? 'hidden md:flex' : 'flex'}`}>
            {selectedTicket ? (
              <>
                {/* Header */}
                <div className={`p-4 border-b ${borderColor} flex items-center gap-3`}>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className={`md:hidden ${textSecondary} hover:${textPrimary}`}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex-1">
                    <h3 className={`font-medium ${textPrimary}`}>{selectedTicket.subject}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(selectedTicket.status)}
                      <span className={`text-sm ${textSecondary}`}>
                        {getStatusLabel(selectedTicket.status)}
                      </span>
                    </div>
                  </div>

                  {/* Resolve/Reopen button */}
                  {selectedTicket.status !== "closed" && (
                    selectedTicket.status === "resolved" ? (
                      <button
                        onClick={handleReopenTicket}
                        disabled={resolving}
                        className={`px-3 py-1.5 text-sm rounded-lg border ${borderColor} ${textSecondary} hover:${isDark ? 'bg-white/5' : 'bg-gray-50'} transition-colors flex items-center gap-1.5`}
                      >
                        {resolving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        Переоткрыть
                      </button>
                    ) : (
                      <button
                        onClick={handleResolveTicket}
                        disabled={resolving}
                        className="px-3 py-1.5 text-sm rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors flex items-center gap-1.5"
                      >
                        {resolving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCheck className="h-4 w-4" />
                        )}
                        Проблема решена
                      </button>
                    )
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedTicket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isFromSupport ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.isFromSupport
                            ? isDark ? 'bg-white/10' : 'bg-gray-100'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        }`}
                      >
                        {message.isFromSupport && (
                          <p className="text-xs text-blue-500 font-medium mb-1">
                            Поддержка Staffix
                          </p>
                        )}
                        <p className={`text-sm ${message.isFromSupport ? textPrimary : 'text-white'} whitespace-pre-wrap`}>
                          {message.content}
                        </p>
                        <div className={`flex items-center gap-1 mt-1`}>
                          <span className={`text-xs ${message.isFromSupport ? textSecondary : 'text-white/70'}`}>
                            {new Date(message.createdAt).toLocaleString("ru", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {/* Show read status for user messages */}
                          {!message.isFromSupport && (
                            <CheckCheck className={`h-3.5 w-3.5 text-white/70`} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input or status message */}
                {selectedTicket.status === "closed" ? (
                  <div className={`p-4 border-t ${borderColor} text-center`}>
                    <p className={`text-sm ${textSecondary}`}>
                      Этот тикет закрыт администратором. Создайте новое обращение если вопрос не решён.
                    </p>
                  </div>
                ) : selectedTicket.status === "resolved" ? (
                  <div className={`p-4 border-t ${borderColor}`}>
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-green-500/10' : 'bg-green-50'} text-center`}>
                      <p className="text-sm text-green-600">
                        Вы отметили проблему как решённую. Если вопрос снова возник — напишите сообщение.
                      </p>
                    </div>
                    <form onSubmit={handleSendMessage} className="mt-3">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Написать снова..."
                          className={`flex-1 px-4 py-3 ${inputBg} border ${borderColor} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        <button
                          type="submit"
                          disabled={sending || !newMessage.trim()}
                          className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {sending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Send className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className={`p-4 border-t ${borderColor}`}>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Введите сообщение..."
                        className={`flex-1 px-4 py-3 ${inputBg} border ${borderColor} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      <button
                        type="submit"
                        disabled={sending || !newMessage.trim()}
                        className="px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {sending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className={`h-16 w-16 ${textSecondary} mx-auto mb-4`} />
                  <p className={`text-lg font-medium ${textPrimary}`}>
                    Выберите обращение
                  </p>
                  <p className={`text-sm ${textSecondary} mt-1`}>
                    Или создайте новое на странице Помощь
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
