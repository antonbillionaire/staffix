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

  const [botInfo, setBotInfo] = useState({
    connected: false,
    username: "",
    name: "",
  });

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
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-green-400 font-medium">{t("botPage.botConnected")}</p>
                <p className={textSecondary + " text-sm"}>@{botInfo.username}</p>
              </div>
            </div>
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
    </div>
  );
}
