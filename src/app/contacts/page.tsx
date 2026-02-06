"use client";

import Link from "next/link";
import { Brain, ArrowLeft, Mail, Send, Clock, MessageCircle } from "lucide-react";

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Staffix</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              На главную
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Свяжитесь с нами</h1>
          <p className="text-xl text-gray-400">
            Мы всегда рады помочь вам с любыми вопросами
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Email */}
          <a
            href="mailto:support@staffix.io"
            className="group bg-[#12122a] border border-white/5 rounded-2xl p-8 hover:border-blue-500/30 transition-all"
          >
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
              <Mail className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Email</h2>
            <p className="text-blue-400 text-lg mb-4">support@staffix.io</p>
            <p className="text-gray-400 text-sm">
              Напишите нам по любым вопросам. Мы отвечаем в течение 24 часов.
            </p>
          </a>

          {/* Telegram */}
          <a
            href="https://t.me/staffix_support_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-[#12122a] border border-white/5 rounded-2xl p-8 hover:border-blue-500/30 transition-all"
          >
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
              <Send className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Telegram</h2>
            <p className="text-blue-400 text-lg mb-4">@staffix_support_bot</p>
            <p className="text-gray-400 text-sm">
              Быстрая поддержка в Telegram. AI-ассистент ответит мгновенно!
            </p>
          </a>
        </div>

        {/* Additional info */}
        <div className="mt-12 bg-[#12122a] border border-white/5 rounded-2xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">
            Часто задаваемые вопросы
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Время работы поддержки</h3>
                <p className="text-gray-400 text-sm">
                  Telegram-бот работает 24/7. Email-поддержка: Пн-Пт 9:00-18:00 (UTC+5)
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Среднее время ответа</h3>
                <p className="text-gray-400 text-sm">
                  Telegram: мгновенно (AI) / до 2 часов (специалист). Email: до 24 часов.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="mt-12 bg-[#12122a] border border-white/5 rounded-2xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">
            Юридическая информация
          </h2>
          <div className="max-w-md mx-auto space-y-3 text-gray-300">
            <p className="text-gray-400 text-sm mb-4">Staffix — SaaS-платформа, разработанная и управляемая:</p>
            <p className="text-white font-medium text-lg">K-Bridge Co. LTD</p>
            <p className="text-gray-400 text-sm">유한회사 케이브릿지</p>
            <p><span className="text-gray-500">Регистрационный номер:</span> 606-88-02444</p>
            <p><span className="text-gray-500">Страна:</span> South Korea</p>
            <p><span className="text-gray-500">Адрес:</span> Convensia daero 165, 26 floor, V553, Posco Tower Songdo, Incheon</p>
            <p>
              <span className="text-gray-500">Телефон:</span>{" "}
              <a href="tel:+821027181424" className="text-blue-400 hover:text-blue-300">+82 10 2718 1424</a>
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 mb-6">
            Хотите узнать больше о Staffix?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Начать бесплатно
            </Link>
            <Link
              href="/pricing"
              className="bg-white/5 border border-white/10 text-white px-8 py-3 rounded-xl font-medium hover:bg-white/10 transition-colors"
            >
              Посмотреть тарифы
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          © 2025 Staffix. Все права защищены.
        </div>
      </footer>
    </div>
  );
}
