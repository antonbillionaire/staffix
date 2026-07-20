"use client";

/**
 * Дашборд-страница «Виджет для сайта» (Sprint Widget, 21 июля 2026).
 * Показывает готовый snippet, превью, список подключённых каналов и
 * пошаговые инструкции установки на WordPress / Tilda / Wix / чистый HTML.
 */

import { useState, useEffect } from "react";
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
} from "lucide-react";
import Link from "next/link";

interface WidgetChannel {
  type: string;
  url: string;
  label: string;
}

interface WidgetConfig {
  businessId: string;
  name: string;
  channels: WidgetChannel[];
  theme: { color: string; position: string; greeting: string };
}

export default function WidgetPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const codeBg = isDark ? "bg-black/50" : "bg-gray-50";

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://staffix.io");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    fetch("/api/business")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.business?.id) {
          setLoading(false);
          return;
        }
        // Дёргаем публичный config сами — так владелец видит ровно то что увидят
        // посетители его сайта (без спец. авторизации).
        return fetch(`/api/widget/${d.business.id}/config`)
          .then((r) => (r.ok ? r.json() : null))
          .then((cfg) => setConfig(cfg));
      })
      .finally(() => setLoading(false));
  }, []);

  const snippet = config
    ? `<script async src="${origin}/widget/loader.js" data-business-id="${config.businessId}"></script>`
    : "";

  const copySnippet = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary}`}>Виджет для сайта</h1>
        <p className={textSecondary}>
          Разместите плавающую кнопку на своём сайте — посетитель одним кликом
          попадёт в переписку с вашим AI-сотрудником через Telegram / WhatsApp /
          Instagram / Messenger.
        </p>
      </div>

      {/* Warning: нет активных каналов */}
      {!hasChannels && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className={`font-medium ${textPrimary}`}>
              Ни один канал не подключён
            </p>
            <p className={`text-sm ${textSecondary} mt-1`}>
              Виджет ничего не покажет, пока вы не подключите хотя бы один
              мессенджер.{" "}
              <Link href="/dashboard/channels" className="text-blue-500 underline">
                Открыть настройки каналов
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Список подключённых каналов */}
      {hasChannels && (
        <div className={`${cardBg} border ${borderColor} rounded-xl p-5`}>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-3`}>
            Что увидит посетитель
          </h3>
          <p className={`text-sm ${textSecondary} mb-4`}>
            В виджете будут доступны эти каналы (те что вы уже подключили):
          </p>
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
                {ch.type === "whatsapp" && <span className="w-4 h-4 text-green-500 font-bold text-xs flex items-center justify-center">W</span>}
                {ch.label}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            ))}
          </div>
          <p className={`text-xs ${textSecondary} mt-3`}>
            {config!.channels.length < 4
              ? `Подключите остальные каналы в разделе «Каналы» — они автоматически появятся в виджете без переустановки.`
              : `Все четыре канала подключены.`}
          </p>
        </div>
      )}

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
          на всех страницах вашего сайта. Скрипт грузится асинхронно — не
          тормозит сайт.
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
          Управление и обновления
        </h3>
        <ul className={`text-sm ${textSecondary} space-y-2 list-disc list-inside`}>
          <li>
            Виджет обновляется автоматически — при подключении нового канала
            он появится в виджете без переустановки кода.
          </li>
          <li>
            Если вы отключаете канал в Staffix — соответствующая кнопка
            пропадает у посетителя в течение 5 минут.
          </li>
          <li>
            Виджет не использует cookies и не отслеживает посетителей — только
            переводит клик в мессенджер.
          </li>
          <li>
            Если WhatsApp не работает — проверьте что в профиле бизнеса указан
            корректный номер телефона в международном формате (+998...).
          </li>
        </ul>
      </div>
    </div>
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
