"use client";

import Link from "next/link";
import { Brain, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
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
        <h1 className="text-4xl font-bold mb-8">Политика конфиденциальности</h1>
        <p className="text-gray-400 mb-8">Последнее обновление: 31 января 2025 г.</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Введение</h2>
            <p className="text-gray-300 leading-relaxed">
              Настоящая Политика конфиденциальности описывает, как Staffix (&quot;мы&quot;, &quot;нас&quot; или &quot;наш&quot;)
              собирает, использует и защищает вашу личную информацию при использовании нашего сервиса
              по адресу staffix.io (&quot;Сервис&quot;).
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              Используя наш Сервис, вы соглашаетесь с условиями данной Политики конфиденциальности.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Какую информацию мы собираем</h2>
            <h3 className="text-xl font-medium text-white mb-3">2.1. Информация, которую вы предоставляете:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Имя и контактная информация (email, телефон)</li>
              <li>Данные учетной записи (имя пользователя, пароль)</li>
              <li>Информация о вашем бизнесе (название компании, сфера деятельности)</li>
              <li>Контент, который вы загружаете для обучения AI-сотрудника</li>
              <li>Переписка с службой поддержки</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-3 mt-6">2.2. Автоматически собираемая информация:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>IP-адрес и данные о местоположении</li>
              <li>Тип браузера и устройства</li>
              <li>Данные об использовании Сервиса (статистика, логи)</li>
              <li>Файлы cookie и аналогичные технологии</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Как мы используем вашу информацию</h2>
            <p className="text-gray-300 leading-relaxed">Мы используем собранную информацию для:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Предоставления и улучшения Сервиса</li>
              <li>Персонализации AI-сотрудника под ваш бизнес</li>
              <li>Обработки платежей и управления подписками</li>
              <li>Связи с вами по вопросам поддержки и обновлений</li>
              <li>Анализа использования для улучшения Сервиса</li>
              <li>Обеспечения безопасности и предотвращения мошенничества</li>
              <li>Соблюдения требований законодательства</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Обработка данных AI-сотрудником</h2>
            <p className="text-gray-300 leading-relaxed">
              Ваш AI-сотрудник обрабатывает сообщения от клиентов вашего бизнеса. Мы:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Не используем переписку ваших клиентов для обучения общих AI-моделей</li>
              <li>Храним данные переписки для предоставления вам аналитики</li>
              <li>Обеспечиваем шифрование данных при передаче и хранении</li>
              <li>Предоставляем вам полный контроль над данными вашего бизнеса</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Хранение и защита данных</h2>
            <p className="text-gray-300 leading-relaxed">
              Мы применяем современные меры безопасности для защиты вашей информации:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>SSL/TLS шифрование при передаче данных</li>
              <li>Шифрование данных в состоянии покоя</li>
              <li>Регулярное резервное копирование</li>
              <li>Ограниченный доступ сотрудников к персональным данным</li>
              <li>Регулярные аудиты безопасности</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Данные хранятся на серверах в защищенных дата-центрах. Мы храним вашу информацию
              в течение срока действия учетной записи и в течение разумного периода после её удаления
              в соответствии с требованиями законодательства.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Передача данных третьим лицам</h2>
            <p className="text-gray-300 leading-relaxed">
              Мы не продаем вашу личную информацию. Мы можем передавать данные:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Поставщикам услуг, которые помогают нам предоставлять Сервис (хостинг, платежи, аналитика)</li>
              <li>По требованию законодательства или в ответ на законные запросы властей</li>
              <li>Для защиты наших прав, собственности или безопасности</li>
              <li>В случае слияния, приобретения или продажи активов (с уведомлением пользователей)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Ваши права</h2>
            <p className="text-gray-300 leading-relaxed">Вы имеете право:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Получить доступ к своим персональным данным</li>
              <li>Исправить неточную информацию</li>
              <li>Удалить свою учетную запись и связанные данные</li>
              <li>Экспортировать свои данные в машиночитаемом формате</li>
              <li>Отозвать согласие на обработку данных</li>
              <li>Подать жалобу в надзорный орган</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Для реализации этих прав свяжитесь с нами по адресу{" "}
              <a href="mailto:support@staffix.io" className="text-blue-400 hover:text-blue-300">
                support@staffix.io
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Файлы cookie</h2>
            <p className="text-gray-300 leading-relaxed">
              Мы используем cookie и аналогичные технологии для:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Обеспечения работы Сервиса (необходимые cookie)</li>
              <li>Запоминания ваших настроек и предпочтений</li>
              <li>Анализа использования Сервиса</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Вы можете управлять cookie через настройки браузера.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Изменения политики</h2>
            <p className="text-gray-300 leading-relaxed">
              Мы можем обновлять эту Политику конфиденциальности. При существенных изменениях
              мы уведомим вас по email или через Сервис. Продолжение использования Сервиса
              после изменений означает ваше согласие с обновленной политикой.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Контакты</h2>
            <p className="text-gray-300 leading-relaxed">
              По вопросам конфиденциальности обращайтесь:
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
