"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
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
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Theme-aware styles
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-500" : "text-gray-500";
  const itemBg = isDark ? "bg-white/5" : "bg-gray-50";

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
      <div className={`text-center ${textSecondary} py-12`}>
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
          className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors ${textSecondary} hover:text-blue-500`}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className={`text-2xl font-bold ${textPrimary}`}>{customer.name}</h1>
            {customer.isVip && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 flex items-center gap-1">
                <Crown className="h-3 w-3" />
                VIP
              </span>
            )}
            {customer.isBlocked && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                Заблокирован
              </span>
            )}
          </div>
          {customer.phone && (
            <p className={`${textSecondary} flex items-center gap-1`}>
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
              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
              : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
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
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className={`text-xs ${textSecondary}`}>Визитов</span>
              </div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{customer.totalVisits}</p>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className={`text-xs ${textSecondary}`}>Потрачено</span>
              </div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{customer.totalSpent.toLocaleString()}₸</p>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span className={`text-xs ${textSecondary}`}>Сообщений</span>
              </div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{conversation?.messagesCount || 0}</p>
            </div>
            <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className={`text-xs ${textSecondary}`}>Рейтинг</span>
              </div>
              <p className={`text-2xl font-bold ${textPrimary}`}>
                {customer.avgRating ? customer.avgRating.toFixed(1) : "—"}
              </p>
            </div>
          </div>

          {/* Bookings */}
          <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
            <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>История записей</h2>
            {bookings.length === 0 ? (
              <p className={`${textTertiary} text-center py-4`}>Нет записей</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={`flex items-center gap-4 p-3 ${itemBg} rounded-lg`}
                  >
                    <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`${textPrimary} font-medium`}>
                        {booking.serviceName || "Услуга"}
                      </p>
                      <div className={`flex items-center gap-3 text-sm ${textSecondary}`}>
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
          <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
            <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Отзывы</h2>
            {reviews.length === 0 ? (
              <p className={`${textTertiary} text-center py-4`}>Нет отзывов</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className={`p-3 ${itemBg} rounded-lg`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "text-yellow-500 fill-yellow-500"
                                : isDark ? "text-gray-600" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs ${textTertiary}`}>
                        {formatShortDate(review.createdAt)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className={`${textSecondary} text-sm`}>{review.comment}</p>
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
          <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
            <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Информация</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={textSecondary}>Telegram ID</span>
                <span className={`${textPrimary} font-mono text-sm`}>{customer.telegramId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={textSecondary}>Первый контакт</span>
                <span className={`${textPrimary} text-sm`}>{formatShortDate(customer.createdAt)}</span>
              </div>
              {customer.lastVisitDate && (
                <div className="flex items-center justify-between">
                  <span className={textSecondary}>Последний визит</span>
                  <span className={`${textPrimary} text-sm`}>{formatShortDate(customer.lastVisitDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className={textSecondary}>Статус</span>
                <span className={`text-sm ${customer.isActive ? "text-green-500" : textSecondary}`}>
                  {customer.isActive ? "Активный" : "Неактивный"}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Messages */}
          <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
            <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Последние сообщения</h2>
            {!conversation || conversation.messages.length === 0 ? (
              <p className={`${textTertiary} text-center py-4`}>Нет сообщений</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {conversation.messages.slice(0, 10).map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-500/10 ml-4"
                        : `${itemBg} mr-4`
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {msg.role === "user" ? (
                        <User className="h-3 w-3 text-blue-500" />
                      ) : (
                        <Send className={`h-3 w-3 ${textSecondary}`} />
                      )}
                      <span className={`text-xs ${textTertiary}`}>
                        {msg.role === "user" ? "Клиент" : "Бот"}
                      </span>
                    </div>
                    <p className={`text-sm ${textSecondary} whitespace-pre-wrap`}>
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
