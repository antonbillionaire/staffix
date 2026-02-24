"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import Link from "next/link";
import {
  CheckCircle,
  Circle,
  ArrowRight,
  Clock,
  Scissors,
  ShoppingCart,
  Bot,
  Users,
  HelpCircle,
  Zap,
  CreditCard,
  Package,
  MessageCircle,
  Star,
  ChevronDown,
  ChevronUp,
  Play,
  Sparkles,
} from "lucide-react";

interface Business {
  id: string;
  name: string;
  businessType: string | null;
  botToken: string | null;
  botActive: boolean;
  services?: { id: string }[];
  staff?: { id: string }[];
  faqs?: { id: string }[];
  products?: { id: string }[];
}

interface Step {
  id: string;
  title: string;
  description: string;
  link: string;
  linkLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  time: string;
  optional?: boolean;
  tip?: string;
  done?: boolean;
}

const SERVICE_STEPS: Omit<Step, "done">[] = [
  {
    id: "services",
    title: "Добавьте услуги и цены",
    description:
      "Внесите все ваши услуги с ценами и продолжительностью. AI-сотрудник будет рекомендовать их клиентам и принимать записи.",
    link: "/dashboard/services",
    linkLabel: "Добавить услуги",
    icon: Scissors,
    time: "10 мин",
    tip: "Добавьте 3-5 самых популярных услуг — этого достаточно для начала. Остальные можно добавить позже.",
  },
  {
    id: "staff",
    title: "Добавьте сотрудников",
    description:
      "Укажите мастеров или специалистов. Клиенты смогут записываться к конкретному человеку, AI знает расписание каждого.",
    link: "/dashboard/staff",
    linkLabel: "Добавить сотрудников",
    icon: Users,
    time: "5 мин",
    optional: true,
    tip: "Если работаете один — пропустите этот шаг. Добавьте себя как сотрудника только если хотите, чтобы клиенты видели ваше имя.",
  },
  {
    id: "faq",
    title: "Добавьте часто задаваемые вопросы",
    description:
      "Внесите типичные вопросы клиентов (адрес, парковка, противопоказания, акции). AI будет отвечать на них автоматически.",
    link: "/dashboard/faq",
    linkLabel: "Добавить FAQ",
    icon: HelpCircle,
    time: "10 мин",
    optional: true,
    tip: "Подумайте: что чаще всего спрашивают клиенты по телефону? Перенесите эти ответы в FAQ.",
  },
  {
    id: "bot",
    title: "Создайте и подключите Telegram-бота",
    description:
      "Создайте бота через @BotFather, скопируйте токен и вставьте в Staffix. Бот сразу начнёт отвечать клиентам.",
    link: "/dashboard/bot",
    linkLabel: "Подключить бота",
    icon: Bot,
    time: "5 мин",
    tip: "В разделе «Бот» есть пошаговая инструкция. Займёт ровно 5 минут, никаких технических знаний не нужно.",
  },
  {
    id: "test",
    title: "Напишите вашему боту первое сообщение",
    description:
      "Найдите вашего бота в Telegram по username, напишите /start и проверьте как он отвечает. Запишитесь как будто вы клиент.",
    link: "/dashboard/bot",
    linkLabel: "Открыть настройки бота",
    icon: MessageCircle,
    time: "5 мин",
    tip: "Попросите друга написать боту — его впечатления покажут насколько удобен AI для новых клиентов.",
  },
  {
    id: "invite",
    title: "Пригласите первых клиентов",
    description:
      "Скопируйте ссылку на бота (t.me/ВАШ_БОТ) и отправьте 5-10 постоянным клиентам. Попросите их записаться через бота.",
    link: "/dashboard/broadcasts",
    linkLabel: "Сделать рассылку",
    icon: Star,
    time: "5 мин",
    tip: "Напишите клиентам лично: «Привет! Теперь можно записаться онлайн через нашего бота 24/7 — попробуй!»",
  },
];

