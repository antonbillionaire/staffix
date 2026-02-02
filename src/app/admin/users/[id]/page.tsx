"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Bot,
  MessageSquare,
  Clock,
  Crown,
  Plus,
  RefreshCw,
  Zap,
  Users,
  Scissors,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

interface UserDetail {
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    emailVerified: boolean;
  };
  business: {
    id: string;
    name: string;
    description: string | null;
    phone: string | null;
    address: string | null;
    botActive: boolean;
    botToken: string | null;
    botUsername: string | null;
    onboardingCompleted: boolean;
    createdAt: string;
    counts: {
      bookings: number;
      conversations: number;
      services: number;
      staff: number;
    };
    services: Array<{
      id: string;
      name: string;
      price: number;
      duration: number;
    }>;
    staff: Array<{
      id: string;
      name: string;
      role: string | null;
    }>;
  } | null;
  subscription: {
    id: string;
    plan: string;
    messagesUsed: number;
    messagesLimit: number;
    expiresAt: string;
    createdAt: string;
    isExpired: boolean;
    daysLeft: number;
  } | null;
  timeline: Array<{
    id: string;
    type: "booking" | "conversation";
    date: string;
    description: string;
    status?: string;
    messagesCount?: number;
  }>;
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserDetail | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.ok) {
        const userData = await res.json();
        setData(userData);
      } else if (res.status === 404) {
        router.push("/admin/users");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: string, actionData?: Record<string, unknown>) => {
    setActionLoading(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: actionData }),
      });
      const result = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: result.message });
        fetchUser();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    } catch {
      setMessage({ type: "error", text: "Ошибка выполнения действия" });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const getPlanBadge = (plan: string, isExpired: boolean) => {
    if (isExpired) {
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30">
          Истёк
        </span>
      );
    }

    const badges: Record<string, { bg: string; text: string; label: string; border: string }> = {
      trial: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", label: "Trial" },
      pro: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", label: "Pro" },
      business: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30", label: "Business" },
    };
    const badge = badges[plan] || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30", label: plan };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text} border ${badge.border}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-400 py-12">
        Пользователь не найден
      </div>
    );
  }

  const { user, business, subscription, timeline } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{user.name}</h1>
          <p className="text-gray-400">{user.email}</p>
        </div>
        <button
          onClick={fetchUser}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Обновить
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - User & Business info */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Info */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Информация о пользователе</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white">{user.email}</p>
                    <button
                      onClick={() => copyToClipboard(user.email)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Регистрация</p>
                  <p className="text-white">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Business Info */}
          {business && (
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Бизнес</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xl font-bold text-white">{business.name}</p>
                  {business.description && (
                    <p className="text-gray-400 mt-1">{business.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <Scissors className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-white">{business.counts.services}</p>
                    <p className="text-xs text-gray-500">Услуг</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <Users className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-white">{business.counts.staff}</p>
                    <p className="text-xs text-gray-500">Сотрудников</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <Calendar className="h-5 w-5 text-green-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-white">{business.counts.bookings}</p>
                    <p className="text-xs text-gray-500">Записей</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <MessageSquare className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                    <p className="text-xl font-bold text-white">{business.counts.conversations}</p>
                    <p className="text-xs text-gray-500">Диалогов</p>
                  </div>
                </div>

                {(business.phone || business.address) && (
                  <div className="flex flex-wrap gap-4 pt-2">
                    {business.phone && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Phone className="h-4 w-4" />
                        <span>{business.phone}</span>
                      </div>
                    )}
                    {business.address && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <MapPin className="h-4 w-4" />
                        <span>{business.address}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bot status */}
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bot className={`h-5 w-5 ${business.botActive ? "text-green-400" : "text-gray-500"}`} />
                      <div>
                        <p className="text-white font-medium">Telegram бот</p>
                        {business.botUsername ? (
                          <a
                            href={`https://t.me/${business.botUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            @{business.botUsername}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="text-sm text-gray-500">Не подключён</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        business.botActive
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {business.botActive ? "Активен" : "Неактивен"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Последняя активность</h2>
            {timeline.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Нет активности</p>
            ) : (
              <div className="space-y-3">
                {timeline.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.type === "booking"
                          ? "bg-green-500/10"
                          : "bg-blue-500/10"
                      }`}
                    >
                      {item.type === "booking" ? (
                        <Calendar className="h-4 w-4 text-green-400" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {formatDate(item.date)}
                        </span>
                        {item.status && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              item.status === "confirmed"
                                ? "bg-green-500/10 text-green-400"
                                : item.status === "cancelled"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            {item.status === "confirmed"
                              ? "Подтверждено"
                              : item.status === "cancelled"
                              ? "Отменено"
                              : "Ожидает"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column - Subscription & Actions */}
        <div className="space-y-6">
          {/* Subscription */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Подписка</h2>
            {subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">План</span>
                  {getPlanBadge(subscription.plan, subscription.isExpired)}
                </div>

                {subscription.isExpired && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-red-400">Подписка истекла</span>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Сообщений</span>
                    <span className="text-white">
                      {subscription.messagesUsed}/{subscription.messagesLimit}
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (subscription.messagesUsed / subscription.messagesLimit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Истекает</span>
                  <span className={subscription.isExpired ? "text-red-400" : "text-white"}>
                    {formatDate(subscription.expiresAt)}
                  </span>
                </div>

                {!subscription.isExpired && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Осталось</span>
                    <span className={subscription.daysLeft <= 3 ? "text-yellow-400" : "text-white"}>
                      {subscription.daysLeft} дней
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Нет подписки</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Быстрые действия</h2>
            <div className="space-y-3">
              <button
                onClick={() => performAction("extend_trial", { days: 7 })}
                disabled={actionLoading !== null}
                className="flex items-center justify-between w-full px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>+7 дней триала</span>
                </div>
                {actionLoading === "extend_trial" && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>

              <button
                onClick={() => performAction("add_messages", { messages: 100 })}
                disabled={actionLoading !== null}
                className="flex items-center justify-between w-full px-4 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>+100 сообщений</span>
                </div>
                {actionLoading === "add_messages" && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>

              <button
                onClick={() => performAction("reset_messages")}
                disabled={actionLoading !== null}
                className="flex items-center justify-between w-full px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Сбросить счётчик</span>
                </div>
                {actionLoading === "reset_messages" && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>

              <div className="pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500 mb-3">Изменить план</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => performAction("upgrade_plan", { plan: "pro" })}
                    disabled={actionLoading !== null}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 text-sm transition-colors disabled:opacity-50"
                  >
                    <Crown className="h-4 w-4" />
                    Pro
                  </button>
                  <button
                    onClick={() => performAction("upgrade_plan", { plan: "business" })}
                    disabled={actionLoading !== null}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm transition-colors disabled:opacity-50"
                  >
                    <Zap className="h-4 w-4" />
                    Business
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Связаться</h2>
            <a
              href={`mailto:${user.email}`}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:opacity-90 rounded-lg text-white font-medium transition-opacity"
            >
              <Mail className="h-4 w-4" />
              Написать email
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
