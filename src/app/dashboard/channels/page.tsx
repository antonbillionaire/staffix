"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Instagram,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
  Zap,
  Users,
  TrendingUp,
  AlertTriangle,
  Unlink,
  Facebook,
} from "lucide-react";

// Telegram icon (custom)
const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

// WhatsApp icon (custom)
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

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

export default function ChannelsPage() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Theme-aware styles
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-400";

  useEffect(() => {
    // Handle OAuth callback params
    const metaConnected = searchParams.get("meta_connected");
    const metaError = searchParams.get("meta_error");

    if (metaConnected) {
      const channelNames = metaConnected
        .split(",")
        .map((c) =>
          c === "instagram" ? "Instagram" : c === "facebook" ? "Facebook Messenger" : c
        )
        .join(" и ");
      setSuccessMessage(`${channelNames} успешно подключены!`);
      // Clean URL params
      window.history.replaceState({}, "", "/dashboard/channels");
    }
    if (metaError) {
      const errors: Record<string, string> = {
        no_code: "Facebook не вернул код авторизации",
        no_business: "Бизнес не найден",
        no_pages: "У вашего Facebook аккаунта нет привязанных страниц",
        exchange_failed: "Ошибка обмена токена",
        forbidden: "Нет доступа к этому бизнесу",
      };
      setErrorMessage(errors[metaError] || `Ошибка подключения: ${metaError}`);
      window.history.replaceState({}, "", "/dashboard/channels");
    }

    fetchChannels();
  }, [searchParams]);

  // Auto-hide messages
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 8000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(null), 10000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

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
    if (!confirm("Отключить канал? AI-сотрудник перестанет отвечать в этом канале.")) return;
    setDisconnecting(channel);
    try {
      const res = await fetch(`/api/channels?channel=${channel}`, { method: "DELETE" });
      if (res.ok) {
        setSuccessMessage(`Канал отключён`);
        await fetchChannels();
      } else {
        setErrorMessage("Ошибка при отключении канала");
      }
    } catch {
      setErrorMessage("Ошибка при отключении канала");
    } finally {
      setDisconnecting(null);
    }
  };

  const handleConnectMeta = () => {
    // Redirect to Meta OAuth flow
    window.location.href = "/api/auth/meta";
  };

  const channelConfigs = [
    {
      id: "telegram",
      name: "Telegram",
      icon: TelegramIcon,
      color: "from-blue-500 to-cyan-500",
      description: "Telegram бот для общения с клиентами",
      setupLink: "/dashboard/channels/telegram",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: WhatsAppIcon,
      color: "from-green-500 to-emerald-500",
      description: "WhatsApp Business API для автоматических ответов",
      setupLink: "/dashboard/channels/whatsapp",
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: Instagram,
      color: "from-pink-500 to-purple-500",
      description: "AI-ассистент отвечает в Instagram Direct",
      setupLink: "/dashboard/channels/meta",
      connectAction: "meta",
    },
    {
      id: "facebook",
      name: "Messenger",
      icon: Facebook,
      color: "from-blue-600 to-indigo-500",
      description: "AI-ассистент отвечает в Facebook Messenger",
      setupLink: "/dashboard/channels/meta",
      connectAction: "meta",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary} mb-2`}>
          Каналы связи
        </h1>
        <p className={textSecondary}>
          Подключите мессенджеры для общения с клиентами через AI-сотрудника
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          <p className="text-green-300 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-300 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Meta Connect Banner — show when neither Instagram nor Facebook is connected */}
      {!channels.find((c) => c.channel === "instagram")?.isConnected &&
        !channels.find((c) => c.channel === "facebook")?.isConnected && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>
                  Подключите Instagram и Messenger за 1 клик
                </h3>
                <p className={`${textSecondary} mb-4`}>
                  Нажмите кнопку — войдите через Facebook — выберите страницу.
                  AI-сотрудник сразу начнёт отвечать клиентам в Instagram Direct и Facebook Messenger.
                </p>
                <button
                  onClick={handleConnectMeta}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <Facebook className="h-4 w-4" />
                  Подключить через Facebook
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Channel Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {channelConfigs.map((config) => {
          const channelStatus = channels.find((c) => c.channel === config.id);
          const isConnected = channelStatus?.isConnected || false;
          const IconComponent = config.icon;

          return (
            <div
              key={config.id}
              className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}
            >
              {/* Header */}
              <div className={`bg-gradient-to-r ${config.color} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-7 w-7 text-white" />
                    <h3 className="text-lg font-semibold text-white">
                      {config.name}
                    </h3>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isConnected ? "bg-green-500" : "bg-white/20"
                    }`}
                  >
                    {isConnected ? (
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    ) : (
                      <XCircle className="h-5 w-5 text-white/60" />
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className={`${textSecondary} text-sm mb-4`}>
                  {config.description}
                </p>

                {/* Connected details */}
                {isConnected && channelStatus?.details && (
                  <div className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-lg p-3 mb-4`}>
                    {channelStatus.details.username && (
                      <p className={`text-sm ${textPrimary}`}>
                        @{channelStatus.details.username}
                      </p>
                    )}
                    {channelStatus.details.pageId && (
                      <p className={`text-xs ${textMuted}`}>
                        Page ID: {channelStatus.details.pageId}
                      </p>
                    )}
                  </div>
                )}

                {/* Token warning */}
                {channelStatus?.tokenWarning && (
                  <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    <p className="text-xs text-yellow-300">
                      Токен скоро истечёт. Переподключите канал.
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                {isConnected ? (
                  <div className="flex gap-2">
                    {config.setupLink && (
                      <a
                        href={config.setupLink}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                          isDark ? "bg-white/10 hover:bg-white/15" : "bg-gray-100 hover:bg-gray-200"
                        } ${textPrimary} transition-all`}
                      >
                        <Settings className="h-4 w-4" />
                        Настройки
                      </a>
                    )}
                    <button
                      onClick={() => handleDisconnect(config.id)}
                      disabled={disconnecting === config.id}
                      className={`${config.setupLink ? "" : "flex-1"} py-2.5 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                        isDark ? "bg-red-500/20 hover:bg-red-500/30 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-600"
                      } transition-all`}
                    >
                      {disconnecting === config.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4" />
                      )}
                      Отключить
                    </button>
                  </div>
                ) : config.connectAction === "meta" ? (
                  <button
                    onClick={handleConnectMeta}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Подключить
                  </button>
                ) : config.setupLink ? (
                  <a
                    href={config.setupLink}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Подключить
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Benefits Section */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Преимущества мультиканальности
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h4 className={`font-medium ${textPrimary} mb-1`}>Единая база клиентов</h4>
              <p className={`text-sm ${textSecondary}`}>
                Все контакты из всех каналов в одном месте
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h4 className={`font-medium ${textPrimary} mb-1`}>Лиды из рекламы</h4>
              <p className={`text-sm ${textSecondary}`}>
                Автоматический захват лидов из Instagram и Facebook рекламы
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h4 className={`font-medium ${textPrimary} mb-1`}>Единый AI</h4>
              <p className={`text-sm ${textSecondary}`}>
                Один AI-сотрудник отвечает во всех каналах одновременно
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
