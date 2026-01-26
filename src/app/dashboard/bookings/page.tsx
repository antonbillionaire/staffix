"use client";

import { Calendar, Clock, User, Phone } from "lucide-react";

interface Booking {
  id: number;
  clientName: string;
  clientPhone: string;
  service: string;
  staff: string;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
}

export default function BookingsPage() {
  // В реальном приложении данные будут загружаться с API
  const bookings: Booking[] = [
    {
      id: 1,
      clientName: "Анна Петрова",
      clientPhone: "+998901234567",
      service: "Стрижка женская",
      staff: "Мария",
      date: "2025-01-27",
      time: "10:00",
      status: "confirmed",
    },
    {
      id: 2,
      clientName: "Иван Сидоров",
      clientPhone: "+998907654321",
      service: "Стрижка мужская",
      staff: "Анна",
      date: "2025-01-27",
      time: "11:00",
      status: "pending",
    },
  ];

  const getStatusBadge = (status: Booking["status"]) => {
    const styles = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    const labels = {
      pending: "Ожидает",
      confirmed: "Подтверждено",
      completed: "Завершено",
      cancelled: "Отменено",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Записи</h2>
        <p className="text-sm text-gray-500">
          Все записи клиентов через бота
        </p>
      </div>

      {/* Bookings list */}
      <div className="space-y-4">
        {bookings.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Пока нет записей</p>
            <p className="text-sm mt-1">
              Когда клиенты начнут записываться через бота, записи появятся здесь
            </p>
          </div>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {booking.clientName}
                    </span>
                    {getStatusBadge(booking.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4 text-gray-400" />
                    {booking.clientPhone}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{booking.service}</span>
                    {" · "}
                    {booking.staff}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-gray-900 font-medium">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    {formatDate(booking.date)}
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 mt-1">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {booking.time}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
