"use client";

/**
 * Дашборд-страница «Виджет для сайта» (Sprint Widget, 21 июля 2026).
 * Кастомизация виджета + live preview + copy snippet + инструкции.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Code,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Send,
  Instagram,
  Facebook,
  Upload,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
  Hand,
  Image as ImageIcon,
  Save,
} from "lucide-react";
import Link from "next/link";
import PageHint from "@/components/PageHint";

interface WidgetChannel {
  type: string;
  url: string;
  label: string;
}

interface WidgetConfig {
  businessId: string;
  name: string;
  channels: WidgetChannel[];
  theme: {
    color: string;
    position: string;
    icon: string;
    customImageUrl: string | null;
    greeting: string;
  };
}

type IconId = "chat" | "dots" | "sparkle" | "wave" | "custom";
type Position = "br" | "bl";

const ICON_OPTIONS: { id: IconId; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Чат", icon: MessageSquare },
  { id: "dots", label: "Три точки", icon: MoreHorizontal },
  { id: "sparkle", label: "Искры", icon: Sparkles },
  { id: "wave", label: "Приветствие", icon: Hand },
];

export default function WidgetPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const codeBg = isDark ? "bg-black/50" : "bg-gray-50";
  const inputBg = isDark ? "bg-[#0a0a1a]" : "bg-white";

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://staffix.io");

  // Форма кастомизации (draft state, ещё не сохранён)
  const [color, setColor] = useState("#2563eb");
  const [position, setPosition] = useState<Position>("br");
  const [icon, setIcon] = useState<IconId>("chat");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [greeting, setGreeting] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const loadConfig = useCallback(async (businessId?: string) => {
    const id = businessId;
    if (!id) return;
    const res = await fetch(`/api/widget/${id}/config`);
    if (!res.ok) return;
    const cfg: WidgetConfig = await res.json();
    setConfig(cfg);
    setColor(cfg.theme.color);
    setPosition((cfg.theme.position as Position) || "br");
    setIcon((cfg.theme.icon as IconId) || "chat");
    setCustomImageUrl(cfg.theme.customImageUrl || "");
    setGreeting(cfg.theme.greeting || "");
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    fetch("/api/business")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        if (!d?.business?.id) return;
        await loadConfig(d.business.id);
      })
      .finally(() => setLoading(false));
  }, [loadConfig]);

  const snippet = config
    ? `<script async src="${origin}/widget/loader.js" data-business-id="${config.businessId}"></script>`
    : "";

  const copySnippet = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setSaveError("Файл слишком большой (макс 2 МБ)");
      return;
    }
    setUploading(true);
    setSaveError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/image", { method: "POST", body: form });
      if (!res.ok) {
        setSaveError((await res.json())?.error || "Ошибка загрузки");
        return;
      }
      const { url } = await res.json();
      setCustomImageUrl(url);
      setIcon("custom");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetColor: color,
          widgetPosition: position,
          widgetIcon: icon,
          widgetCustomImageUrl: icon === "custom" ? customImageUrl : "",
          widgetGreeting: greeting,
        }),
      });
      if (!res.ok) {
        setSaveError((await res.json())?.error || "Не удалось сохранить");
        return;
      }
      // Обновим локальный конфиг чтобы snippet ссылался на актуальный businessId
      if (config) await loadConfig(config.businessId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className={`h-8 w-8 animate-spin ${textSecondary}`} />
      </div>
    );
  }

  const hasChannels = config && config.channels.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <PageHint id="widget" />
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary}`}>Виджет для сайта</h1>
        <p className={textSecondary}>
          Плавающая кнопка на вашем сайте → посетитель открывает чат, ваш
          AI-бот отвечает прямо на сайте. Внизу окна — кнопки TG / WA / IG /
          Messenger как альтернатива для тех, кто предпочитает мессенджер.
        </p>
      </div>

      {!hasChannels && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className={`font-medium ${textPrimary}`}>
              Ни один канал не подключён
            </p>
            <p className={`text-sm ${textSecondary} mt-1`}>
              Виджет ничего не покажет, пока не подключите хотя бы один
              мессенджер.{" "}
              <Link href="/dashboard/channels" className="text-blue-500 underline">
                Открыть настройки каналов
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Кастомизация + live preview в две колонки */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Форма */}
        <div className={`${cardBg} border ${borderColor} rounded-xl p-5 space-y-5`}>
          <h3 className={`text-lg font-semibold ${textPrimary}`}>Настройки виджета</h3>

          {/* Позиция */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
              Положение на сайте
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["br", "bl"] as Position[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPosition(p)}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    position === p
                      ? "border-blue-500 bg-blue-500/10 text-blue-500"
                      : `${borderColor} ${textSecondary} hover:${textPrimary}`
                  }`}
                >
                  {p === "br" ? "↘ Справа-снизу" : "↙ Слева-снизу"}
                </button>
              ))}
            </div>
          </div>

          {/* Цвет */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
              Цвет кнопки
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer border-0"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                pattern="^#[0-9a-fA-F]{6}$"
                className={`flex-1 px-3 py-2 rounded-lg border ${borderColor} ${inputBg} ${textPrimary} text-sm font-mono`}
              />
              <div className="flex gap-1">
                {["#2563eb", "#7c3aed", "#059669", "#dc2626", "#0891b2", "#f59e0b"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setColor(preset)}
                    style={{ background: preset }}
                    className="h-8 w-8 rounded-full border border-white/20 hover:scale-110 transition-transform"
                    aria-label={`Цвет ${preset}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Иконка — 4 preset в ряд */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
              Иконка на кнопке
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ICON_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setIcon(opt.id)}
                    className={`aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border transition-colors ${
                      icon === opt.id
                        ? "border-blue-500 bg-blue-500/10"
                        : `${borderColor} hover:border-blue-500/50`
                    }`}
                    title={opt.label}
                  >
                    <Icon className={`h-5 w-5 ${icon === opt.id ? "text-blue-500" : textPrimary}`} />
                    <span className={`text-[10px] ${textSecondary}`}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Своя иконка — отдельная явная секция */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
              Или загрузите свою иконку
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />

            {icon === "custom" && customImageUrl ? (
              // Уже загружено: превью + Заменить + Удалить
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border-2 border-blue-500 bg-blue-500/10`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={customImageUrl}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover border border-white/30"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${textPrimary}`}>
                    Ваша иконка загружена
                  </p>
                  <p className={`text-xs ${textSecondary} truncate`}>
                    Она показывается на кнопке виджета вместо стандартной.
                  </p>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${borderColor} ${textPrimary} hover:bg-white/5 disabled:opacity-50`}
                >
                  Заменить
                </button>
                <button
                  onClick={() => {
                    setCustomImageUrl("");
                    setIcon("chat");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10"
                >
                  Удалить
                </button>
              </div>
            ) : (
              // Не загружено: одна большая явная кнопка
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-lg border-2 border-dashed ${borderColor} ${textPrimary} hover:border-blue-500 hover:bg-blue-500/5 transition-colors disabled:opacity-50`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-medium">Загружаем...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Загрузить свою иконку
                    </span>
                  </>
                )}
              </button>
            )}

            <p className={`text-xs ${textSecondary} mt-2`}>
              PNG или JPG, до 2 МБ. Лучше квадратная — мы обрежем в круг.
            </p>
          </div>

          {/* Приветствие */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
              Текст приветствия в панели
            </label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Здравствуйте! Напишите нам в удобный мессенджер:"
              maxLength={200}
              className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${inputBg} ${textPrimary} text-sm`}
            />
            <p className={`text-xs ${textSecondary} mt-1`}>
              Показывается над списком мессенджеров. Оставьте пустым для дефолта.
            </p>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить
            </button>
            {saved && (
              <span className="text-sm text-green-500 inline-flex items-center gap-1">
                <Check className="h-4 w-4" /> Сохранено
              </span>
            )}
            {saveError && (
              <span className="text-sm text-red-500">{saveError}</span>
            )}
          </div>
          <p className={`text-xs ${textSecondary}`}>
            Изменения появляются у посетителей вашего сайта в течение 5 минут (edge-кэш).
          </p>
        </div>

        {/* Live preview */}
        <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className={`px-4 py-2 border-b ${borderColor} text-xs ${textSecondary}`}>
            Превью
          </div>
          <div
            className="relative h-96 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          >
            <WidgetPreview
              color={color}
              position={position}
              icon={icon}
              customImageUrl={customImageUrl}
              greeting={greeting || "Здравствуйте! Напишите нам в удобный мессенджер:"}
              businessName={config?.name || "Ваш бизнес"}
              channels={config?.channels || []}
            />
          </div>
        </div>
      </div>

      {/* Snippet */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
            <Code className="h-5 w-5" />
            Код для вставки на сайт
          </h3>
          <button
            onClick={copySnippet}
            disabled={!snippet}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Скопировано" : "Скопировать"}
          </button>
        </div>
        <pre
          className={`${codeBg} border ${borderColor} rounded-lg p-3 text-xs overflow-x-auto ${textPrimary}`}
        >
          <code>{snippet || "Загружаем ваш код..."}</code>
        </pre>
        <p className={`text-xs ${textSecondary} mt-3`}>
          Вставьте эту строку перед закрывающим тегом{" "}
          <code className={`${codeBg} px-1.5 py-0.5 rounded ${textPrimary}`}>
            &lt;/body&gt;
          </code>{" "}
          на всех страницах сайта. Загрузка асинхронная — не тормозит сайт.
        </p>
      </div>

      {/* Инструкции по платформам */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Установка на популярных платформах
        </h3>
        <div className="space-y-4">
          <PlatformBlock
            title="WordPress"
            steps={[
              "Установите плагин «Insert Headers and Footers» (или используйте свою тему).",
              "Настройки → Insert Headers and Footers → поле «Scripts in Footer».",
              "Вставьте скопированный код, сохраните.",
            ]}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
          <PlatformBlock
            title="Tilda"
            steps={[
              "Настройки сайта → Ещё → HTML-код для вставки внутри HEAD/BODY.",
              "Выберите «Перед </body>».",
              "Вставьте код, сохраните и опубликуйте страницы.",
            ]}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
          <PlatformBlock
            title="Wix"
            steps={[
              "Settings → Custom Code → + Add Custom Code.",
              "Вставьте код, выберите «Body — end» и «All pages».",
              "Сохраните.",
            ]}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
          <PlatformBlock
            title="Чистый HTML"
            steps={[
              "Откройте index.html (или ваш layout-файл).",
              "Найдите </body> — вставьте код прямо перед ним.",
              "Загрузите обновлённый файл на сервер.",
            ]}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
          />
        </div>
      </div>

      {/* Управление */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
        <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>
          Как это работает
        </h3>
        <ul className={`text-sm ${textSecondary} space-y-2 list-disc list-inside`}>
          <li>
            <b>Чат прямо на сайте.</b> Посетитель кликает кнопку — открывается
            чат-окно с приветствием. Пишет сообщение — ваш AI-бот отвечает так
            же как в мессенджерах: знает услуги, товары, FAQ, умеет
            записывать / оформлять заказы.
          </li>
          <li>
            <b>Кнопки мессенджеров внизу окна.</b> Для тех кто предпочитает
            TG / WA / IG / Messenger — они там, автоматически показываются
            только подключённые каналы.
          </li>
          <li>
            <b>Диалоги в вашей CRM.</b> Веб-разговоры появляются в{" "}
            <b>Клиенты</b> с бейджем «web» — как обычные клиенты. Тот же
            dealStage, те же уведомления менеджерам.
          </li>
          <li>
            <b>Без cookies, без трекинга.</b> Виджет использует localStorage
            для visitor_id (чтобы посетитель не начинал каждый раз с нуля) —
            но никаких аналитик-скриптов не грузит.
          </li>
          <li>
            <b>Защита от спама.</b> Rate-limit 30 сообщений/час с одного IP +
            honeypot против ботов.
          </li>
          <li>
            <b>Стоимость.</b> Веб-сообщения считаются как обычные — входят в
            лимит вашего тарифа (Pro: 1000, Business: 3000).
          </li>
          <li>
            <b>WhatsApp</b> использует ваш телефон из <b>Настройки → Профиль</b>{" "}
            в формате <code>+998...</code>. Если поле пусто — кнопка WhatsApp
            скрыта.
          </li>
        </ul>
      </div>

      {/* Список подключённых каналов */}
      {hasChannels && (
        <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-3`}>
            Каналы в вашем виджете
          </h3>
          <div className="flex flex-wrap gap-2">
            {config!.channels.map((ch) => (
              <a
                key={ch.type}
                href={ch.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${borderColor} ${codeBg} text-sm ${textPrimary} hover:opacity-80`}
              >
                {ch.type === "telegram" && <Send className="h-4 w-4 text-sky-500" />}
                {ch.type === "instagram" && <Instagram className="h-4 w-4 text-pink-500" />}
                {ch.type === "messenger" && <Facebook className="h-4 w-4 text-blue-500" />}
                {ch.type === "whatsapp" && (
                  <span className="w-4 h-4 text-green-500 font-bold text-xs flex items-center justify-center">
                    W
                  </span>
                )}
                {ch.label}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Live preview компонент — reproduces the vanilla-JS widget визуально,
// но в React (проще управлять состоянием чем перегружать loader.js).
function WidgetPreview({
  color,
  position,
  icon,
  customImageUrl,
  greeting,
  businessName,
  channels,
}: {
  color: string;
  position: Position;
  icon: IconId;
  customImageUrl: string;
  greeting: string;
  businessName: string;
  channels: WidgetChannel[];
}) {
  const [open, setOpen] = useState(true); // в превью по умолчанию открыто
  const side = position === "bl" ? "left-3" : "right-3";
  const hasCustomImg = icon === "custom" && customImageUrl;

  const IconContent = () => {
    if (hasCustomImg) {
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={customImageUrl}
          alt=""
          className="w-full h-full object-cover rounded-full"
        />
      );
    }
    if (icon === "dots") return <MoreHorizontal className="h-6 w-6 text-white" />;
    if (icon === "sparkle") return <Sparkles className="h-6 w-6 text-white" />;
    if (icon === "wave") return <Hand className="h-6 w-6 text-white" />;
    return <MessageSquare className="h-6 w-6 text-white" />;
  };

  return (
    <>
      {open && (
        <div
          className={`absolute bottom-16 ${side} w-72 bg-white rounded-xl shadow-xl overflow-hidden flex flex-col`}
          style={{ height: "340px" }}
        >
          {/* Header с именем бизнеса на цвете виджета */}
          <div
            className="px-3 py-2 text-white text-xs font-semibold flex items-center justify-between"
            style={{ background: color }}
          >
            <span className="truncate">{businessName}</span>
            <span className="opacity-70 text-sm">×</span>
          </div>
          {/* Область сообщений — превью welcome */}
          <div className="flex-1 overflow-hidden bg-gray-50 p-3">
            <div className="flex justify-start mb-2">
              <div className="max-w-[80%] px-3 py-2 bg-white border border-gray-200 rounded-2xl rounded-bl-md text-xs text-gray-900">
                {greeting}
              </div>
            </div>
          </div>
          {/* Input row (визуал только) */}
          <div className="p-2 bg-white border-t border-gray-100 flex gap-1.5">
            <div className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-full text-xs text-gray-400">
              Напишите сообщение...
            </div>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs"
              style={{ background: color }}
            >
              →
            </div>
          </div>
          {/* Кнопки мессенджеров внизу */}
          {channels.length > 0 && (
            <div className="px-3 pt-1.5 pb-2 bg-white border-t border-gray-50">
              <div className="text-[9px] text-gray-500 mb-1">
                Или напишите в мессенджер:
              </div>
              <div className="flex gap-1.5">
                {channels.map((ch) => (
                  <div
                    key={ch.type}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
                    title={ch.label}
                  >
                    {ch.type === "telegram" && <Send className="h-3 w-3 text-sky-500" />}
                    {ch.type === "whatsapp" && (
                      <span className="text-green-500 font-bold text-[9px]">W</span>
                    )}
                    {ch.type === "instagram" && <Instagram className="h-3 w-3 text-pink-500" />}
                    {ch.type === "messenger" && <Facebook className="h-3 w-3 text-blue-500" />}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-[8px] text-gray-400 text-center py-1 bg-white">
            Powered by Staffix
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`absolute bottom-3 ${side} w-14 h-14 rounded-full shadow-lg flex items-center justify-center overflow-hidden transition-transform hover:scale-110`}
        style={{ background: hasCustomImg ? "transparent" : color }}
        aria-label="Preview toggle"
      >
        <IconContent />
      </button>
    </>
  );
}

function PlatformBlock({
  title,
  steps,
  textPrimary,
  textSecondary,
}: {
  title: string;
  steps: string[];
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <div>
      <p className={`font-medium ${textPrimary} mb-1`}>{title}</p>
      <ol className={`text-sm ${textSecondary} list-decimal list-inside space-y-1`}>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}
