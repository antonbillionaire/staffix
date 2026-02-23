"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ShoppingBag, Phone, MapPin, ChevronDown, ChevronUp, Check, Truck, X, Clock, AlertCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: number;
  clientName: string;
  clientPhone: string | null;
  clientAddress: string | null;
  clientNotes: string | null;
  totalPrice: number;
  status: string;
  paymentMethod: string | null;
  isPaid: boolean;
  items: OrderItem[];
  createdAt: string;
}

const STATUSES: { id: string; label: string; color: string; icon: React.ReactNode }[] = [
  { id: "new", label: "Новый", color: "bg-blue-500/20 text-blue-400", icon: <AlertCircle className="w-3 h-3" /> },
  { id: "confirmed", label: "Подтверждён", color: "bg-green-500/20 text-green-400", icon: <Check className="w-3 h-3" /> },
  { id: "processing", label: "В обработке", color: "bg-yellow-500/20 text-yellow-500", icon: <Clock className="w-3 h-3" /> },
  { id: "shipped", label: "Отправлен", color: "bg-purple-500/20 text-purple-400", icon: <Truck className="w-3 h-3" /> },
  { id: "delivered", label: "Доставлен", color: "bg-emerald-500/20 text-emerald-400", icon: <Check className="w-3 h-3" /> },
  { id: "cancelled", label: "Отменён", color: "bg-red-500/20 text-red-400", icon: <X className="w-3 h-3" /> },
];

export default function OrdersPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [stats, setStats] = useState<Array<{ status: string; _count: number; _sum: { totalPrice: number } }>>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus
        ? `/api/orders?status=${filterStatus}&limit=50`
        : "/api/orders?limit=50";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setStats(data.stats || []);
      }
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  const togglePaid = async (order: Order) => {
    setUpdatingId(order.id);
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !order.isPaid }),
      });
      fetchOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusInfo = (status: string) => STATUSES.find((s) => s.id === status) || STATUSES[0];

  const totalRevenue = stats
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + (s._sum.totalPrice || 0), 0);
  const totalOrders = stats.reduce((sum, s) => sum + s._count, 0);
  const newCount = stats.find((s) => s.status === "new")?._count || 0;

  // Стили
  const bg = isDark ? "bg-gray-900" : "bg-gray-50";
  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark
    ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500"
    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500";

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bg}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`${bg} min-h-screen p-6`}>
      <div className="max-w-5xl mx-auto">
        {/* Заголовок */}
        <div className="mb-6">
          <h1 className={`text-2xl font-bold ${text}`}>Заказы</h1>
          <p className={`mt-1 text-sm ${sub}`}>
            Все заказы от AI-продавца. Управляй статусами — клиент получает уведомление в Telegram.
          </p>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={`${card} border rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${text}`}>{totalOrders}</p>
            <p className={`text-sm ${sub}`}>Всего заказов</p>
          </div>
          <div className={`${card} border rounded-xl p-4`}>
            <p className="text-2xl font-bold text-blue-400">{newCount}</p>
            <p className={`text-sm ${sub}`}>Новых (требуют внимания)</p>
          </div>
          <div className={`${card} border rounded-xl p-4`}>
            <p className="text-2xl font-bold text-green-400">
              {totalRevenue.toLocaleString("ru-RU")}
            </p>
            <p className={`text-sm ${sub}`}>Выручка</p>
          </div>
        </div>

        {/* Фильтр по статусу */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setFilterStatus("")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !filterStatus
                ? "bg-blue-600 text-white"
                : isDark
                ? "bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600"
                : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
            }`}
          >
            Все
          </button>
          {STATUSES.map((s) => {
            const count = stats.find((st) => st.status === s.id)?._count || 0;
            return (
              <button
                key={s.id}
                onClick={() => setFilterStatus(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === s.id
                    ? "bg-blue-600 text-white"
                    : isDark
                    ? "bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                {s.label}
                {count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                    filterStatus === s.id ? "bg-white/20" : "bg-gray-700 text-gray-300"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Список заказов */}
        {orders.length === 0 ? (
          <div className={`${card} border rounded-xl p-12 text-center`}>
            <ShoppingBag className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
            <p className={`text-lg font-medium ${text}`}>Заказов нет</p>
            <p className={`mt-2 text-sm ${sub}`}>
              Заказы появятся когда клиенты начнут покупать через AI-бота
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const isExpanded = expandedId === order.id;

              return (
                <div key={order.id} className={`${card} border rounded-xl overflow-hidden`}>
                  {/* Основная строка */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold ${text}`}>#{order.orderNumber}</span>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                        {order.isPaid && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                            Оплачен
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={`text-sm font-medium ${text}`}>{order.clientName}</span>
                        {order.clientPhone && (
                          <span className={`flex items-center gap-1 text-xs ${sub}`}>
                            <Phone className="w-3 h-3" />
                            {order.clientPhone}
                          </span>
                        )}
                        <span className={`text-xs ${sub}`}>
                          {new Date(order.createdAt).toLocaleString("ru-RU", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 truncate ${sub}`}>
                        {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`font-bold ${text}`}>
                        {order.totalPrice.toLocaleString("ru-RU")}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className={`w-4 h-4 ${sub}`} />
                      ) : (
                        <ChevronDown className={`w-4 h-4 ${sub}`} />
                      )}
                    </div>
                  </div>

                  {/* Раскрывающаяся часть */}
                  {isExpanded && (
                    <div className={`border-t p-4 space-y-4 ${isDark ? "border-gray-700 bg-gray-800/50" : "border-gray-100 bg-gray-50"}`}>
                      {/* Адрес */}
                      {order.clientAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className={`w-4 h-4 mt-0.5 flex-shrink-0 ${sub}`} />
                          <span className={`text-sm ${text}`}>{order.clientAddress}</span>
                        </div>
                      )}

                      {/* Примечания */}
                      {order.clientNotes && (
                        <div className={`text-sm p-3 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                          <span className={`font-medium ${sub}`}>Пожелание: </span>
                          <span className={text}>{order.clientNotes}</span>
                        </div>
                      )}

                      {/* Состав заказа */}
                      <div>
                        <p className={`text-sm font-medium mb-2 ${sub}`}>Состав:</p>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between">
                              <span className={`text-sm ${text}`}>
                                {item.name} × {item.quantity}
                              </span>
                              <span className={`text-sm ${sub}`}>
                                {(item.price * item.quantity).toLocaleString("ru-RU")}
                              </span>
                            </div>
                          ))}
                          <div className={`flex justify-between pt-2 border-t ${isDark ? "border-gray-600" : "border-gray-200"} font-bold`}>
                            <span className={text}>Итого</span>
                            <span className={text}>{order.totalPrice.toLocaleString("ru-RU")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Управление */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {/* Изменить статус */}
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          disabled={updatingId === order.id}
                          className={`px-3 py-1.5 rounded-lg border text-sm outline-none ${input}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>

                        {/* Оплата */}
                        <button
                          onClick={() => togglePaid(order)}
                          disabled={updatingId === order.id}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            order.isPaid
                              ? "border-green-500/50 text-green-400 bg-green-500/10"
                              : isDark
                              ? "border-gray-600 text-gray-300 hover:border-green-500/50"
                              : "border-gray-300 text-gray-600 hover:border-green-500/50"
                          }`}
                        >
                          {updatingId === order.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : order.isPaid ? (
                            "✓ Оплачен"
                          ) : (
                            "Отметить оплаченным"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
