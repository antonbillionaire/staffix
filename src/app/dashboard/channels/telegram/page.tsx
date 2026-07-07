"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Loader2,
  Sparkles,
  Image,
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  Zap,
  Unplug,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TelegramChannelPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [token, setToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const [botInfo, setBotInfo] = useState({
    connected: false,
    username: "",
    name: "",
  });

  // Telegram Business — отдельное подключение бота в личные чаты владельца.
  // Активируется владельцем в TG-приложении, мы только показываем статус.
  const [tgBiz, setTgBiz] = useState<{
    connected: boolean;
    canReply?: boolean;
    isEnabled?: boolean;
    pausedByOwner?: boolean;
  }>({ connected: false });
  const [tgBizPausing, setTgBizPausing] = useState(false);
  const [tgBizEnabling, setTgBizEnabling] = useState(false);
  const [tgBizEnabled, setTgBizEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/telegram-business")
      .then((r) => r.json())
      .then((d) => setTgBiz(d))
      .catch(() => {});
  }, []);

  const enableBusinessFeature = async () => {
    setTgBizEnabling(true);
    try {
      const r = await fetch("/api/telegram-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      });
      if (r.ok) setTgBizEnabled(true);
    } finally {
      setTgBizEnabling(false);
    }
  };

  // Диагностика — вызывается по кнопке когда «не подключается», показывает
  // на каком именно шаге застряло (webhook / /start / mismatched account).
  const [tgBizDiag, setTgBizDiag] = useState<{
    diagnosis?: string[];
    webhook?: { businessReady?: boolean; missingBusinessUpdates?: string[]; lastErrorMessage?: string | null };
    business?: { hasOwnerTelegramChatId?: boolean };
    connection?: { exists?: boolean; userIdMatchesOwner?: boolean; connectedByUserId?: string };
  } | null>(null);
  const [tgBizDiagLoading, setTgBizDiagLoading] = useState(false);
  const runDiagnostic = async () => {
    setTgBizDiagLoading(true);
    try {
      const r = await fetch("/api/telegram-business/diagnostic");
      const data = await r.json();
      setTgBizDiag(data);
    } finally {
      setTgBizDiagLoading(false);
    }
  };

  const togglePause = async () => {
    if (!tgBiz.connected) return;
    setTgBizPausing(true);
    try {
      const next = !tgBiz.pausedByOwner;
      const r = await fetch("/api/telegram-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      if (r.ok) {
        setTgBiz((prev) => ({ ...prev, pausedByOwner: next }));
      }
    } finally {
      setTgBizPausing(false);
    }
  };

  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/business");
        if (res.ok) {
          const data = await res.json();
          if (data.business) {
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
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setTokenError(t("botPage.enterToken"));
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("botPage.saveError"));
      }

      if (data.business) {
        setBotInfo({
          connected: data.business.botActive || false,
          username: data.business.botUsername || "",
          name: data.business.name || "",
        });
      }

      setTokenSaved(true);
      setTimeout(() => setTokenSaved(false), 3000);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : t("botPage.saveError"));
    } finally {
      setSavingToken(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Отключить Telegram-бота? Бот перестанет отвечать клиентам. Вы сможете подключить его снова в любое время.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/business/telegram", { method: "DELETE" });
      if (res.ok) {
        setBotInfo({ connected: false, username: "", name: "" });
        setToken("");
      }
    } catch {
      // silent
    } finally {
      setDisconnecting(false);
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Telegram</h1>
        </div>
        <p className={textSecondary}>
          {t("channels.tg.subtitle")}
        </p>
      </div>

      {/* Status card */}
      <div className={`rounded-xl p-6 border ${
        botInfo.connected
          ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30"
          : "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            botInfo.connected
              ? "bg-green-500/20"
              : "bg-gradient-to-br from-blue-500 to-purple-600"
          }`}>
            <Brain className={`h-7 w-7 ${botInfo.connected ? "text-green-400" : "text-white"}`} />
          </div>
          <div>
            <h2 className={`text-xl font-semibold ${textPrimary}`}>
              {botInfo.connected ? t("botPage.aiActive") : t("botPage.activateAI")}
            </h2>
            <p className={textSecondary + " text-sm"}>
              {botInfo.connected
                ? `@${botInfo.username} ${t("botPage.readyToRespond")}`
                : t("botPage.connectToStart")}
            </p>
          </div>
          {botInfo.connected && (
            <div className="ml-auto flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">{t("botPage.online247")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Benefits */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          {t("channels.tg.benefitsTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/20", title: t("channels.tg.replies247"), desc: t("channels.tg.replies247Desc") },
            { icon: Users, color: "text-green-400", bg: "bg-green-500/20", title: t("channels.tg.clientBooking"), desc: t("channels.tg.clientBookingDesc") },
            { icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/20", title: t("channels.tg.conversionGrowth"), desc: t("channels.tg.conversionGrowthDesc") },
            { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/20", title: t("channels.tg.timeSaving"), desc: t("channels.tg.timeSavingDesc") },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className={`w-10 h-10 ${item.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <h4 className={`font-medium ${textPrimary} mb-0.5`}>{item.title}</h4>
                <p className={`text-sm ${textSecondary}`}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      {!botInfo.connected && (
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
            <Sparkles className="h-5 w-5 text-yellow-400" />
            {t("botPage.howToCreate")}
          </h3>

          <ol className="space-y-4 text-sm">
            {[
              { step: 1, title: t("botPage.step1"), link: { href: "https://t.me/BotFather", text: t("botPage.openBotFather") }, code: null, desc: null },
              { step: 2, title: t("botPage.step2"), link: null, code: "/newbot", desc: null },
              { step: 3, title: t("botPage.step3"), link: null, code: null, desc: t("botPage.step3Desc") },
              { step: 4, title: t("botPage.step4"), link: null, code: null, desc: t("botPage.step4Desc") },
              { step: 5, title: t("botPage.step5"), link: null, code: null, desc: t("botPage.step5Desc") },
            ].map((item) => (
              <li key={item.step} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                  {item.step}
                </span>
                <div>
                  <p className={`${textPrimary} font-medium`}>{item.title}</p>
                  {item.link && (
                    <a href={item.link.href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1">
                      {item.link.text} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {item.code && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className={`${isDark ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200"} border px-3 py-1.5 rounded-lg text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>{item.code}</code>
                      <button onClick={() => copyToClipboard(item.code!)} className={`${textSecondary} hover:${textPrimary} transition-colors`}>
                        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                  {item.desc && <p className={`${isDark ? "text-gray-500" : "text-gray-400"} text-xs mt-1`}>{item.desc}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Token input */}
      <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          {botInfo.connected ? t("botPage.connectedBot") : t("botPage.botToken")}
        </h3>

        {tokenError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {tokenError}
          </div>
        )}

        {botInfo.connected ? (
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">{t("botPage.botConnected")}</p>
                  <p className={textSecondary + " text-sm"}>@{botInfo.username}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                isDark
                  ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                  : "border-red-200 text-red-500 hover:bg-red-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              {disconnecting ? "Отключение..." : "Отключить бота"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-2`}>
                {t("botPage.pasteToken")}
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className={`w-full px-4 py-3 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"} border rounded-xl placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm`}
              />
            </div>

            <button
              onClick={handleSaveToken}
              disabled={savingToken || !token.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {savingToken ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t("botPage.connecting")}</>
              ) : tokenSaved ? (
                <><Check className="h-4 w-4" /> {t("botPage.connected")}</>
              ) : (
                <><Brain className="h-4 w-4" /> {t("botPage.activateButton")}</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bot avatar instructions */}
      {botInfo.connected && (
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-3 flex items-center gap-2`}>
            <Image className="h-5 w-5 text-pink-400" />
            {t("channels.tg.botAvatar")}
          </h3>
          <p className={`${textSecondary} text-sm mb-4`}>
            {t("channels.tg.avatarInstructions")}
          </p>
          <div className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-lg p-4 space-y-2 text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            <p>1. {t("channels.tg.avatarStep1")}</p>
            <p>2. {t("channels.tg.avatarStep2")}</p>
            <p>3. {t("channels.tg.avatarStep3")}</p>
            <p>4. {t("channels.tg.avatarStep4")}</p>
            <p>5. {t("channels.tg.avatarStep5")}</p>
          </div>
        </div>
      )}

      {/* Telegram Business — AI в личных чатах владельца */}
      {botInfo.connected && (
        <div className={`${cardBg} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className={`text-lg font-semibold ${textPrimary} mb-2 flex items-center gap-2`}>
                <Sparkles className="h-5 w-5 text-violet-400" />
                AI в личных чатах Telegram
              </h3>
              <p className={`${textSecondary} text-sm`}>
                Опциональная функция Telegram Business: AI отвечает клиентам, которые пишут в ваш личный Telegram (не в бота). Требуется Telegram Premium у вас.
              </p>
            </div>
            {tgBiz.connected && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  tgBiz.pausedByOwner
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : tgBiz.isEnabled && tgBiz.canReply
                      ? "bg-green-500/20 text-green-400 border border-green-500/40"
                      : "bg-red-500/20 text-red-400 border border-red-500/40"
                }`}
              >
                {tgBiz.pausedByOwner
                  ? "На паузе"
                  : tgBiz.isEnabled && tgBiz.canReply
                    ? "Активно"
                    : !tgBiz.isEnabled
                      ? "Отключено в TG"
                      : "Нет права отвечать"}
              </span>
            )}
          </div>

          {!tgBiz.connected ? (
            <div className="mt-6 space-y-5">
              {/* Требования */}
              <div className={`${isDark ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-50 border-blue-200"} rounded-lg p-4 border text-sm`}>
                <p className={`font-semibold mb-1 ${isDark ? "text-blue-300" : "text-blue-900"}`}>
                  Что понадобится
                </p>
                <p className={isDark ? "text-blue-100/90" : "text-blue-900/90"}>
                  Активная подписка Telegram Premium у Вас на аккаунте — без неё пункт «Telegram Business» в настройках просто не появится. Оформляется в Telegram → Settings → Telegram Premium.
                </p>
              </div>

              {/* ШАГ 1 — BotFather (критично!) */}
              <div className={`${isDark ? "bg-amber-500/10 border-amber-500/40" : "bg-amber-50 border-amber-300"} rounded-lg p-5 border`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isDark ? "bg-amber-500 text-black" : "bg-amber-500 text-white"}`}>
                    1
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold text-base ${isDark ? "text-amber-300" : "text-amber-900"}`}>
                      Включите Secretary Mode в @BotFather
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
                      В BotFather эта опция называется «Secretary Mode», хотя в Telegram Business её показывают как «Business». Это одно и то же.
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
                      Один раз для этого бота. Обязательный шаг — без него Telegram выдаст ошибку «этот бот не поддерживает Telegram для бизнеса».
                    </p>
                  </div>
                </div>
                <ol className={`space-y-1.5 text-sm list-decimal list-inside ${isDark ? "text-amber-100" : "text-amber-900"}`}>
                  <li>В Telegram откройте чат с <span className="font-mono font-semibold">@BotFather</span></li>
                  <li>Отправьте команду <span className="font-mono font-semibold">/mybots</span></li>
                  <li>Выберите бота <span className="font-mono font-semibold">@{botInfo.username}</span></li>
                  <li>Нажмите <span className="font-semibold">Bot Settings</span></li>
                  <li>Нажмите <span className="font-semibold">Secretary Mode</span></li>
                  <li>Нажмите <span className="font-semibold">Turn on</span></li>
                </ol>
              </div>

              {/* ШАГ 2 — кнопка в дашборде */}
              <div className={`${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"} rounded-lg p-5 border`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isDark ? "bg-violet-500 text-white" : "bg-violet-600 text-white"}`}>
                    2
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold text-base ${textPrimary}`}>
                      Подготовьте бота на стороне Staffix
                    </p>
                    <p className={`text-xs mt-0.5 ${textSecondary}`}>
                      Одна кнопка. Мы настроим webhook Вашего бота чтобы он получал сообщения из личных чатов Telegram Business.
                    </p>
                  </div>
                </div>
                <button
                  onClick={enableBusinessFeature}
                  disabled={tgBizEnabling || tgBizEnabled}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white py-2.5 px-4 rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {tgBizEnabling
                    ? "Подготавливаю бота…"
                    : tgBizEnabled
                      ? "✓ Готово — переходите к Шагу 3"
                      : "Подготовить бота"}
                </button>
              </div>

              {/* ШАГ 3 — подключение в TG */}
              <div className={`${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"} rounded-lg p-5 border`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${isDark ? "bg-violet-500 text-white" : "bg-violet-600 text-white"}`}>
                    3
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold text-base ${textPrimary}`}>
                      Подключите бота в Telegram
                    </p>
                    <p className={`text-xs mt-0.5 ${textSecondary}`}>
                      Делаете один раз в приложении Telegram на телефоне.
                    </p>
                  </div>
                </div>
                <ol className={`space-y-1.5 text-sm list-decimal list-inside ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                  <li>Откройте Telegram → <span className="font-semibold">Settings</span> → <span className="font-semibold">Telegram Business</span></li>
                  <li>Перейдите в раздел <span className="font-semibold">Chatbots</span></li>
                  <li>Введите имя бота: <span className="font-mono font-semibold">@{botInfo.username}</span></li>
                  <li>В разделе <span className="font-semibold">Access to Chats</span> выберите <span className="font-semibold">Selected Chats</span> и настройте:
                    <div className={`ml-6 mt-1 text-xs ${textSecondary}`}>
                      рекомендуем включить <span className="font-semibold">Non-Contacts</span> и <span className="font-semibold">New Chats</span>, отключить <span className="font-semibold">Contacts</span> — тогда AI будет отвечать только незнакомцам, а с друзьями и семьёй Вы общаетесь сами.
                    </div>
                  </li>
                  <li>В разделе <span className="font-semibold">Permissions</span> включите <span className="font-semibold">Reply to Messages</span></li>
                  <li>Сохраните настройки</li>
                </ol>
                <p className={`mt-4 text-xs ${textSecondary}`}>
                  После подключения обновите эту страницу через минуту. Здесь появится зелёный статус «Активно» и тогглер «Пауза».
                </p>
              </div>

              {/* Диагностика — если что-то пошло не так, показываем где именно застряло */}
              <div className={`${isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"} rounded-lg p-5 border`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className={`font-semibold text-base ${textPrimary}`}>
                      Не подключается? Проверьте диагностику
                    </p>
                    <p className={`text-xs mt-0.5 ${textSecondary}`}>
                      Покажет на каком шаге застряло: не нажали кнопку Шага 2, не сделали /start от нужного аккаунта, или Telegram не прислал события.
                    </p>
                  </div>
                  <button
                    onClick={runDiagnostic}
                    disabled={tgBizDiagLoading}
                    className={`${isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800"} px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap disabled:opacity-50`}
                  >
                    {tgBizDiagLoading ? "Проверяю…" : "Проверить"}
                  </button>
                </div>
                {tgBizDiag?.diagnosis && (
                  <div className="space-y-1 text-sm mt-2">
                    {tgBizDiag.diagnosis.map((line, idx) => (
                      <p key={idx} className={`${textPrimary} leading-relaxed`}>
                        {line}
                      </p>
                    ))}
                    {tgBizDiag.webhook?.lastErrorMessage && (
                      <p className={`mt-2 text-xs ${isDark ? "text-red-300" : "text-red-700"}`}>
                        Последняя ошибка от Telegram: <span className="font-mono">{tgBizDiag.webhook.lastErrorMessage}</span>
                      </p>
                    )}
                    {tgBizDiag.connection?.exists && tgBizDiag.connection.userIdMatchesOwner === false && (
                      <div className={`mt-2 text-xs ${isDark ? "text-amber-200/90" : "text-amber-800"}`}>
                        <p>Аккаунт из Telegram Business: <span className="font-mono">{tgBizDiag.connection.connectedByUserId}</span></p>
                        <p className="mt-1">Что делать: с этого аккаунта запустите /start в вашем боте, тогда мы «увяжем» бизнес и Telegram Business.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={togglePause}
                disabled={tgBizPausing}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  tgBiz.pausedByOwner
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                }`}
              >
                {tgBizPausing
                  ? "Сохраняю…"
                  : tgBiz.pausedByOwner
                    ? "Возобновить AI в личных чатах"
                    : "Поставить AI на паузу"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
