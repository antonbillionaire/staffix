"use client";

import { useState } from "react";
import { Bot, Copy, Check, ExternalLink, AlertCircle } from "lucide-react";

export default function BotConfigPage() {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // В реальном приложении данные будут загружаться с API
  const botInfo = {
    connected: false,
    username: "",
    name: "",
  };

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setError("Введите токен бота");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // TODO: API call to save token
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Ошибка сохранения токена");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Instructions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          Как создать бота?
        </h2>

        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              1
            </span>
            <div>
              <p className="text-gray-900 font-medium">Откройте @BotFather в Telegram</p>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
              >
                Открыть BotFather <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              2
            </span>
            <div>
              <p className="text-gray-900 font-medium">Отправьте команду /newbot</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">/newbot</code>
                <button
                  onClick={() => copyToClipboard("/newbot")}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              3
            </span>
            <div>
              <p className="text-gray-900 font-medium">Введите название бота</p>
              <p className="text-gray-500 text-xs mt-1">
                Например: Салон Красоты Звезда
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              4
            </span>
            <div>
              <p className="text-gray-900 font-medium">Введите username бота</p>
              <p className="text-gray-500 text-xs mt-1">
                Должен заканчиваться на bot, например: zvezda_salon_bot
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              5
            </span>
            <div>
              <p className="text-gray-900 font-medium">Скопируйте токен</p>
              <p className="text-gray-500 text-xs mt-1">
                BotFather пришлёт вам токен вида: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* Token input */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Токен бота
        </h2>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {botInfo.connected ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium flex items-center gap-2">
              <Check className="h-5 w-5" />
              Бот подключен
            </p>
            <p className="text-green-700 text-sm mt-1">
              @{botInfo.username} • {botInfo.name}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                Вставьте токен от BotFather
              </label>
              <input
                id="token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
            </div>

            <button
              onClick={handleSaveToken}
              disabled={saving || !token.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                "Подключение..."
              ) : saved ? (
                <>
                  <Check className="h-4 w-4" />
                  Подключено!
                </>
              ) : (
                "Подключить бота"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Business info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Информация о бизнесе
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название
            </label>
            <input
              type="text"
              placeholder="Салон красоты 'Звезда'"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Телефон
            </label>
            <input
              type="tel"
              placeholder="+998 90 123 45 67"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Адрес
            </label>
            <input
              type="text"
              placeholder="г. Ташкент, ул. Навои, 10"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Часы работы
            </label>
            <input
              type="text"
              placeholder="Пн-Сб: 09:00-19:00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
