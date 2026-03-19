"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Unlink,
  Clock,
  Users,
  TrendingUp,
  Shield,
  Instagram,
  Facebook,
  MessageSquare,
  Target,
  AlertTriangle,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import ChannelGuideModal from "@/components/ChannelGuideModal";

interface ChannelStatus {
  channel: string;
  isConnected: boolean;
  isVerified: boolean;
  details?: {
    username?: string;
    phoneNumber?: string;
    phoneNumberId?: string;
    pageId?: string;
  };
  tokenWarning?: boolean;
}

export default function MetaChannelsPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (channel: string) => {
    if (!confirm(t("channels.meta.disconnectConfirm").replace("{channel}", channel === "instagram" ? "Instagram" : "Facebook Messenger"))) return;
    setDisconnecting(channel);
    try {
      const res = await fetch(`/api/channels?channel=${channel}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMessage(t("channels.meta.disconnected"));
        await fetchChannels();
      } else {
        setErrorMessage(t("channels.meta.disconnectError"));
      }
    } catch {
      setErrorMessage(t("channels.meta.disconnectError"));
    } finally {
      setDisconnecting(null);
    }
  };

  const handleConnectMeta = () => {
    window.location.href = "/api/auth/meta";
  };

  const igChannel = channels.find((c) => c.channel === "instagram");
  const fbChannel = channels.find((c) => c.channel === "facebook");
  const isAnyConnected = igChannel?.isConnected || fbChannel?.isConnected;

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
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Instagram & Facebook</h1>
        </div>
        <p className={textSecondary}>
          {t("channels.meta.subtitle")}
        </p>
      </div>

      {/* Account warning */}
      {!isAnyConnected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-300 space-y-1">
            <p className="font-medium">Перед подключением убедитесь:</p>
            <p>В браузере вы вошли в <strong>свой личный Facebook аккаунт</strong> — тот, который является администратором вашей Facebook страницы. Если в браузере залогинен чужой аккаунт — выйдите из него на facebook.com и войдите под своим.</p>
          </div>
        </div>
      )}

      {/* Success / Error Messages */}
      {successMessage && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          <p className="text-green-300 text-sm">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Benefits */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          {t("channels.meta.benefitsTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Target, color: "text-pink-400", bg: "bg-pink-500/20", title: t("channels.meta.adCapture"), desc: t("channels.meta.adCaptureDesc") },
            { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/20", title: t("channels.meta.fastReply"), desc: t("channels.meta.fastReplyDesc") },
            { icon: MessageSquare, color: "text-purple-400", bg: "bg-purple-500/20", title: t("channels.meta.dualChannel"), desc: t("channels.meta.dualChannelDesc") },
            { icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/20", title: t("channels.meta.fewerLostLeads"), desc: t("channels.meta.fewerLostLeadsDesc") },
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

      {/* Connection status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Instagram card */}
        <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Instagram className="h-6 w-6 text-white" />
                <span className="text-white font-semibold">Instagram</span>
              </div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${igChannel?.isConnected ? "bg-green-500" : "bg-white/20"}`}>
                {igChannel?.isConnected ? <CheckCircle2 className="h-4 w-4 text-white" /> : <XCircle className="h-4 w-4 text-white/60" />}
              </div>
            </div>
          </div>
          <div className="p-4">
            {igChannel?.isConnected ? (
              <>
                {igChannel.details?.username && (
                  <p className={`text-sm ${textPrimary} mb-3`}>@{igChannel.details.username}</p>
                )}
                <button
                  onClick={() => handleDisconnect("instagram")}
                  disabled={disconnecting === "instagram"}
                  className={`w-full py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 ${isDark ? "bg-red-500/20 hover:bg-red-500/30 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-600"} transition-all`}
                >
                  {disconnecting === "instagram" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                  {t("channels.disconnect")}
                </button>
              </>
            ) : (
              <p className={`text-sm ${textSecondary}`}>{t("channels.meta.notConnected")}</p>
            )}
          </div>
        </div>

        {/* Facebook card */}
        <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-500 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Facebook className="h-6 w-6 text-white" />
                <span className="text-white font-semibold">Messenger</span>
              </div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${fbChannel?.isConnected ? "bg-green-500" : "bg-white/20"}`}>
                {fbChannel?.isConnected ? <CheckCircle2 className="h-4 w-4 text-white" /> : <XCircle className="h-4 w-4 text-white/60" />}
              </div>
            </div>
          </div>
          <div className="p-4">
            {fbChannel?.isConnected ? (
              <>
                {fbChannel.details?.pageId && (
                  <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"} mb-3`}>Page ID: {fbChannel.details.pageId}</p>
                )}
                <button
                  onClick={() => handleDisconnect("facebook")}
                  disabled={disconnecting === "facebook"}
                  className={`w-full py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 ${isDark ? "bg-red-500/20 hover:bg-red-500/30 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-600"} transition-all`}
                >
                  {disconnecting === "facebook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                  {t("channels.disconnect")}
                </button>
              </>
            ) : (
              <p className={`text-sm ${textSecondary}`}>{t("channels.meta.notConnected")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Guide */}
      {!isAnyConnected && <ChannelGuideModal channel="meta" />}

      {/* Connect button */}
      {!isAnyConnected && (
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>
                {t("channels.meta.connectOneClick")}
              </h3>
              <p className={`${textSecondary} mb-4`}>
                {t("channels.meta.connectDesc")}
              </p>
              <button
                onClick={handleConnectMeta}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Facebook className="h-4 w-4" />
                {t("channels.meta.connectViaFacebook")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconnect if partially connected */}
      {isAnyConnected && (!igChannel?.isConnected || !fbChannel?.isConnected) && (
        <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
          <p className={`${textSecondary} text-sm mb-3`}>
            {t("channels.meta.wantConnect").replace("{channel}", !igChannel?.isConnected ? "Instagram" : "Facebook Messenger")}
          </p>
          <button
            onClick={handleConnectMeta}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Facebook className="h-4 w-4" />
            {t("channels.meta.reconnect")}
          </button>
        </div>
      )}
    </div>
  );
}
