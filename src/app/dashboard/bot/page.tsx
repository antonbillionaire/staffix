"use client";

import { useState, useEffect } from "react";
import { Bot, Copy, Check, ExternalLink, AlertCircle, Loader2 } from "lucide-react";

export default function BotConfigPage() {
  const [token, setToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenError, setTokenError] = useState("");

  // Business info state
  const [businessInfo, setBusinessInfo] = useState({
    name: "",
    phone: "",
    address: "",
    workingHours: "",
  });
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessSaved, setBusinessSaved] = useState(false);
  const [businessError, setBusinessError] = useState("");
  const [loading, setLoading] = useState(true);

  // Bot connection info
  const [botInfo, setBotInfo] = useState({
    connected: false,
    username: "",
    name: "",
  });

  // Загрузка данных при монтировании
  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          if (data.business) {
            setBusinessInfo({
              name: data.business.name || "",
              phone: data.business.phone || "",
              address: data.business.address || "",
              workingHours: data.business.workingHours || "",
            });
            if (data.business.botToken) {
              setToken(data.business.botToken);
              setBotInfo({
                connected: data.business.botActive || false,
                username: data.business.botUsername || "",
                name: data.business.name || "",
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching business data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, []);

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setTokenError("Введите токен бота");
      return;
    }

    setSavingToken(true);
    setTokenError("");

    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      setTokenSaved(true);
      setTimeout(() => setTokenSaved(false), 3000);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Ошибка сохранения токена");
    } finally {
      setSavingToken(false);
    }
  };

  const handleSaveBusiness = async () => {
    if (!businessInfo.name.trim()) {
      setBusinessError("Введите название бизнеса");
      return;
    }

    setSavingBusiness(true);
    setBusinessError("");

    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(businessInfo),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      setBusinessSaved(true);
      setTimeout(() => setBusinessSaved(false), 3000);
    } catch (err) {
      setBusinessError(err instanceof Error ? err.message : "Ошибка сохранения данных");
    } finally {
      setSavingBusiness(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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

        {tokenError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {tokenError}
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
              disabled={savingToken || !token.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {savingToken ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Подключение...
                </>
              ) : tokenSaved ? (
                <>
                  <Check className="h-4 w-4" />
                  Сохранено!
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

        {businessError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {businessError}
          </div>
        )}

        {businessSaved && (
          <div className="mb-4 bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-center gap-2">
            <Check className="h-4 w-4" />
            Данные сохранены!
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название
            </label>
            <input
              type="text"
              value={businessInfo.name}
              onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })}
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
              value={businessInfo.phone}
              onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
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
              value={businessInfo.address}
              onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
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
              value={businessInfo.workingHours}
              onChange={(e) => setBusinessInfo({ ...businessInfo, workingHours: e.target.value })}
              placeholder="Пн-Сб: 09:00-19:00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleSaveBusiness}
            disabled={savingBusiness}
            className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {savingBusiness ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
