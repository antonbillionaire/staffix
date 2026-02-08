"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Brain,
  MessageSquare,
  Calendar,
  Clock,
  Shield,
  Zap,
  ChevronRight,
  Star,
  Check,
  ArrowRight,
  Sparkles,
  Quote,
  Globe,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages } from "@/lib/translations";

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const [industryIndex, setIndustryIndex] = useState(0);
  const [chatIndex, setChatIndex] = useState(0);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const industries = [
    t("home.industry.beautySalons"),
    t("home.industry.barbershops"),
    t("home.industry.medicalClinics"),
    t("home.industry.autoServices"),
    t("home.industry.spaCenters"),
    t("home.industry.yourBusiness"),
  ];

  const chatExamples = [
    {
      userMessage: t("home.chat1.user"),
      botMessage: t("home.chat1.bot"),
    },
    {
      userMessage: t("home.chat2.user"),
      botMessage: t("home.chat2.bot"),
    },
    {
      userMessage: t("home.chat3.user"),
      botMessage: t("home.chat3.bot"),
    },
  ];

  // Rotate industries
  useEffect(() => {
    const interval = setInterval(() => {
      setIndustryIndex((prev) => (prev + 1) % industries.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [industries.length]);

  // Rotate chat examples
  useEffect(() => {
    const interval = setInterval(() => {
      setChatIndex((prev) => (prev + 1) % chatExamples.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [chatExamples.length]);

  // Close lang menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentLang = languages.find((l) => l.id === language);

  const regularBotItems = [
    t("home.regularBot.item1"),
    t("home.regularBot.item2"),
    t("home.regularBot.item3"),
    t("home.regularBot.item4"),
    t("home.regularBot.item5"),
  ];

  const aiEmployeeItems = [
    t("home.aiEmployee.item1"),
    t("home.aiEmployee.item2"),
    t("home.aiEmployee.item3"),
    t("home.aiEmployee.item4"),
    t("home.aiEmployee.item5"),
  ];

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden">
      {/* Animated background gradient - reduced on mobile for performance */}
      <div className="fixed inset-0 pointer-events-none hidden md:block">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>
      <div className="fixed inset-0 pointer-events-none md:hidden">
        <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[60px]" />
        <div className="absolute bottom-0 right-1/4 w-[250px] h-[250px] bg-purple-500/15 rounded-full blur-[60px]" />
      </div>

      {/* Header */}
      <header className="relative z-50 container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Staffix</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
              {t("home.nav.features")}
            </Link>
            <Link href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">
              {t("home.nav.howItWorks")}
            </Link>
            <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
              {t("home.nav.pricing")}
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
              href="/login"
              className="text-gray-300 hover:text-white transition-colors"
            >
              {t("home.nav.login")}
            </Link>
            <Link
              href="/register"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              {t("home.nav.startFree")}
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 pt-20 pb-32">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <span className="text-sm text-gray-300">{t("home.badge")}</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            {t("home.heroTitle")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
              {industries[industryIndex]}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            {t("home.heroDesc1")} <span className="text-white font-medium">{t("home.heroDesc2")}</span>
            {t("home.heroDesc3")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href="/register"
              className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              {t("home.ctaPrimary")}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              {t("home.ctaSecondary")}
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>

          <p className="text-sm text-gray-500">
            {t("home.trialNote")}
          </p>
        </div>

        {/* Demo preview */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded-2xl blur opacity-30" />

            {/* Chat mockup */}
            <div className="relative bg-[#12122a] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">{t("home.demoAiEmployee")}</p>
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    {t("home.demoOnline")}
                  </p>
                </div>
              </div>

              <div className="space-y-4 min-h-[180px]">
                <div className="flex justify-end">
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs">
                    <p className="text-sm">{chatExamples[chatIndex].userMessage}</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 max-w-sm">
                    <p className="text-sm text-gray-200 whitespace-pre-line">
                      {chatExamples[chatIndex].botMessage}
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat navigation dots */}
              <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-white/5">
                {chatExamples.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setChatIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === chatIndex ? "bg-blue-500 w-4" : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.02] py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-center text-lg text-gray-400 mb-8">{t("home.reviewsTitle")}</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <ReviewCard
              text={t("home.review1.text")}
              author={t("home.review1.author")}
              role={t("home.review1.role")}
              rating={5}
            />
            <ReviewCard
              text={t("home.review2.text")}
              author={t("home.review2.author")}
              role={t("home.review2.role")}
              rating={5}
            />
            <ReviewCard
              text={t("home.review3.text")}
              author={t("home.review3.author")}
              role={t("home.review3.role")}
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Why not a bot */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t("home.whyNotBot.title")} <span className="text-gray-500 line-through">{t("home.whyNotBot.bot")}</span> {t("home.whyNotBot.past")}
            </h2>
            <p className="text-xl text-gray-400">
              {t("home.whyNotBot.desc")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Bot column */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-red-400 text-xl">🤖</span>
                </div>
                <h3 className="text-xl font-semibold text-red-400">{t("home.regularBot")}</h3>
              </div>
              <ul className="space-y-4">
                {regularBotItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-400">
                    <span className="text-red-400">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Employee column */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  {t("home.aiEmployee")}
                </h3>
              </div>
              <ul className="space-y-4">
                {aiEmployeeItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-200">
                    <span className="text-green-400">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t("home.features.title")}
            </h2>
            <p className="text-xl text-gray-400">
              {t("home.features.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title={t("home.feature1.title")}
              description={t("home.feature1.desc")}
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Calendar className="h-6 w-6" />}
              title={t("home.feature2.title")}
              description={t("home.feature2.desc")}
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Clock className="h-6 w-6" />}
              title={t("home.feature3.title")}
              description={t("home.feature3.desc")}
              gradient="from-orange-500 to-red-500"
            />
            <FeatureCard
              icon={<Brain className="h-6 w-6" />}
              title={t("home.feature4.title")}
              description={t("home.feature4.desc")}
              gradient="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title={t("home.feature5.title")}
              description={t("home.feature5.desc")}
              gradient="from-indigo-500 to-blue-500"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title={t("home.feature6.title")}
              description={t("home.feature6.desc")}
              gradient="from-yellow-500 to-orange-500"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative z-10 py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t("home.howItWorks.title")}
            </h2>
            <p className="text-xl text-gray-400">
              {t("home.howItWorks.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <StepCard
              number="01"
              title={t("home.step1.title")}
              description={t("home.step1.desc")}
            />
            <StepCard
              number="02"
              title={t("home.step2.title")}
              description={t("home.step2.desc")}
            />
            <StepCard
              number="03"
              title={t("home.step3.title")}
              description={t("home.step3.desc")}
            />
            <StepCard
              number="04"
              title={t("home.step4.title")}
              description={t("home.step4.desc")}
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 py-24 bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t("home.pricing.title")}
            </h2>
            <p className="text-xl text-gray-400">
              {t("home.pricing.subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <PricingCard
              name="Starter"
              price="20"
              period="/month"
              description={t("home.pricing.starter")}
              features={[
                `200 ${t("home.pricing.messages")}`,
                t("home.pricing.ai247"),
                t("home.pricing.onlineBooking"),
                t("home.pricing.crm"),
                t("home.pricing.broadcasts"),
                t("home.pricing.reminders"),
                t("home.pricing.reviews"),
                t("home.pricing.analytics"),
              ]}
              cta={t("home.pricing.start")}
              highlighted={false}
            />
            <PricingCard
              name="Pro"
              price="45"
              period="/month"
              description={t("home.pricing.pro")}
              features={[
                `1 000 ${t("home.pricing.messages")}`,
                t("home.pricing.ai247"),
                t("home.pricing.onlineBooking"),
                t("home.pricing.crm"),
                t("home.pricing.broadcasts"),
                t("home.pricing.reminders"),
                t("home.pricing.reviews"),
                t("home.pricing.analytics"),
              ]}
              cta={t("home.pricing.choose")}
              highlighted={true}
              badge={t("home.pricing.popular")}
            />
            <PricingCard
              name="Business"
              price="95"
              period="/month"
              description={t("home.pricing.business")}
              features={[
                `3 000 ${t("home.pricing.messages")}`,
                t("home.pricing.ai247"),
                t("home.pricing.onlineBooking"),
                t("home.pricing.crm"),
                t("home.pricing.broadcasts"),
                t("home.pricing.reminders"),
                t("home.pricing.reviews"),
                t("home.pricing.analytics"),
              ]}
              cta={t("home.pricing.choose")}
              highlighted={false}
            />
            <PricingCard
              name="Enterprise"
              price="180"
              period="/month"
              description={t("home.pricing.enterprise")}
              features={[
                t("home.pricing.unlimited"),
                t("home.pricing.ai247"),
                t("home.pricing.onlineBooking"),
                t("home.pricing.crm"),
                t("home.pricing.broadcasts"),
                t("home.pricing.reminders"),
                t("home.pricing.reviews"),
                t("home.pricing.analytics"),
              ]}
              cta={t("home.pricing.choose")}
              highlighted={false}
            />
          </div>

          <p className="text-center text-gray-500 mt-8">
            {t("home.pricing.trialNote")}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-2xl" />

              <div className="relative bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-3xl p-12 backdrop-blur-sm">
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  {t("home.cta.title")}
                </h2>
                <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                  {t("home.cta.desc")}
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  {t("home.cta.button")}
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold">Staffix</span>
                <p className="text-xs text-gray-500">by K-Bridge Co. LTD</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-gray-500 text-sm">
              <Link href="/privacy" className="hover:text-white transition-colors">{t("home.footer.privacy")}</Link>
              <Link href="/terms" className="hover:text-white transition-colors">{t("home.footer.terms")}</Link>
              <Link href="/contacts" className="hover:text-white transition-colors">{t("home.footer.contacts")}</Link>
            </div>
            <p className="text-gray-600 text-sm">
              {t("home.footer.copyright")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all">
      <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-4 text-white`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-purple-400 mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  highlighted,
  badge,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
}) {
  return (
    <div className={`relative rounded-2xl p-8 ${
      highlighted
        ? 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-500/50'
        : 'bg-white/[0.02] border border-white/5'
    }`}>
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            {badge}
          </span>
        </div>
      )}

      <h3 className="text-xl font-semibold text-white mb-1">{name}</h3>
      <p className="text-gray-500 text-sm mb-4">{description}</p>

      <div className="mb-6">
        <span className="text-4xl font-bold text-white">${price}</span>
        <span className="text-gray-400">{period}</span>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-3 text-gray-300">
            <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href="/register"
        className={`block text-center py-3 rounded-xl font-semibold transition-all ${
          highlighted
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90'
            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function ReviewCard({
  text,
  author,
  role,
  rating,
}: {
  text: string;
  author: string;
  role: string;
  rating: number;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
      <Quote className="h-8 w-8 text-blue-500/30 mb-4" />
      <p className="text-gray-300 mb-4 leading-relaxed">{text}</p>
      <div className="flex items-center gap-1 mb-3">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-white font-medium">{author}</p>
      <p className="text-gray-500 text-sm">{role}</p>
    </div>
  );
}
