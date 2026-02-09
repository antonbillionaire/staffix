"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Brain,
  ArrowLeft,
  Globe,
  ChevronDown,
  Check,
  Rocket,
  Bot,
  Send as SendIcon,
  Briefcase,
  Zap,
  Users,
  BarChart3,
  MessageSquare,
  PlayCircle,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages } from "@/lib/translations";

interface Tutorial {
  id: string;
  icon: typeof Rocket;
  titleKey: string;
  descKey: string;
  comingSoon: boolean;
}

const tutorials: Tutorial[] = [
  { id: "quickstart", icon: Rocket, titleKey: "tutorials.quickstart.title", descKey: "tutorials.quickstart.desc", comingSoon: true },
  { id: "ai-setup", icon: Bot, titleKey: "tutorials.aiSetup.title", descKey: "tutorials.aiSetup.desc", comingSoon: true },
  { id: "telegram", icon: SendIcon, titleKey: "tutorials.telegram.title", descKey: "tutorials.telegram.desc", comingSoon: true },
  { id: "services", icon: Briefcase, titleKey: "tutorials.services.title", descKey: "tutorials.services.desc", comingSoon: true },
  { id: "automations", icon: Zap, titleKey: "tutorials.automations.title", descKey: "tutorials.automations.desc", comingSoon: true },
  { id: "crm", icon: Users, titleKey: "tutorials.crm.title", descKey: "tutorials.crm.desc", comingSoon: true },
  { id: "broadcasts", icon: MessageSquare, titleKey: "tutorials.broadcasts.title", descKey: "tutorials.broadcasts.desc", comingSoon: true },
  { id: "analytics", icon: BarChart3, titleKey: "tutorials.analytics.title", descKey: "tutorials.analytics.desc", comingSoon: true },
];

export default function TutorialsPage() {
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
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t("tutorials.title")}
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("tutorials.subtitle")}
          </p>
        </div>

        {/* Tutorials grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {tutorials.map((tutorial) => {
            const Icon = tutorial.icon;
            return (
              <div
                key={tutorial.id}
                className="bg-[#12122a] border border-white/5 rounded-2xl p-6 hover:border-blue-500/20 transition-colors group relative"
              >
                {tutorial.comingSoon && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-yellow-500/10 text-yellow-400 text-xs font-medium px-2.5 py-1 rounded-full">
                      {t("tutorials.comingSoon")}
                    </span>
                  </div>
                )}
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <Icon className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t(tutorial.titleKey)}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  {t(tutorial.descKey)}
                </p>
                {tutorial.comingSoon ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <PlayCircle className="h-4 w-4" />
                    {t("tutorials.comingSoon")}
                  </div>
                ) : (
                  <button className="flex items-center gap-2 text-blue-400 text-sm hover:text-blue-300 transition-colors">
                    <PlayCircle className="h-4 w-4" />
                    {t("tutorials.watchNow")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t("faq.stillHaveQuestions")}
          </h2>
          <p className="text-gray-400 mb-6">
            {t("faq.contactUs")}
          </p>
          <Link
            href="/consultation"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            <MessageSquare className="h-4 w-4" />
            {t("faq.bookConsultation")}
          </Link>
        </div>
      </main>
    </div>
  );
}
