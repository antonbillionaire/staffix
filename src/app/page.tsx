"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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
} from "lucide-react";

const industries = [
  "салонов красоты",
  "барбершопов",
  "медицинских клиник",
  "автосервисов",
  "СПА-центров",
  "вашего бизнеса",
];

const chatExamples = [
  {
    userMessage: "Здравствуйте, хочу записаться на стрижку на завтра",
    botMessage: "Добрый день! 😊 С удовольствием запишу вас. На завтра есть свободные окна:\n\n• 10:00 — мастер Алексей\n• 14:30 — мастер Дмитрий\n• 17:00 — мастер Алексей\n\nКакое время вам удобно?",
  },
  {
    userMessage: "Сколько стоит маникюр с покрытием?",
    botMessage: "Рада помочь! 💅 У нас есть несколько вариантов:\n\n• Маникюр + обычный лак — 800 ₽\n• Маникюр + гель-лак — 1200 ₽\n• Маникюр + укрепление + гель — 1500 ₽\n\nЗаписать вас на процедуру?",
  },
  {
    userMessage: "Какие услуги у вас есть для автомобиля?",
    botMessage: "Добрый день! 🚗 В нашем автосервисе:\n\n• Диагностика — от 1000 ₽\n• Замена масла — от 1500 ₽\n• Шиномонтаж — от 2000 ₽\n• Ремонт ходовой — по диагностике\n\nЧто вас интересует?",
  },
];

