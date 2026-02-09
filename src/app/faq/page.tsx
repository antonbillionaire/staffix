"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Brain,
  ArrowLeft,
  Globe,
  ChevronDown,
  Check,
  Search,
  ChevronRight,
  HelpCircle,
  DollarSign,
  Gift,
  Settings,
  Cpu,
  CreditCard,
  Shield,
  MessageSquare,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages } from "@/lib/translations";
import { faqCategories } from "@/lib/faq-content";

const categoryIcons: Record<string, typeof HelpCircle> = {
  HelpCircle,
  DollarSign,
  Gift,
  Settings,
  Cpu,
  CreditCard,
  Shield,
};

export default function FaqPage() {
  const { t, language, setLanguage } = useLanguage();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close lang menu on outside click
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

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter by search and category
  const filteredCategories = faqCategories
    .filter((cat) => !activeCategory || cat.id === activeCategory)
    .map((cat) => ({
      ...cat,
      questions: cat.questions.filter((q) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          q.question[language].toLowerCase().includes(query) ||
          q.answer[language].toLowerCase().includes(query)
        );
      }),
    }))
    .filter((cat) => cat.questions.length > 0);

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
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t("faq.pageTitle")}
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            {t("faq.pageSubtitle")}
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("faq.search")}
              className="w-full bg-[#12122a] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              !activeCategory
                ? "bg-blue-600 text-white"
                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {t("faq.allCategories")}
          </button>
          {faqCategories.map((cat) => {
            const Icon = categoryIcons[cat.icon] || HelpCircle;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeCategory === cat.id
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {cat.title[language]}
              </button>
            );
          })}
        </div>

        {/* FAQ accordion */}
        <div className="space-y-8">
          {filteredCategories.map((cat) => (
            <div key={cat.id}>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                {(() => {
                  const Icon = categoryIcons[cat.icon] || HelpCircle;
                  return <Icon className="h-5 w-5 text-blue-400" />;
                })()}
                {cat.title[language]}
              </h2>
              <div className="space-y-2">
                {cat.questions.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#12122a] border border-white/5 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="text-white font-medium pr-4">
                        {item.question[language]}
                      </span>
                      <ChevronRight
                        className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${
                          expandedItems.has(item.id) ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                    {expandedItems.has(item.id) && (
                      <div className="px-5 pb-4">
                        <div className="text-gray-400 text-sm leading-relaxed whitespace-pre-line border-t border-white/5 pt-4">
                          {item.answer[language]}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">{t("faq.noResults") || "No results found"}</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t("faq.stillHaveQuestions")}
          </h2>
          <p className="text-gray-400 mb-6">
            {t("faq.contactUs")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/consultation"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              <MessageSquare className="h-4 w-4" />
              {t("faq.bookConsultation")}
            </Link>
            <Link
              href="/contacts"
              className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/10 transition-colors"
            >
              {t("faq.contactSupport") || "Contact Support"}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
