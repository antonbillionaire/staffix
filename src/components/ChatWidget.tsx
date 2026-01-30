"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const initialMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Здравствуйте! 👋 Я AI-помощник Staffix. Чем могу помочь?\n\nВы можете спросить меня о:\n• Настройке AI-сотрудника\n• Подключении Telegram бота\n• Тарифных планах\n• Технических вопросах",
  },
];

// Predefined responses for common questions
const quickResponses: Record<string, string> = {
  "привет": "Здравствуйте! Чем могу помочь?",
  "здравствуйте": "Здравствуйте! Рад вас видеть. Чем могу помочь?",
  "настроить бота": "Для настройки AI-бота:\n\n1. Перейдите в раздел «AI-сотрудник»\n2. Выберите характер общения\n3. Добавьте информацию о ваших услугах\n4. Загрузите документы в «Базу знаний»\n\nБот автоматически начнёт использовать эту информацию для ответов клиентам.",
  "подключить telegram": "Для подключения Telegram бота:\n\n1. Создайте бота через @BotFather в Telegram\n2. Скопируйте токен бота\n3. Вставьте токен в настройках AI-сотрудника\n4. Бот автоматически активируется\n\nНужна подробная инструкция?",
  "тарифы": "У нас есть 3 тарифа:\n\n🆓 **Бесплатный** - 100 сообщений/мес\n💼 **Pro $50** - 2000 сообщений, аналитика\n🏢 **Business $100** - безлимит, приоритетная поддержка\n\nПодробнее на странице /pricing",
  "цены": "У нас есть 3 тарифа:\n\n🆓 **Бесплатный** - 100 сообщений/мес\n💼 **Pro $50** - 2000 сообщений, аналитика\n🏢 **Business $100** - безлимит, приоритетная поддержка",
  "пробный период": "Пробный период включает:\n\n• 14 дней бесплатного использования\n• 100 сообщений\n• Все функции стартового плана\n• Email поддержка\n\nПосле окончания можете выбрать подходящий тариф.",
  "помощь": "Я могу помочь с:\n\n• Настройкой AI-сотрудника\n• Подключением Telegram бота\n• Вопросами о тарифах\n• Техническими проблемами\n\nПросто напишите ваш вопрос!",
};

function findResponse(message: string): string | null {
  const lower = message.toLowerCase();

  for (const [key, response] of Object.entries(quickResponses)) {
    if (lower.includes(key)) {
      return response;
    }
  }

  return null;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate thinking delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

    // Find response or use default
    const quickResponse = findResponse(userMessage.content);
    const response = quickResponse ||
      "Спасибо за вопрос! Для более детальной помощи, пожалуйста, напишите в форму поддержки на этой странице или свяжитесь с нами в Telegram: @staffix_support_bot";

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-all hover:scale-105 z-50"
        title="Онлайн помощник"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-48px)] bg-[#12122a] border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">AI Помощник</h3>
              <p className="text-white/70 text-sm">Онлайн</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96 min-h-64">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white/10 text-white rounded-bl-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2 className="h-5 w-5 text-white/70 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Напишите сообщение..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors"
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