const STORE_STEPS: Omit<Step, "done">[] = [
  {
    id: "products",
    title: "Добавьте товары в каталог",
    description:
      "Внесите ваши товары с ценами, фото и описанием. AI-ассистент будет рекомендовать товары и принимать заказы.",
    link: "/dashboard/products",
    linkLabel: "Добавить товары",
    icon: Package,
    time: "15 мин",
    tip: "Начните с 10-20 самых популярных товаров. Качественные фото и описания повышают конверсию в заказ.",
  },
  {
    id: "faq",
    title: "Добавьте информацию о доставке и оплате",
    description:
      "Укажите условия доставки, зоны, сроки и стоимость. AI будет отвечать на эти вопросы автоматически.",
    link: "/dashboard/faq",
    linkLabel: "Добавить FAQ",
    icon: HelpCircle,
    time: "10 мин",
    tip: "Самые частые вопросы покупателей: как доставляете, сколько стоит, какие способы оплаты, можно ли вернуть товар.",
  },
  {
    id: "payment",
    title: "Подключите систему оплаты",
    description:
      "Добавьте Payme, Click или Kaspi Pay. Клиенты смогут оплачивать заказы прямо в боте без звонков.",
    link: "/dashboard/bot",
    linkLabel: "Настроить оплату",
    icon: CreditCard,
    time: "10 мин",
    optional: true,
    tip: "Для начала можно принимать оплату наличными или переводом. Онлайн-оплату подключите когда пойдут первые заказы.",
  },
  {
    id: "bot",
    title: "Создайте и подключите Telegram-бота",
    description:
      "Создайте бота через @BotFather, скопируйте токен. Клиенты будут оформлять заказы через Telegram 24/7.",
    link: "/dashboard/bot",
    linkLabel: "Подключить бота",
    icon: Bot,
    time: "5 мин",
    tip: "Telegram-бот — самый быстрый канал для заказов в СНГ. Конверсия в покупку обычно выше чем на сайте.",
  },
  {
    id: "test",
    title: "Сделайте тестовый заказ",
    description:
      "Напишите боту /start, выберите товар и оформите заказ. Проверьте что всё работает и вы получили уведомление.",
    link: "/dashboard/orders",
    linkLabel: "Открыть заказы",
    icon: ShoppingCart,
    time: "5 мин",
    tip: "Проверьте весь путь: выбор товара → оформление → ваше уведомление → статус заказа. Это то, что пройдёт каждый клиент.",
  },
  {
    id: "invite",
    title: "Запустите первую рассылку",
    description:
      "Сообщите клиентам о новом боте. Предложите скидку 10% за первый заказ через Telegram.",
    link: "/dashboard/broadcasts",
    linkLabel: "Создать рассылку",
    icon: Zap,
    time: "10 мин",
    tip: "Напишите: «Теперь у нас есть Telegram-бот! Закажи прямо сейчас и получи скидку 10% на первый заказ».",
  },
];

