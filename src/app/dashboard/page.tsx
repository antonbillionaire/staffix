"use client";

import Link from "next/link";
import { Bot, MessageSquare, Calendar, Users, ArrowRight, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  // В реальном приложении данные будут загружаться с API
  const stats = {
    messagesUsed: 45,
    messagesLimit: 100,
    bookingsToday: 3,
    totalClients: 12,
  };

  const botConnected = false; // Пока бот не подключен

  return (
    <div className="space-y-6">
      {/* Alert if bot not connected */}
      {!botConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-800">Бот не подключен</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Создайте бота в Telegram и добавьте токен для начала работы.
            </p>
            <Link
              href="/dashboard/bot"
              className="inline-flex items-center gap-1 text-sm font-medium text-yellow-800 hover:text-yellow-900 mt-2"
            >
              Настроить бота <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<MessageSquare className="h-6 w-6 text-blue-600" />}
          title="Сообщений"
          value={`${stats.messagesUsed} / ${stats.messagesLimit}`}
          subtitle="за этот месяц"
        />
        <StatCard
          icon={<Calendar className="h-6 w-6 text-green-600" />}
          title="Записей сегодня"
          value={stats.bookingsToday.toString()}
          subtitle="новых записей"
        />
        <StatCard
          icon={<Users className="h-6 w-6 text-purple-600" />}
          title="Клиентов"
          value={stats.totalClients.toString()}
          subtitle="всего обращений"
        />
        <StatCard
          icon={<Bot className="h-6 w-6 text-gray-600" />}
          title="Статус бота"
          value={botConnected ? "Активен" : "Не подключен"}
          subtitle={botConnected ? "работает" : "требуется настройка"}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            href="/dashboard/bot"
            icon={<Bot className="h-8 w-8 text-blue-600" />}
            title="Настроить бота"
            description="Добавьте токен Telegram бота"
          />
          <QuickActionCard
            href="/dashboard/services"
            icon={<span className="text-3xl">💇</span>}
            title="Добавить услуги"
            description="Укажите услуги и цены"
          />
          <QuickActionCard
            href="/dashboard/staff"
            icon={<Users className="h-8 w-8 text-purple-600" />}
            title="Добавить мастеров"
            description="Настройте команду"
          />
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Последние записи</h2>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-8 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p>Пока нет записей</p>
            <p className="text-sm mt-1">Когда клиенты начнут записываться, записи появятся здесь</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="mb-3">{icon}</div>
      <h3 className="font-medium text-gray-900 group-hover:text-blue-600">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
