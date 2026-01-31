"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MessageCircle,
  Send,
  Loader2,
  Check,
  HelpCircle,
  Book,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const faqItems = [
  {
    question: "Как настроить AI-сотрудника?",
    answer: "Перейдите в раздел 'AI-сотрудник' в меню, выберите характер и стиль общения, добавьте информацию о ваших услугах и FAQ. AI автоматически начнёт отвечать клиентам в соответствии с настройками.",
  },
  {
    question: "Как подключить Telegram бота?",
    answer: "После завершения онбординга вы получите ссылку на готового Telegram бота. Просто поделитесь этой ссылкой с клиентами или разместите на вашем сайте.",
  },
  {
    question: "Что входит в пробный период?",
    answer: "В пробный период (14 дней) входят все функции стартового плана: 100 сообщений, 1 AI-сотрудник, базовая аналитика и email поддержка.",
  },
  {
    question: "Как увеличить лимит сообщений?",
    answer: "Перейдите в Настройки → Подписка и выберите подходящий тарифный план. После оплаты лимит будет увеличен автоматически.",
  },
];

export default function SupportPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    priority: "normal",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Theme-based classes
  const isDark = theme === "dark";
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка отправки");
      }

      setSent(true);
      setFormData({ subject: "", message: "", priority: "normal" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки. Попробуйте позже.");
    } finally {
      setSending(false);
    }
  };

  const handleViewMessages = () => {
    router.push("/dashboard/messages");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>Центр поддержки</h2>
        <p className={textSecondary}>
          Мы всегда готовы помочь вам с любыми вопросами
        </p>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className={`${bgCard} rounded-xl border ${borderColor} p-5`}>
          <div className={`w-10 h-10 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} rounded-lg flex items-center justify-center mb-3`}>
            <Book className="h-5 w-5 text-blue-500" />
          </div>
          <h3 className={`font-medium ${textPrimary} mb-1`}>База знаний</h3>
          <p className={`text-sm ${textSecondary}`}>
            Статьи и руководства по использованию
          </p>
        </div>
        <a
          href="https://t.me/staffix_support_bot"
          target="_blank"
          rel="noopener noreferrer"
          className={`${bgCard} rounded-xl border ${borderColor} p-5 block hover:border-purple-500/50 transition-colors`}
        >
          <div className={`w-10 h-10 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'} rounded-lg flex items-center justify-center mb-3`}>
            <MessageSquare className="h-5 w-5 text-purple-500" />
          </div>
          <h3 className={`font-medium ${textPrimary} mb-1`}>Telegram</h3>
          <p className={`text-sm ${textSecondary}`}>
            @staffix_support_bot
          </p>
        </a>
        <div className={`${bgCard} rounded-xl border ${borderColor} p-5`}>
          <div className={`w-10 h-10 ${isDark ? 'bg-green-500/10' : 'bg-green-50'} rounded-lg flex items-center justify-center mb-3`}>
            <Clock className="h-5 w-5 text-green-500" />
          </div>
          <h3 className={`font-medium ${textPrimary} mb-1`}>Время ответа</h3>
          <p className={`text-sm ${textSecondary}`}>
            Обычно отвечаем в течение часа
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Contact form */}
        <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className={`text-lg font-medium ${textPrimary}`}>Написать нам</h3>
              <p className={`text-sm ${textSecondary}`}>Опишите вашу проблему</p>
            </div>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <div className={`w-16 h-16 ${isDark ? 'bg-green-500/10' : 'bg-green-50'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h4 className={`text-lg font-medium ${textPrimary} mb-2`}>
                Сообщение отправлено!
              </h4>
              <p className={`${textSecondary} mb-4`}>
                Мы ответим вам в ближайшее время. Ответ придёт в раздел "Сообщения".
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleViewMessages}
                  className="text-blue-500 hover:text-blue-400 font-medium"
                >
                  Перейти в сообщения
                </button>
                <button
                  onClick={() => setSent(false)}
                  className={`text-sm ${textSecondary}`}
                >
                  Отправить ещё одно сообщение
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Тема обращения
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Например: Проблема с настройкой бота"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Приоритет
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="low" className={bgCard}>Низкий</option>
                  <option value="normal" className={bgCard}>Обычный</option>
                  <option value="high" className={bgCard}>Высокий</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Сообщение
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none`}
                  placeholder="Опишите вашу проблему подробно..."
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Отправить
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* FAQ */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'} rounded-lg flex items-center justify-center`}>
              <HelpCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <h3 className={`text-lg font-medium ${textPrimary}`}>Частые вопросы</h3>
              <p className={`text-sm ${textSecondary}`}>Быстрые ответы</p>
            </div>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}
              >
                <button
                  onClick={() =>
                    setExpandedFaq(expandedFaq === index ? null : index)
                  }
                  className={`w-full flex items-center justify-between p-4 text-left ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition-colors`}
                >
                  <span className={`font-medium ${textPrimary}`}>{item.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className={`h-5 w-5 ${textSecondary}`} />
                  ) : (
                    <ChevronDown className={`h-5 w-5 ${textSecondary}`} />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-4 pb-4">
                    <p className={`${textSecondary} text-sm`}>{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