export default function Home() {
  const [industryIndex, setIndustryIndex] = useState(0);
  const [chatIndex, setChatIndex] = useState(0);

  // Rotate industries
  useEffect(() => {
    const interval = setInterval(() => {
      setIndustryIndex((prev) => (prev + 1) % industries.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Rotate chat examples
  useEffect(() => {
    const interval = setInterval(() => {
      setChatIndex((prev) => (prev + 1) % chatExamples.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px]" />
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
              Возможности
            </Link>
            <Link href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">
              Как работает
            </Link>
            <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
              Тарифы
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Начать бесплатно
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
            <span className="text-sm text-gray-300">Новое поколение AI-сотрудников</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            AI-сотрудник для{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400">
              {industries[industryIndex]}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            Не бот — полноценный <span className="text-white font-medium">цифровой сотрудник</span>,
            который знает ваш бизнес, любит работать и доступен 24/7.
            Настройте его под свои задачи за 5 минут.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href="/register"
              className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              Настроить своего сотрудника
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              Узнать больше
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>

          <p className="text-sm text-gray-500">
            ✨ 14 дней бесплатно
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
                  <p className="font-medium">AI-сотрудник</p>
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Онлайн 24/7
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
          <h3 className="text-center text-lg text-gray-400 mb-8">Что говорят наши клиенты</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <ReviewCard
              text="AI-сотрудник экономит мне 3-4 часа в день. Клиенты получают ответы моментально, а я могу сосредоточиться на работе."
              author="Анна К."
              role="Владелец салона красоты"
              rating={5}
            />
            <ReviewCard
              text="Раньше пропускали много звонков ночью. Теперь AI отвечает 24/7 и записывает клиентов даже в 3 часа ночи!"
              author="Дмитрий М."
              role="Барбершоп «Бритва»"
              rating={5}
            />
            <ReviewCard
              text="Настроили за 10 минут. Загрузили прайс — и бот уже отвечает на вопросы о ценах. Магия!"
              author="Елена С."
              role="Медицинский центр"
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
              Почему <span className="text-gray-500 line-through">бот</span> — это прошлое?
            </h2>
            <p className="text-xl text-gray-400">
              Staffix — это не чат-бот с готовыми ответами. Это AI-сотрудник,
              который думает, учится и работает как член вашей команды.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Bot column */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-red-400 text-xl">🤖</span>
                </div>
                <h3 className="text-xl font-semibold text-red-400">Обычный бот</h3>
              </div>
              <ul className="space-y-4">
                {[
                  "Отвечает шаблонами",
                  "Не знает ваш бизнес",
                  "Раздражает клиентов",
                  "Требует программиста",
                  "Ограниченное использование",
                ].map((item, i) => (
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
                  AI-сотрудник Staffix
                </h3>
              </div>
              <ul className="space-y-4">
                {[
                  "Понимает контекст и нюансы",
                  "Изучает ваш бизнес за 5 минут",
                  "Общается как человек",
                  "Настраивается без кода",
                  "Работает 24/7 без перерывов",
                ].map((item, i) => (
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
              Что умеет ваш новый сотрудник?
            </h2>
            <p className="text-xl text-gray-400">
              Всё, что нужно для работы с клиентами — в одном AI
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title="Умное общение"
              description="Отвечает на вопросы клиентов естественным языком, понимает контекст и помнит историю диалога"
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Calendar className="h-6 w-6" />}
              title="Запись на услуги"
              description="Записывает клиентов к мастерам, проверяет расписание, отправляет напоминания"
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Clock className="h-6 w-6" />}
              title="Режим 24/7"
              description="Работает круглосуточно без выходных. Клиенты получают ответ мгновенно"
              gradient="from-orange-500 to-red-500"
            />
            <FeatureCard
              icon={<Brain className="h-6 w-6" />}
              title="Знает ваш бизнес"
              description="Загрузите прайс-лист и FAQ — AI изучит и будет использовать в работе"
              gradient="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Ваш бренд"
              description="Сотрудник общается от имени вашего бизнеса. Клиенты не видят платформу"
              gradient="from-indigo-500 to-blue-500"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Мультиязычность"
              description="Общается на русском, узбекском и казахском языках"
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
              Настройте сотрудника за 5 минут
            </h2>
            <p className="text-xl text-gray-400">
              Без программистов, без сложных настроек
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <StepCard
              number="01"
              title="Регистрация"
              description="Войдите через Google или создайте аккаунт"
            />
            <StepCard
              number="02"
              title="Данные бизнеса"
              description="Расскажите о услугах, ценах, часах работы"
            />
            <StepCard
              number="03"
              title="Обучение AI"
              description="Загрузите прайс-лист или добавьте вручную"
            />
            <StepCard
              number="04"
              title="Запуск"
              description="Подключите Telegram — сотрудник готов!"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 py-24 bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Прозрачные тарифы
            </h2>
            <p className="text-xl text-gray-400">
              Начните бесплатно — платите только когда растёте
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              name="Пробный"
              price="0"
              period="14 дней"
              description="Для знакомства с платформой"
              features={[
                "100 сообщений",
                "1 AI-сотрудник",
                "Базовая аналитика",
                "Email поддержка",
              ]}
              cta="Начать бесплатно"
              highlighted={false}
            />
            <PricingCard
              name="Бизнес"
              price="29"
              period="/месяц"
              description="Для малого и среднего бизнеса"
              features={[
                "1000 сообщений",
                "1 AI-сотрудник",
                "Полная аналитика",
                "Приоритетная поддержка",
                "Загрузка документов",
              ]}
              cta="Выбрать план"
              highlighted={true}
              badge="Популярный"
            />
            <PricingCard
              name="Корпоративный"
              price="99"
              period="/месяц"
              description="Для крупного бизнеса и сетей"
              features={[
                "Безлимит сообщений",
                "5 AI-сотрудников",
                "API доступ",
                "Персональный менеджер",
                "White-label",
              ]}
              cta="Связаться"
              highlighted={false}
            />
          </div>

          <p className="text-center text-gray-500 mt-8">
            💳 Оплата после пробного периода. Отмена в любой момент.
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
                  Готовы нанять AI-сотрудника?
                </h2>
                <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                  Присоединяйтесь к сотням бизнесов, которые уже автоматизировали
                  работу с клиентами с помощью Staffix
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Настроить своего сотрудника
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
              <span className="text-lg font-bold">Staffix</span>
            </div>
            <div className="flex items-center gap-6 text-gray-500 text-sm">
              <Link href="#" className="hover:text-white transition-colors">Политика конфиденциальности</Link>
              <Link href="#" className="hover:text-white transition-colors">Условия использования</Link>
              <Link href="#" className="hover:text-white transition-colors">Контакты</Link>
            </div>
            <p className="text-gray-600 text-sm">
              © 2025 Staffix. Все права защищены.
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
