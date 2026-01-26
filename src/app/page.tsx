import Link from "next/link";
import { Bot, MessageSquare, Calendar, Clock, Shield, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Staffix</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Начать бесплатно
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          AI-ассистент для вашего
          <span className="text-blue-600"> бизнеса</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Создайте своего Telegram-бота за 5 минут.
          Он будет отвечать клиентам, записывать на услуги и работать 24/7.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Попробовать бесплатно
          </Link>
          <Link
            href="#how-it-works"
            className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Как это работает?
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          14 дней бесплатно • Без привязки карты
        </p>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Всё что нужно для автоматизации
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<MessageSquare className="h-8 w-8 text-blue-600" />}
            title="Умные ответы"
            description="AI понимает вопросы клиентов и отвечает на основе информации о вашем бизнесе"
          />
          <FeatureCard
            icon={<Calendar className="h-8 w-8 text-blue-600" />}
            title="Онлайн-запись"
            description="Клиенты записываются через бота, вы получаете уведомления"
          />
          <FeatureCard
            icon={<Clock className="h-8 w-8 text-blue-600" />}
            title="Работает 24/7"
            description="Бот отвечает мгновенно в любое время дня и ночи"
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-blue-600" />}
            title="Ваш бренд"
            description="Бот работает от имени вашего бизнеса, клиенты не видят платформу"
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8 text-blue-600" />}
            title="Быстрый старт"
            description="Настройка занимает 5 минут, не нужны технические знания"
          />
          <FeatureCard
            icon={<Bot className="h-8 w-8 text-blue-600" />}
            title="Свой бот"
            description="Создаёте бота в Telegram, мы подключаем к нему AI"
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Как начать?
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number="1"
              title="Регистрация"
              description="Создайте аккаунт на платформе"
            />
            <StepCard
              number="2"
              title="Создайте бота"
              description="В Telegram через @BotFather получите токен"
            />
            <StepCard
              number="3"
              title="Настройте"
              description="Добавьте услуги, цены и часы работы"
            />
            <StepCard
              number="4"
              title="Запустите"
              description="Бот начнёт отвечать клиентам!"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Простые тарифы
        </h2>
        <p className="text-center text-gray-600 mb-12">
          Начните бесплатно, масштабируйтесь по мере роста
        </p>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <PricingCard
            name="Старт"
            price="Бесплатно"
            period="14 дней"
            features={[
              "100 сообщений",
              "1 бот",
              "Базовая аналитика",
            ]}
            cta="Попробовать"
            highlighted={false}
          />
          <PricingCard
            name="Бизнес"
            price="$29"
            period="/месяц"
            features={[
              "1000 сообщений",
              "1 бот",
              "Полная аналитика",
              "Приоритетная поддержка",
            ]}
            cta="Выбрать"
            highlighted={true}
          />
          <PricingCard
            name="Про"
            price="$99"
            period="/месяц"
            features={[
              "Безлимит сообщений",
              "5 ботов",
              "API доступ",
              "Персональный менеджер",
            ]}
            cta="Связаться"
            highlighted={false}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Готовы автоматизировать бизнес?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Присоединяйтесь к сотням компаний, которые уже используют Staffix
          </p>
          <Link
            href="/register"
            className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors inline-block"
          >
            Создать бота бесплатно
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-500">
        <p>&copy; 2025 Staffix. Все права защищены.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function PricingCard({ name, price, period, features, cta, highlighted }: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl ${highlighted ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2' : 'bg-white border border-gray-200'}`}>
      <h3 className={`text-xl font-semibold mb-2 ${highlighted ? 'text-white' : 'text-gray-900'}`}>{name}</h3>
      <div className="mb-4">
        <span className="text-3xl font-bold">{price}</span>
        <span className={highlighted ? 'text-blue-100' : 'text-gray-500'}>{period}</span>
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((feature, i) => (
          <li key={i} className={`flex items-center gap-2 ${highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
            <span>✓</span> {feature}
          </li>
        ))}
      </ul>
      <Link
        href="/register"
        className={`block text-center py-2 rounded-lg font-semibold transition-colors ${
          highlighted
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
