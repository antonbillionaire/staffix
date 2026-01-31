"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie-consent", "accepted");
    localStorage.setItem("cookie-consent-date", new Date().toISOString());
    setShowBanner(false);
  };

  const declineCookies = () => {
    localStorage.setItem("cookie-consent", "declined");
    localStorage.setItem("cookie-consent-date", new Date().toISOString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="max-w-4xl mx-auto bg-[#1a1a3a] border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {/* Icon and text */}
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Cookie className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-medium mb-1">Мы используем cookies</p>
              <p className="text-gray-400 text-sm">
                Мы используем файлы cookie для улучшения работы сайта, анализа трафика и персонализации.
                Продолжая использовать сайт, вы соглашаетесь с{" "}
                <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
                  Политикой конфиденциальности
                </Link>.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={declineCookies}
              className="flex-1 md:flex-none px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
              Отклонить
            </button>
            <button
              onClick={acceptCookies}
              className="flex-1 md:flex-none px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:opacity-90 transition-opacity"
            >
              Принять
            </button>
          </div>

          {/* Close button (mobile) */}
          <button
            onClick={declineCookies}
            className="absolute top-2 right-2 md:hidden p-1 text-gray-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
