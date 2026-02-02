"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Phone,
  Calendar,
  MessageSquare,
  Star,
  Clock,
  Crown,
  Ban,
  CheckCircle,
  DollarSign,
  User,
  Send,
} from "lucide-react";

interface CustomerDetail {
  customer: {
    id: string;
    telegramId: string;
    name: string;
    phone: string | null;
    totalVisits: number;
    lastVisitDate: string | null;
    isBlocked: boolean;
    createdAt: string;
    isActive: boolean;
    isVip: boolean;
    segment: string;
    avgRating: number | null;
    totalSpent: number;
  };
  conversation: {
    id: string;
    messagesCount: number;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
  } | null;
  bookings: Array<{
    id: string;
    date: string;
    status: string;
    serviceName: string | null;
    servicePrice: number | null;
    staffName: string | null;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }>;
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${id}`);
      if (res.ok) {
        const customerData = await res.json();
        setData(customerData);
      } else if (res.status === 404) {
        router.push("/dashboard/customers");
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !data.customer.isBlocked }),
      });
      if (res.ok) {
        fetchCustomer();
      }
    } catch (error) {
      console.error("Error toggling block:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Ожидает" },
      confirmed: { bg: "bg-green-500/10", text: "text-green-400", label: "Подтверждено" },
      cancelled: { bg: "bg-red-500/10", text: "text-red-400", label: "Отменено" },
      completed: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Завершено" },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-400 py-12">
        Клиент не найден
      </div>
    );
  }

  const { customer, conversation, bookings, reviews } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/customers"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
            {customer.isVip && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 flex items-center gap-1">
                <Crown className="h-3 w-3" />
                VIP
              </span>
            )}
            {customer.isBlocked && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
                Заблокирован
              </span>
            )}
          </div>
          {customer.phone && (
            <p className="text-gray-400 flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {customer.phone}
            </p>
          )}
        </div>
        <button
          onClick={toggleBlock}
          disabled={actionLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
            customer.isBlocked
              ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
              : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
          }`}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : customer.isBlocked ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Ban className="h-4 w-4" />
          )}
          {customer.isBlocked ? "Разблокировать" : "Заблокировать"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Stats & Bookings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-gray-400">Визитов</span>
              </div>
              <p className="text-2xl font-bold text-white">{customer.totalVisits}</p>
            </div>
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="text-xs text-gray-400">Потрачено</span>
              </div>
              <p className="text-2xl font-bold text-white">{customer.totalSpent.toLocaleString()}₸</p>
            </div>
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-purple-400" />
                <span className="text-xs text-gray-400">Сообщений</span>
              </div>
              <p className="text-2xl font-bold text-white">{conversation?.messagesCount || 0}</p>
            </div>
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-yellow-400" />
                <span className="text-xs text-gray-400">Рейтинг</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {customer.avgRating ? customer.avgRating.toFixed(1) : "—"}
              </p>
            </div>
          </div>

          {/* Bookings */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">История записей</h2>
            {bookings.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Нет записей</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center gap-4 p-3 bg-white/5 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">
                        {booking.serviceName || "Услуга"}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span>{formatShortDate(booking.date)}</span>
                        {booking.staffName && <span>• {booking.staffName}</span>}
                        {booking.servicePrice && (
                          <span>• {booking.servicePrice.toLocaleString()}₸</span>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviews */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Отзывы</h2>
            {reviews.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Нет отзывов</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-600"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatShortDate(review.createdAt)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-gray-300 text-sm">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column - Info & Messages */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Информация</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Telegram ID</span>
                <span className="text-white font-mono text-sm">{customer.telegramId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Первый контакт</span>
                <span className="text-white text-sm">{formatShortDate(customer.createdAt)}</span>
              </div>
              {customer.lastVisitDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Последний визит</span>
                  <span className="text-white text-sm">{formatShortDate(customer.lastVisitDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Статус</span>
                <span className={`text-sm ${customer.isActive ? "text-green-400" : "text-gray-400"}`}>
                  {customer.isActive ? "Активный" : "Неактивный"}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Messages */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Последние сообщения</h2>
            {!conversation || conversation.messages.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Нет сообщений</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {conversation.messages.slice(0, 10).map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-500/10 ml-4"
                        : "bg-white/5 mr-4"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === "user" ? (
                        <User className="h-3 w-3 text-blue-400" />
                      ) : (
                        <Send className="h-3 w-3 text-gray-400" />
                      )}
                      <span className="text-xs text-gray-500">
                        {msg.role === "user" ? "Клиент" : "Бот"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                      {msg.content.length > 200
                        ? msg.content.substring(0, 200) + "..."
                        : msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