export default function GettingStartedPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTips, setExpandedTips] = useState<string[]>([]);

  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const bgPage = isDark ? "bg-[#0a0a1a]" : "bg-gray-50";

  useEffect(() => {
    fetch("/api/business")
      .then((r) => r.json())
      .then((data) => {
        setBusiness(data.business || data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const isStore =
    business?.businessType === "online_shop" ||
    (business?.products && business.products.length > 0);

  const baseSteps = isStore ? STORE_STEPS : SERVICE_STEPS;

  const steps: Step[] = baseSteps.map((s) => {
    let done = false;
    if (business) {
      if (s.id === "services") done = (business.services?.length ?? 0) > 0;
      else if (s.id === "staff") done = (business.staff?.length ?? 0) > 0;
      else if (s.id === "faq") done = (business.faqs?.length ?? 0) > 0;
      else if (s.id === "products") done = (business.products?.length ?? 0) > 0;
      else if (s.id === "bot") done = business.botActive;
    }
    return { ...s, done };
  });

  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const toggleTip = (id: string) => {
    setExpandedTips((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${bgPage} flex items-center justify-center`}>
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>
              {business ? `Добро пожаловать, ${business.name}!` : "Добро пожаловать в Staffix!"}
            </h1>
            <p className={textSecondary}>
              {isStore ? "Настройка интернет-магазина" : "Настройка AI-сотрудника для вашего бизнеса"}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${textPrimary}`}>
              Прогресс настройки
            </span>
            <span className={`text-sm font-bold ${progressPercent === 100 ? "text-green-400" : "text-blue-400"}`}>
              {completedCount} / {steps.length} шагов
            </span>
          </div>
          <div className={`h-2.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                progressPercent === 100
                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                  : "bg-gradient-to-r from-blue-500 to-purple-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progressPercent === 100 && (
            <p className="text-green-400 text-sm mt-2 font-medium">
              Отлично! Все шаги выполнены. Ваш AI-сотрудник готов к работе!
            </p>
          )}
          {progressPercent < 100 && (
            <p className={`${textSecondary} text-xs mt-2`}>
              Расчётное время: ~{steps.filter((s) => !s.done).reduce((sum, s) => sum + parseInt(s.time), 0)} мин
            </p>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isExpanded = expandedTips.includes(step.id);

          return (
            <div
              key={step.id}
              className={`${bgCard} border ${step.done ? (isDark ? "border-green-500/30" : "border-green-200") : borderColor} rounded-xl overflow-hidden transition-all`}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Step number / check */}
                  <div className="flex-shrink-0 mt-0.5">
                    {step.done ? (
                      <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-400" />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
                        <span className={`text-sm font-bold ${textSecondary}`}>{index + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-semibold ${step.done ? "text-green-400" : textPrimary}`}>
                            {step.title}
                          </h3>
                          {step.optional && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                              необязательно
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Icon className={`h-3.5 w-3.5 ${textSecondary}`} />
                          <span className={`text-xs ${textSecondary}`}>{step.time}</span>
                        </div>
                      </div>
                      {!step.done && (
                        <Link
                          href={step.link}
                          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm rounded-lg hover:opacity-90 transition-all font-medium"
                        >
                          {step.linkLabel}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      {step.done && (
                        <Link
                          href={step.link}
                          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border ${isDark ? "border-white/10 text-gray-400 hover:text-white" : "border-gray-200 text-gray-500 hover:text-gray-700"} transition-colors`}
                        >
                          Изменить
                        </Link>
                      )}
                    </div>

                    <p className={`text-sm ${textSecondary} mt-2`}>{step.description}</p>

                    {/* Tip toggle */}
                    {step.tip && (
                      <button
                        onClick={() => toggleTip(step.id)}
                        className={`flex items-center gap-1.5 mt-3 text-xs ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"} transition-colors`}
                      >
                        <Play className="h-3 w-3" />
                        {isExpanded ? "Скрыть совет" : "Совет от Staffix"}
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}

                    {step.tip && isExpanded && (
                      <div className={`mt-2 text-xs p-3 rounded-lg ${isDark ? "bg-blue-500/10 border border-blue-500/20 text-blue-300" : "bg-blue-50 border border-blue-200 text-blue-700"}`}>
                        💡 {step.tip}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom links */}
      <div className={`mt-8 ${bgCard} border ${borderColor} rounded-xl p-6`}>
        <h3 className={`font-semibold ${textPrimary} mb-4`}>Полезные ресурсы</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link
            href="/dashboard/support"
            className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"} transition-colors`}
          >
            <HelpCircle className="h-4 w-4 text-blue-400" />
            <span className={`text-sm ${textPrimary}`}>Центр поддержки</span>
          </Link>
          <a
            href="https://t.me/staffix_support_bot"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"} transition-colors`}
          >
            <MessageCircle className="h-4 w-4 text-purple-400" />
            <span className={`text-sm ${textPrimary}`}>Telegram-поддержка</span>
          </a>
          <Link
            href="/dashboard"
            className={`flex items-center gap-2 p-3 rounded-xl ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-50 hover:bg-gray-100"} transition-colors`}
          >
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className={`text-sm ${textPrimary}`}>В дашборд</span>
          </Link>
        </div>
      </div>

      <div className={`mt-4 text-center text-xs ${textSecondary}`}>
        <Clock className="h-3.5 w-3.5 inline mr-1" />
        У вас 14 дней бесплатного периода. Если нужна помощь с настройкой —{" "}
        <a href="https://t.me/staffix_support_bot" className="text-blue-400 hover:underline">
          напишите нам в Telegram
        </a>
        , поможем за 15 минут.
      </div>
    </div>
  );
}
