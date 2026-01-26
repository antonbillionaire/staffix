"use client";

import { useState } from "react";
import { User, Building, CreditCard, Bell } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Настройки</h2>
        <p className="text-sm text-gray-500">
          Управление аккаунтом и подпиской
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "profile"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <User className="h-4 w-4 inline mr-2" />
          Профиль
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "subscription"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <CreditCard className="h-4 w-4 inline mr-2" />
          Подписка
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "notifications"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Bell className="h-4 w-4 inline mr-2" />
          Уведомления
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Данные профиля</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Имя
              </label>
              <input
                type="text"
                defaultValue="Антон"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                defaultValue="anton@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* Subscription Tab */}
      {activeTab === "subscription" && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Текущий план</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">Пробный период</p>
                <p className="text-sm text-gray-500">Осталось 14 дней</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Использовано сообщений</p>
                <p className="text-lg font-medium text-gray-900">45 / 100</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Обновить план</h3>
            <p className="text-sm text-blue-700 mb-4">
              Получите больше сообщений и дополнительные функции
            </p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
              Выбрать план
            </button>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Настройки уведомлений</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Новые записи</p>
                <p className="text-sm text-gray-500">Уведомления о новых записях клиентов</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 text-blue-600 rounded" />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Отмены записей</p>
                <p className="text-sm text-gray-500">Уведомления когда клиент отменяет запись</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 text-blue-600 rounded" />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Лимит сообщений</p>
                <p className="text-sm text-gray-500">Предупреждение когда лимит близок к исчерпанию</p>
              </div>
              <input type="checkbox" defaultChecked className="h-5 w-5 text-blue-600 rounded" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
