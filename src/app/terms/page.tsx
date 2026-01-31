"use client";

import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Staffix</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              На главную
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Условия использования</h1>
        <p className="text-gray-400 mb-8">Последнее обновление: 31 января 2025 г.</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Принятие условий</h2>
            <p className="text-gray-300 leading-relaxed">
              Добро пожаловать в Staffix! Настоящие Условия использования (&quot;Условия&quot;) регулируют
              ваш доступ и использование сервиса Staffix, доступного по адресу staffix.io (&quot;Сервис&quot;).
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              Регистрируясь или используя Сервис, вы подтверждаете, что прочитали, поняли и согласны
              соблюдать настоящие Условия. Если вы не согласны с какой-либо частью Условий,
              вы не должны использовать Сервис.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Описание сервиса</h2>
            <p className="text-gray-300 leading-relaxed">
              Staffix предоставляет платформу для создания и управления AI-сотрудниками —
              виртуальными ассистентами на базе искусственного интеллекта, которые могут:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Отвечать на вопросы клиентов вашего бизнеса</li>
              <li>Обрабатывать заявки и записи</li>
              <li>Предоставлять информацию о ваших услугах и товарах</li>
              <li>Интегрироваться с мессенджерами (Telegram и др.)</li>
              <li>Собирать аналитику по взаимодействиям с клиентами</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Регистрация и учетная запись</h2>
            <h3 className="text-xl font-medium text-white mb-3">3.1. Требования к регистрации</h3>
            <p className="text-gray-300 leading-relaxed">
              Для использования Сервиса вы должны:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Быть старше 18 лет или иметь согласие законного представителя</li>
              <li>Предоставить достоверную информацию при регистрации</li>
              <li>Поддерживать актуальность данных учетной записи</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">3.2. Безопасность учетной записи</h3>
            <p className="text-gray-300 leading-relaxed">
              Вы несете ответственность за:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Сохранение конфиденциальности пароля</li>
              <li>Все действия, совершенные под вашей учетной записью</li>
              <li>Немедленное уведомление нас о несанкционированном доступе</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Тарифы и оплата</h2>
            <h3 className="text-xl font-medium text-white mb-3">4.1. Тарифные планы</h3>
            <p className="text-gray-300 leading-relaxed">
              Сервис предлагает различные тарифные планы, включая бесплатный пробный период.
              Актуальные цены и условия указаны на странице тарифов.
            </p>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">4.2. Оплата</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Оплата производится заранее за выбранный период</li>
              <li>Цены указаны в долларах США</li>
              <li>Мы принимаем банковские карты и электронные платежи</li>
              <li>Счета выставляются автоматически в начале каждого расчетного периода</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">4.3. Возврат средств</h3>
            <p className="text-gray-300 leading-relaxed">
              Возврат средств возможен в течение 14 дней с момента первой оплаты,
              если вы не удовлетворены Сервисом. Для оформления возврата свяжитесь с поддержкой.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Правила использования</h2>
            <h3 className="text-xl font-medium text-white mb-3">5.1. Допустимое использование</h3>
            <p className="text-gray-300 leading-relaxed">Вы можете использовать Сервис для:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Автоматизации клиентского сервиса вашего бизнеса</li>
              <li>Обучения AI-сотрудника информации о ваших услугах</li>
              <li>Интеграции с разрешенными платформами и мессенджерами</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">5.2. Запрещенное использование</h3>
            <p className="text-gray-300 leading-relaxed">Запрещается:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Использовать Сервис для рассылки спама или мошенничества</li>
              <li>Распространять вредоносный, оскорбительный или незаконный контент</li>
              <li>Нарушать права интеллектуальной собственности третьих лиц</li>
              <li>Пытаться получить несанкционированный доступ к системам Сервиса</li>
              <li>Перепродавать доступ к Сервису без письменного согласия</li>
              <li>Использовать Сервис для деятельности, нарушающей законодательство</li>
              <li>Создавать AI-сотрудников, выдающих себя за реальных людей</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Контент и интеллектуальная собственность</h2>
            <h3 className="text-xl font-medium text-white mb-3">6.1. Ваш контент</h3>
            <p className="text-gray-300 leading-relaxed">
              Вы сохраняете все права на контент, который загружаете в Сервис (тексты, изображения,
              документы для обучения AI). Вы предоставляете нам лицензию на использование этого
              контента исключительно для предоставления Сервиса.
            </p>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">6.2. Наш контент</h3>
            <p className="text-gray-300 leading-relaxed">
              Сервис, включая дизайн, код, торговые марки и другие материалы, является
              собственностью Staffix и защищен законами об интеллектуальной собственности.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Ограничение ответственности</h2>
            <p className="text-gray-300 leading-relaxed">
              Сервис предоставляется &quot;как есть&quot;. Мы не гарантируем:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Бесперебойную работу Сервиса</li>
              <li>Точность или полноту ответов AI-сотрудника</li>
              <li>Соответствие Сервиса всем вашим требованиям</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Мы не несем ответственности за:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Косвенные, случайные или штрафные убытки</li>
              <li>Потерю данных или прибыли</li>
              <li>Действия третьих лиц на основе ответов AI-сотрудника</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Максимальная ответственность ограничивается суммой, уплаченной вами за последние 12 месяцев.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Прекращение использования</h2>
            <p className="text-gray-300 leading-relaxed">
              Вы можете прекратить использование Сервиса в любое время, удалив учетную запись.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              Мы можем приостановить или прекратить ваш доступ в случае:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Нарушения настоящих Условий</li>
              <li>Неоплаты подписки</li>
              <li>Запроса правоохранительных органов</li>
              <li>Прекращения деятельности Сервиса</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Изменения условий</h2>
            <p className="text-gray-300 leading-relaxed">
              Мы можем обновлять эти Условия. При существенных изменениях мы уведомим вас
              за 30 дней до вступления изменений в силу. Продолжение использования Сервиса
              означает принятие обновленных Условий.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Применимое право</h2>
            <p className="text-gray-300 leading-relaxed">
              Настоящие Условия регулируются и толкуются в соответствии с законодательством.
              Любые споры подлежат разрешению путем переговоров, а при недостижении согласия —
              в компетентном суде.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Контакты</h2>
            <p className="text-gray-300 leading-relaxed">
              По вопросам, связанным с настоящими Условиями, обращайтесь:
            </p>
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white font-medium">Staffix</p>
              <p className="text-gray-300 mt-2">
                Email:{" "}
                <a href="mailto:support@staffix.io" className="text-blue-400 hover:text-blue-300">
                  support@staffix.io
                </a>
              </p>
              <p className="text-gray-300">
                Telegram:{" "}
                <a
                  href="https://t.me/staffix_support_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  @staffix_support_bot
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          © 2025 Staffix. Все права защищены.
        </div>
      </footer>
    </div>
  );
}
