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
        <h1 className="text-4xl font-bold mb-4">Условия использования</h1>
        <h2 className="text-xl text-blue-400 mb-8">Публичная оферта на оказание услуг</h2>
        <p className="text-gray-400 mb-8">Последнее обновление: 31 января 2025 г.</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          {/* ВАЖНО: Оферта */}
          <section className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">⚠️ Важная информация</h2>
            <p className="text-gray-300 leading-relaxed">
              Настоящий документ является <strong className="text-white">публичной офертой</strong> в соответствии
              со статьёй 435 и частью 2 статьи 437 Гражданского кодекса.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong className="text-white">Акцептом (принятием) оферты</strong> является:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Регистрация учётной записи на сайте staffix.io</li>
              <li>Оплата любого тарифного плана</li>
              <li>Использование Сервиса после регистрации</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Акцепт оферты означает полное и безоговорочное принятие всех условий настоящего договора.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Термины и определения</h2>
            <ul className="text-gray-300 space-y-3">
              <li><strong className="text-white">Исполнитель</strong> — K-Bridge Co. LTD (유한회사 케이브릿지), регистрационный номер 606-88-02444, Южная Корея, владелец и оператор платформы Staffix.</li>
              <li><strong className="text-white">Заказчик (Клиент)</strong> — физическое или юридическое лицо, акцептовавшее оферту.</li>
              <li><strong className="text-white">Сервис</strong> — платформа staffix.io для создания и управления AI-сотрудниками.</li>
              <li><strong className="text-white">AI-сотрудник</strong> — виртуальный ассистент на базе искусственного интеллекта.</li>
              <li><strong className="text-white">Подписка</strong> — оплаченный период доступа к функциям Сервиса.</li>
              <li><strong className="text-white">Личный кабинет</strong> — защищённый раздел сайта для управления Сервисом.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Предмет договора</h2>
            <p className="text-gray-300 leading-relaxed">
              2.1. Исполнитель обязуется предоставить Заказчику доступ к Сервису Staffix для:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Создания и настройки AI-сотрудников для бизнеса Заказчика</li>
              <li>Автоматизации общения с клиентами через мессенджеры</li>
              <li>Сбора и анализа статистики взаимодействий</li>
              <li>Интеграции с внешними сервисами (Telegram и др.)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              2.2. Заказчик обязуется оплачивать услуги согласно выбранному тарифному плану.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Порядок оказания услуг</h2>
            <p className="text-gray-300 leading-relaxed">
              3.1. Для получения доступа к Сервису Заказчик:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Регистрирует учётную запись на сайте staffix.io</li>
              <li>Подтверждает email-адрес</li>
              <li>Выбирает тарифный план и производит оплату (при необходимости)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              3.2. Доступ к Сервису предоставляется в течение 5 минут после завершения регистрации
              или поступления оплаты.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              3.3. Пробный период (14 дней) предоставляется бесплатно и не требует оплаты.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Стоимость и порядок оплаты</h2>
            <p className="text-gray-300 leading-relaxed">
              4.1. Актуальные тарифы размещены на странице{" "}
              <Link href="/pricing" className="text-blue-400 hover:text-blue-300">staffix.io/pricing</Link>.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              4.2. Оплата производится:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Банковскими картами (Visa, Mastercard, МИР)</li>
              <li>Электронными платёжными системами</li>
              <li>Безналичным переводом для юридических лиц</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              4.3. Подписка продлевается автоматически, если не отменена за 24 часа до окончания периода.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              4.4. Возврат средств возможен в течение 14 дней с момента первой оплаты,
              если Заказчик не удовлетворён Сервисом.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Права и обязанности сторон</h2>
            <h3 className="text-xl font-medium text-white mb-3">5.1. Исполнитель обязуется:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Обеспечивать работоспособность Сервиса 99% времени</li>
              <li>Обеспечивать безопасность данных Заказчика</li>
              <li>Оказывать техническую поддержку</li>
              <li>Уведомлять о плановых технических работах за 24 часа</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">5.2. Заказчик обязуется:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Своевременно оплачивать выбранный тарифный план</li>
              <li>Не использовать Сервис для противоправных целей</li>
              <li>Не распространять вредоносный контент через AI-сотрудника</li>
              <li>Обеспечивать конфиденциальность данных доступа</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">5.3. Заказчик имеет право:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Использовать все функции выбранного тарифного плана</li>
              <li>Получать техническую поддержку</li>
              <li>Отменить подписку в любое время</li>
              <li>Запросить экспорт своих данных</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Ограничение ответственности</h2>
            <p className="text-gray-300 leading-relaxed">
              6.1. Сервис предоставляется «как есть». Исполнитель не гарантирует:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Бесперебойную работу Сервиса</li>
              <li>100% точность ответов AI-сотрудника</li>
              <li>Достижение конкретных бизнес-результатов</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              6.2. Исполнитель не несёт ответственности за:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Косвенные убытки Заказчика</li>
              <li>Действия третьих лиц на основе ответов AI-сотрудника</li>
              <li>Сбои, вызванные внешними факторами (интернет, API мессенджеров)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              6.3. Максимальная ответственность Исполнителя ограничена суммой,
              уплаченной Заказчиком за последние 3 месяца.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Конфиденциальность и персональные данные</h2>
            <p className="text-gray-300 leading-relaxed">
              7.1. Обработка персональных данных осуществляется в соответствии с{" "}
              <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
                Политикой конфиденциальности
              </Link>.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              7.2. Заказчик даёт согласие на получение информационных сообщений от Сервиса.
              Отписаться можно в настройках личного кабинета.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              7.3. Для B2B клиентов доступно{" "}
              <Link href="/dpa" className="text-blue-400 hover:text-blue-300">
                Соглашение об обработке данных (DPA)
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Срок действия и расторжение</h2>
            <p className="text-gray-300 leading-relaxed">
              8.1. Договор вступает в силу с момента акцепта оферты и действует бессрочно.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              8.2. Заказчик может расторгнуть договор, удалив учётную запись в личном кабинете.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              8.3. Исполнитель может расторгнуть договор в одностороннем порядке в случае:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Нарушения Заказчиком условий договора</li>
              <li>Использования Сервиса для противоправных целей</li>
              <li>Неоплаты подписки более 30 дней</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Разрешение споров</h2>
            <p className="text-gray-300 leading-relaxed">
              9.1. Все споры решаются путём переговоров.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              9.2. Претензионный порядок обязателен. Срок ответа на претензию — 30 календарных дней.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              9.3. При невозможности урегулирования спор передаётся в компетентный суд.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Заключительные положения</h2>
            <p className="text-gray-300 leading-relaxed">
              10.1. Исполнитель вправе изменять условия оферты. Изменения публикуются на сайте
              и вступают в силу через 30 дней после публикации.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              10.2. Продолжение использования Сервиса после изменений означает согласие с новыми условиями.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              10.3. Недействительность отдельных положений не влечёт недействительности договора в целом.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Реквизиты Исполнителя</h2>
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white font-medium text-lg">K-Bridge Co. LTD</p>
              <p className="text-gray-400 text-sm">유한회사 케이브릿지</p>
              <div className="mt-4 space-y-2 text-gray-300">
                <p><span className="text-gray-500">Регистрационный номер:</span> 606-88-02444</p>
                <p><span className="text-gray-500">Адрес:</span> Convensia daero 165, 26 floor, V553, Posco Tower Songdo, Incheon, South Korea</p>
                <p>
                  <span className="text-gray-500">Сайт:</span>{" "}
                  <a href="https://staffix.io" className="text-blue-400 hover:text-blue-300">
                    staffix.io
                  </a>
                </p>
                <p>
                  <span className="text-gray-500">Email:</span>{" "}
                  <a href="mailto:support@staffix.io" className="text-blue-400 hover:text-blue-300">
                    support@staffix.io
                  </a>
                </p>
                <p>
                  <span className="text-gray-500">Телефон:</span>{" "}
                  <a href="tel:+821027181424" className="text-blue-400 hover:text-blue-300">
                    +82 10 2718 1424
                  </a>
                </p>
                <p>
                  <span className="text-gray-500">Telegram:</span>{" "}
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
