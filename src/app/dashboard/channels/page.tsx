"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MessageSquare,
  Phone,
  Instagram,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Settings,
  RefreshCw,
  Zap,
  Users,
  TrendingUp,
  Copy,
  Check,
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
    lastActivity?: string;
  };
  stats?: {
    totalMessages: number;
    totalClients: number;
    leadsToday: number;
  };
}

export default function ChannelsPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Theme-aware styles
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-400";

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setWebhookUrl(data.webhookBaseUrl || window.location.origin);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyWebhook = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const channelConfigs = [
    {
      id: "telegram",
      name: "Telegram",
      icon: TelegramIcon,
      color: "from-blue-500 to-cyan-500",
      description: "Telegram бот для общения с клиентами",
      setupLink: "/dashboard/bot",
      docsLink: "https://core.telegram.org/bots",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: WhatsAppIcon,
      color: "from-green-500 to-emerald-500",
      description: "WhatsApp Business API для бизнес-общения",
      features: [
        "Автоответы 24/7",
        "Click-to-WhatsApp реклама",
        "QR-коды",
        "Шаблоны сообщений",
      ],
      comingSoon: true,
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: Instagram,
      color: "from-pink-500 to-purple-500",
      description: "Instagram DM для взаимодействия в соцсетях",
      features: [
        "Автоответы в Direct",
        "Лиды из рекламы",
        "Ответы на Stories",
        "Комментарии",
      ],
      comingSoon: true,
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

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>
              WhatsApp и Instagram — скоро!
            </h3>
            <p className={`${textSecondary} mb-3`}>
              Мы готовим интеграцию с WhatsApp Business API и Instagram Messaging API.
              Ваш AI-сотрудник сможет отвечать клиентам во всех мессенджерах одновременно.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className={textSecondary}>Единая база клиентов</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className={textSecondary}>Лиды из Instagram рекламы</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className={textSecondary}>Click-to-WhatsApp</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {channelConfigs.map((config) => {
          const channelStatus = channels.find((c) => c.channel === config.id);
          const isConnected = channelStatus?.isConnected || false;
          const IconComponent = config.icon;

          return (
            <div
              key={config.id}
              className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden ${
                config.comingSoon ? "opacity-75" : ""
              }`}
            >
              {/* Header */}
              <div className={`bg-gradient-to-r ${config.color} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-8 w-8 text-white" />
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {config.name}
                      </h3>
                      {config.comingSoon && (
                        <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                          Скоро
                        </span>
                      )}
                    </div>
                  </div>
                  {!config.comingSoon && (
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
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className={`${textSecondary} text-sm mb-4`}>
                  {config.description}
                </p>

                {/* Features for coming soon */}
                {config.features && (
                  <div className="space-y-2 mb-4">
                    {config.features.map((feature, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 text-sm ${textMuted}`}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500/50" />
                        {feature}
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats if connected */}
                {isConnected && channelStatus?.stats && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-lg p-3 text-center`}>
                      <MessageSquare className={`h-4 w-4 ${textMuted} mx-auto mb-1`} />
                      <p className={`text-lg font-semibold ${textPrimary}`}>
                        {channelStatus.stats.totalMessages}
                      </p>
                      <p className={`text-xs ${textMuted}`}>Сообщений</p>
                    </div>
                    <div className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-lg p-3 text-center`}>
                      <Users className={`h-4 w-4 ${textMuted} mx-auto mb-1`} />
                      <p className={`text-lg font-semibold ${textPrimary}`}>
                        {channelStatus.stats.totalClients}
                      </p>
                      <p className={`text-xs ${textMuted}`}>Клиентов</p>
                    </div>
                    <div className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-lg p-3 text-center`}>
                      <TrendingUp className={`h-4 w-4 ${textMuted} mx-auto mb-1`} />
                      <p className={`text-lg font-semibold ${textPrimary}`}>
                        {channelStatus.stats.leadsToday}
                      </p>
                      <p className={`text-xs ${textMuted}`}>Лиды сегодня</p>
                    </div>
                  </div>
                )}

                {/* Action button */}
                {config.comingSoon ? (
                  <button
                    disabled
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium ${
                      isDark ? "bg-white/5 text-gray-500" : "bg-gray-100 text-gray-400"
                    } cursor-not-allowed`}
                  >
                    Скоро будет доступно
                  </button>
                ) : config.setupLink ? (
                  <a
                    href={config.setupLink}
                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${
                      isConnected
                        ? `${isDark ? "bg-white/10 hover:bg-white/15" : "bg-gray-100 hover:bg-gray-200"} ${textPrimary}`
                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90"
                    } transition-all`}
                  >
                    {isConnected ? (
                      <>
                        <Settings className="h-4 w-4" />
                        Настройки
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Подключить
                      </>
                    )}
                  </a>
                ) : (
                  <button
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Подключить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Webhook URLs Info */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
          <Settings className="h-5 w-5" />
          Webhook URLs для интеграции
        </h3>
        <p className={`${textSecondary} text-sm mb-4`}>
          Эти URL нужно будет указать в настройках Meta Business при подключении WhatsApp и Instagram.
        </p>

        <div className="space-y-3">
          {/* WhatsApp Webhook */}
          <div className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-lg p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${textPrimary}`}>WhatsApp Webhook</span>
              <button
                onClick={() => copyWebhook(`${webhookUrl}/api/webhooks/whatsapp`)}
                className={`${textSecondary} hover:${textPrimary} transition-colors`}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <code className={`text-xs ${textMuted} break-all`}>
              {webhookUrl}/api/webhooks/whatsapp
            </code>
          </div>

          {/* Instagram Webhook */}
          <div className={`${isDark ? "bg-white/5" : "bg-gray-50"} rounded-lg p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${textPrimary}`}>Instagram Webhook</span>
              <button
                onClick={() => copyWebhook(`${webhookUrl}/api/webhooks/instagram`)}
                className={`${textSecondary} hover:${textPrimary} transition-colors`}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <code className={`text-xs ${textMuted} break-all`}>
              {webhookUrl}/api/webhooks/instagram
            </code>
          </div>
        </div>
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
                Автоматический захват лидов из Instagram и WhatsApp рекламы
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
                Один AI-сотрудник отвечает во всех каналах
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
