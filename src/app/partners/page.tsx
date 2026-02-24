"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  ArrowRight,
  Users,
  TrendingUp,
  Zap,
  DollarSign,
  Loader2,
  Building2,
  Mail,
  Phone,
  Globe,
  MessageSquare,
} from "lucide-react";

const benefits = [
  {
    icon: DollarSign,
    title: "20% рекуррентной комиссии",
    desc: "Получайте 20% с каждого ежемесячного платежа привлечённых клиентов — пока они платят, вы зарабатываете.",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    icon: Zap,
    title: "Быстрый запуск",
    desc: "Staffix запускается за 1-3 дня vs 2-4 месяца кастомной разработки. Легко продавать — результат виден сразу.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    icon: Users,
    title: "Для CRM-партнёров",
    desc: "Staffix — AI-слой поверх Битрикс24, amoCRM, Smartup. Добавляйте к своим клиентам AI-сотрудника в WhatsApp/Telegram без конкуренции с CRM.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: TrendingUp,
    title: "Растущий рынок",
    desc: "Казахстан, Узбекистан, Россия — миллионы МСБ ещё без AI-автоматизации. Первые заходят первыми.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Подайте заявку",
    desc: "Заполните форму ниже. Расскажите о себе и как планируете продвигать Staffix.",
  },
  {
    step: "02",
    title: "Получите одобрение",
    desc: "Мы рассмотрим заявку в течение 1-2 рабочих дней и пришлём ваш уникальный реферальный код.",
  },
  {
    step: "03",
    title: "Делитесь ссылкой",
    desc: "Отправляйте клиентам staffix.io/?ref=ВАШ_КОД. 60-дневное окно атрибуции — нет ограничений на время.",
  },
  {
    step: "04",
    title: "Зарабатывайте",
    desc: "20% с каждого платежа вашего клиента. Видите все начисления в личном кабинете партнёра.",
  },
];

const plans = [
  { name: "Starter", price: 20, commission: 4, messages: "1 000 сообщений" },
  { name: "Pro", price: 45, commission: 9, messages: "5 000 сообщений" },
  { name: "Business", price: 95, commission: 19, messages: "Безлимит" },
  { name: "Enterprise", price: 180, commission: 36, messages: "Безлимит + поддержка" },
];

export default function PartnersPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    description: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка отправки");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки. Попробуйте позже.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">Staffix</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/partners/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Кабинет партнёра
            </Link>
            <Link
              href="/login"
              className="text-sm px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              Войти
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-sm mb-8">
            <Users className="h-4 w-4" />
            Партнёрская программа Staffix
          </div>
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Продавайте AI-автоматизацию{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              и зарабатывайте 20%
            </span>{" "}
            ежемесячно
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Staffix — AI-сотрудник для бизнеса в Telegram и WhatsApp. Рекомендуйте клиентам,
            получайте рекуррентную комиссию. Идеально для CRM-дистрибьюторов и IT-агентств.
          </p>
          <a
            href="#apply"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-all text-lg"
          >
            Стать партнёром
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Почему партнёры выбирают Staffix</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="bg-[#12122a] border border-white/5 rounded-xl p-6"
              >
                <div className={`w-10 h-10 ${b.bg} rounded-lg flex items-center justify-center mb-4`}>
                  <b.icon className={`h-5 w-5 ${b.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-sm text-gray-400">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commission calculator */}
      <section className="px-6 py-16 bg-[#0d0d22]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Ваш потенциальный доход</h2>
          <p className="text-center text-gray-400 mb-12">
            20% с каждого платежа каждого привлечённого клиента
          </p>
          <div className="grid md:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="bg-[#12122a] border border-white/5 rounded-xl p-5 text-center"
              >
                <div className="text-sm text-gray-400 mb-1">{plan.name}</div>
                <div className="text-2xl font-bold text-white mb-1">${plan.price}/мес</div>
                <div className="text-xs text-gray-500 mb-4">{plan.messages}</div>
                <div className="border-t border-white/5 pt-4">
                  <div className="text-xs text-gray-400 mb-1">Ваша комиссия</div>
                  <div className="text-xl font-bold text-green-400">${plan.commission}/мес</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 text-center">
            <p className="text-gray-300">
              <span className="text-white font-semibold">Пример:</span> 10 клиентов на Pro-плане
              = <span className="text-green-400 font-bold text-xl">$90/месяц</span> пассивного дохода.
              20 клиентов на Business = <span className="text-green-400 font-bold text-xl">$380/месяц</span>.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Как это работает</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {howItWorks.map((step) => (
              <div key={step.step} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-white font-bold">
                  {step.step}
                </div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is this for */}
      <section className="px-6 py-16 bg-[#0d0d22]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Кому подходит партнёрство</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Дилеры и партнёры Битрикс24 (Казахстан, Узбекистан)",
              "Дилеры и партнёры amoCRM",
              "IT-агентства, занимающиеся автоматизацией МСБ",
              "Интеграторы Smartup, BILLZ, 1С",
              "Агентства digital-маркетинга с клиентами МСБ",
              "Консультанты по бизнес-автоматизации",
              "Разработчики чат-ботов (ищете SaaS-партнёра)",
              "Telegram-агентства и таргетологи",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <span className="text-gray-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Подать заявку на партнёрство</h2>
          <p className="text-center text-gray-400 mb-10">
            Рассмотрим в течение 1-2 рабочих дней. Пришлём реферальный код и доступ к кабинету.
          </p>

          <div className="bg-[#12122a] border border-white/5 rounded-2xl p-8">
            {sent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Заявка отправлена!</h3>
                <p className="text-gray-400">
                  Мы изучим вашу заявку и свяжемся с вами в течение 1-2 рабочих дней на {formData.email}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" /> Ваше имя *
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Иван Иванов"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-4 w-4" /> Email *
                      </span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="partner@company.com"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-4 w-4" /> Телефон / Telegram
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+7 777 123 45 67"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4" /> Компания / Агентство
                      </span>
                    </label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="ООО Название"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-4 w-4" /> Сайт / Telegram-канал
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://yoursite.com или @yourchannel"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4" /> Как планируете продвигать Staffix? *
                    </span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Например: я дилер Битрикс24, у меня 50+ клиентов МСБ в Алматы. Планирую предлагать Staffix как дополнение к CRM..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      Отправить заявку
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Нажимая кнопку, вы соглашаетесь на обработку персональных данных.
                  Отвечаем в течение 1-2 рабочих дней.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-gray-500 text-sm">
        <p>
          Вопросы? Пишите в{" "}
          <a
            href="https://t.me/staffix_support_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            Telegram
          </a>{" "}
          или на{" "}
          <a href="mailto:partners@staffix.io" className="text-blue-400 hover:text-blue-300">
            partners@staffix.io
          </a>
        </p>
        <p className="mt-2">© 2025 Staffix. Все права защищены.</p>
      </footer>
    </div>
  );
}
