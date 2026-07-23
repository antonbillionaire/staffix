"use client";

/**
 * DashboardHelper — встроенный AI-помощник для владельца бизнеса.
 * Плавающая кнопка справа-снизу на всех страницах дашборда.
 *
 * Клик → открывается панель чата 380×540. Владелец задаёт вопрос —
 * помощник отвечает используя всю документацию Staffix + текущее состояние
 * бизнеса. Ссылки на страницы дашборда автоматически становятся кликабельными.
 *
 * Persistent state:
 *   - открыт/закрыт → localStorage['staffix_helper_open']
 *   - история диалога → localStorage['staffix_helper_history'] (20 msg max)
 *   - показывать ли вообще → localStorage['staffix_helper_disabled']
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sparkles, X, Send as SendIcon, Loader2, MessageCircleQuestion } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_OPEN = "staffix_helper_open";
const STORAGE_HISTORY = "staffix_helper_history";
const STORAGE_DISABLED = "staffix_helper_disabled";
const MAX_HISTORY = 20;

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Здравствуйте! Я помощник Staffix. Спросите как настроить что-то в дашборде, где посмотреть данные или что делать если бот не отвечает — постараюсь помочь.",
};

const SUGGESTIONS = [
  "Как настроить Telegram?",
  "Что такое база знаний?",
  "Как посмотреть статистику?",
];

/** Заменяет `/dashboard/xxx` в тексте на кликабельные ссылки. */
function renderWithLinks(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`?\/(dashboard|docs)(?:\/[a-z0-9-]+)*(?:\?[a-z0-9=&_-]+)?`?)/gi;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.substring(lastIdx, m.index));
    // Убираем обрамляющие backticks если есть
    const raw = m[0].replace(/^`|`$/g, "");
    parts.push(
      <Link
        key={`lnk-${key++}`}
        href={raw}
        className="text-blue-500 underline hover:text-blue-400"
      >
        {raw}
      </Link>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(text.substring(lastIdx));
  return parts;
}

/** Простой парсер \n → <br>, чтобы ответы с нумерацией красиво выглядели. */
function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {renderWithLinks(line)}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

export default function DashboardHelper() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // При первом монтировании — восстанавливаем состояние из localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const isDisabled = localStorage.getItem(STORAGE_DISABLED) === "1";
      if (isDisabled) {
        setDisabled(true);
        return;
      }
      const wasOpen = localStorage.getItem(STORAGE_OPEN) === "1";
      const raw = localStorage.getItem(STORAGE_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
      // Открываем панель при возврате только если пользователь её оставил открытой
      // и есть история — иначе первый заход "чистый".
      if (wasOpen && raw) setOpen(true);
    } catch {
      // localStorage может быть отключён — не критично
    }
  }, []);

  // Сохраняем состояние
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_OPEN, open ? "1" : "0");
    } catch { /* ignore */ }
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch { /* ignore */ }
  }, [messages, mounted]);

  // Автоскролл вниз при новом сообщении
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, sending]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      setInput("");
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setSending(true);

      try {
        const res = await fetch("/api/dashboard/ai-helper/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Не шлём welcome-сообщение в API — оно чисто клиентское
            messages: nextMessages.filter((m) => m !== WELCOME_MESSAGE).slice(-MAX_HISTORY),
            currentPagePath: pathname,
          }),
        });
        const data = await res.json();
        const reply: string =
          typeof data?.reply === "string"
            ? data.reply
            : "Не удалось получить ответ. Попробуйте ещё раз.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Не удалось связаться с помощником. Проверьте интернет и попробуйте ещё раз.",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, pathname]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleClearHistory() {
    setMessages([WELCOME_MESSAGE]);
  }

  function handleDisable() {
    if (!confirm("Отключить помощника? Вы сможете вернуть его в настройках позже.")) return;
    setDisabled(true);
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_DISABLED, "1");
    } catch { /* ignore */ }
  }

  // SSR: не рендерим ничего до монтирования (избегаем hydration mismatch)
  if (!mounted) return null;

  // Владелец отключил помощник через меню
  if (disabled) return null;

  const panelBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-[#0a0a1a]" : "bg-gray-50";

  return (
    <>
      {/* Кнопка-триггер. Сдвигаем над ChatWidget'ом поддержки (bottom-6 right-6,
          56x56) — Helper выше, чтобы обе кнопки видны и не перекрывались. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Открыть помощник"
          className="fixed right-6 z-[9998] rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg hover:scale-110 transition-transform flex items-center justify-center text-white"
          style={{ width: 52, height: 52, bottom: 96 }}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Панель чата — тоже сдвинута повыше чтобы не наезжать на ChatWidget */}
      {open && (
        <div
          className={`fixed right-5 z-[9998] w-[380px] max-w-[calc(100vw-24px)] h-[540px] max-h-[calc(100vh-40px)] ${panelBg} border ${borderColor} rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
          style={{ bottom: 20 }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">Помощник Staffix</div>
                <div className="text-[10px] opacity-80">Спросите о любой функции</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Начать новый разговор"
                className="p-1.5 hover:bg-white/10 rounded transition-colors text-xs"
              >
                Сброс
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Свернуть"
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDark ? "bg-[#0a0a1a]" : "bg-gray-50"}`}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : isDark
                      ? "bg-white/10 text-white rounded-bl-md"
                      : "bg-white text-gray-900 border border-gray-200 rounded-bl-md"
                  }`}
                >
                  {renderContent(m.content)}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div
                  className={`px-3 py-2 rounded-2xl ${
                    isDark ? "bg-white/10" : "bg-white border border-gray-200"
                  }`}
                >
                  <Loader2 className={`h-4 w-4 animate-spin ${textSecondary}`} />
                </div>
              </div>
            )}

            {/* Suggestions — только когда истории почти нет */}
            {messages.length === 1 && !sending && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border ${borderColor} ${textSecondary} hover:${textPrimary} transition-colors`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className={`p-3 border-t ${borderColor} flex items-center gap-2 flex-shrink-0`}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Задайте вопрос..."
              maxLength={2000}
              disabled={sending}
              className={`flex-1 px-3 py-2 rounded-full border ${borderColor} ${inputBg} ${textPrimary} text-sm focus:outline-none focus:border-blue-500`}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center disabled:opacity-40 hover:scale-105 transition-transform flex-shrink-0"
              aria-label="Отправить"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>

          {/* Footer с disable */}
          <div className={`px-3 py-1.5 border-t ${borderColor} flex items-center justify-between text-[10px] ${textSecondary} flex-shrink-0`}>
            <span className="flex items-center gap-1">
              <MessageCircleQuestion className="h-3 w-3" />
              Помощник видит ваши данные бизнеса
            </span>
            <button
              onClick={handleDisable}
              className="hover:underline"
            >
              Отключить
            </button>
          </div>
        </div>
      )}
    </>
  );
}
