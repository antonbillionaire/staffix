"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Brain,
  ArrowLeft,
  Globe,
  ChevronDown,
  Check,
  Search,
  Bot,
  CalendarCheck,
  Zap,
  Send,
  Radio,
  Briefcase,
  Users,
  BookOpen,
  UserCog,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages } from "@/lib/translations";
import { docSections } from "@/lib/docs-content";

const sectionIcons: Record<string, typeof Brain> = {
  Brain,
  CalendarCheck,
  Bot,
  Zap,
  Send,
  Radio,
  Briefcase,
  Users,
  BookOpen,
  UserCog,
  BarChart3,
};

export default function DocsPage() {
  const { t, language, setLanguage } = useLanguage();
  const searchParams = useSearchParams();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(searchParams.get("section") || docSections[0]?.id || "overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const currentSection = docSections.find((s) => s.id === activeSection) || docSections[0];

  // Filter sections by search
  const filteredSections = searchQuery
    ? docSections.filter(
        (s) =>
          s.title[language].toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description[language].toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.content[language].toLowerCase().includes(searchQuery.toLowerCase())
      )
    : docSections;

  // Simple markdown-like renderer
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 mb-4 text-gray-300">
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">{renderInline(item)}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const renderInline = (text: string): React.ReactNode => {
      // Bold
      const parts = text.split(/\*\*(.*?)\*\*/g);
      return parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="text-white font-semibold">{part}</strong>
        ) : (
          part
        )
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={i} className="text-lg font-semibold text-white mt-6 mb-2">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        inList = true;
        listItems.push(line.slice(2));
      } else if (line.match(/^\d+\.\s/)) {
        inList = true;
        listItems.push(line.replace(/^\d+\.\s/, ""));
      } else if (line.trim() === "") {
        flushList();
      } else {
        flushList();
        elements.push(
          <p key={i} className="text-gray-300 leading-relaxed mb-3">
            {renderInline(line)}
          </p>
        );
      }
    }
    flushList();
    return elements;
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/5 bg-[#0a0a1a]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-400 hover:text-white"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Staffix</span>
              </Link>
            </div>
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside
            className={`
              fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] w-72
              bg-[#0a0a1a] lg:bg-transparent
              border-r border-white/5 lg:border-none
              z-30 lg:z-auto
              transform transition-transform lg:transform-none
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
              overflow-y-auto flex-shrink-0
            `}
          >
            <div className="p-4 lg:p-0">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("docs.search")}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <nav className="space-y-1">
                {filteredSections.map((section) => {
                  const Icon = sectionIcons[section.icon] || Brain;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors ${
                        activeSection === section.id
                          ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                          : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium">{section.title[language]}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-[#12122a] border border-white/5 rounded-2xl p-6 md:p-10">
              {/* Section header */}
              <div className="mb-8 pb-6 border-b border-white/5">
                <div className="flex items-center gap-3 mb-2">
                  {(() => {
                    const Icon = sectionIcons[currentSection.icon] || Brain;
                    return (
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                        <Icon className="h-5 w-5 text-blue-400" />
                      </div>
                    );
                  })()}
                  <h1 className="text-2xl md:text-3xl font-bold text-white">
                    {currentSection.title[language]}
                  </h1>
                </div>
                <p className="text-gray-400 ml-[52px]">
                  {currentSection.description[language]}
                </p>
              </div>

              {/* Content */}
              <div className="prose-sm">
                {renderContent(currentSection.content[language])}
              </div>

              {/* Navigation */}
              <div className="mt-10 pt-6 border-t border-white/5 flex justify-between">
                {(() => {
                  const currentIdx = docSections.findIndex((s) => s.id === activeSection);
                  const prev = currentIdx > 0 ? docSections[currentIdx - 1] : null;
                  const next = currentIdx < docSections.length - 1 ? docSections[currentIdx + 1] : null;
                  return (
                    <>
                      {prev ? (
                        <button
                          onClick={() => setActiveSection(prev.id)}
                          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          {prev.title[language]}
                        </button>
                      ) : (
                        <div />
                      )}
                      {next ? (
                        <button
                          onClick={() => setActiveSection(next.id)}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
                        >
                          {next.title[language]}
                          <ChevronDown className="h-4 w-4 -rotate-90" />
                        </button>
                      ) : (
                        <div />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
