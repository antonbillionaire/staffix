"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Brain,
  ArrowLeft,
  Globe,
  ChevronDown,
  Check,
  Bot,
  Video,
  Clock,
  Shield,
  Zap,
  MessageSquare,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages } from "@/lib/translations";
import ConsultationChat from "@/components/ConsultationChat";
import ZoomBookingForm from "@/components/ZoomBookingForm";

export default function ConsultationPage() {
  const { t, language, setLanguage } = useLanguage();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = languages.find((l) => l.id === language);

  const benefits = [
    { icon: Bot, titleKey: "consultation.benefits.ai.title", descKey: "consultation.benefits.ai.desc" },
    { icon: Clock, titleKey: "consultation.benefits.fast.title", descKey: "consultation.benefits.fast.desc" },
    { icon: Shield, titleKey: "consultation.benefits.free.title", descKey: "consultation.benefits.free.desc" },
    { icon: Zap, titleKey: "consultation.benefits.expert.title", descKey: "consultation.benefits.expert.desc" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Staffix</span>
            </Link>
            <div className="flex items-center gap-4">
              {/* Language selector */}
              <div className="relative" ref={langMenuRef}>
                <button
                  onClick={() => setLangMenuOpen(!langMenuOpen)}
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
                >
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">{currentLang?.flag} {currentLang?.name}</span>
                  <span className="sm:hidden">{currentLang?.flag}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${langMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {langMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#12122a] border border-white/10 rounded-xl shadow-xl py-2 z-50">
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => {
                          setLanguage(lang.id);
                          setLangMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                          language === lang.id ? "text-blue-400" : "text-gray-300"
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                        {language === lang.id && <Check className="h-4 w-4 ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("home.nav.home") || "Home"}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t("consultation.title")}
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("consultation.subtitle")}
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {/* AI Chat */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">
                {t("consultation.aiChat.sectionTitle")}
              </h2>
            </div>
            <ConsultationChat />
          </div>

          {/* Zoom Booking */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">
                {t("consultation.zoom.sectionTitle")}
              </h2>
            </div>
            <ZoomBookingForm />
          </div>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            return (
              <div key={idx} className="bg-[#12122a] border border-white/5 rounded-xl p-5 text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Icon className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-1">{t(benefit.titleKey)}</h3>
                <p className="text-gray-400 text-sm">{t(benefit.descKey)}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
