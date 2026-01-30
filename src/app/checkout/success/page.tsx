"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Brain,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Bot,
  BarChart3,
} from "lucide-react";

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Auto redirect countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Staffix</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Success icon */}
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="h-12 w-12 text-green-400" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">
            Оплата прошла успешно!
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Добро пожаловать в Staffix! Ваша подписка активирована.
          </p>

          {/* Next steps */}
          <div className="bg-[#12122a] rounded-2xl border border-white/5 p-8 mb-8 text-left">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              Что делать дальше?
            </h2>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Настройте AI-сотрудника</h3>
                  <p className="text-sm text-gray-400">
                    Подключите Telegram бота и настройте личность AI
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Следите за аналитикой</h3>
                  <p className="text-sm text-gray-400">
                    Отслеживайте эффективность и записи клиентов
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-medium hover:opacity-90 transition-all"
            >
              Перейти в дашборд
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/dashboard/bot"
              className="inline-flex items-center justify-center gap-2 bg-white/10 text-white py-3 px-6 rounded-xl font-medium hover:bg-white/20 transition-all"
            >
              Настроить бота
            </Link>
          </div>

          <p className="text-gray-500 text-sm mt-6">
            Автоматический переход через {countdown} сек...
          </p>
        </div>
      </main>
    </div>
  );
}
