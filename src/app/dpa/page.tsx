"use client";

import Link from "next/link";
import { Brain, ArrowLeft, Download } from "lucide-react";

export default function DPAPage() {
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
        <h1 className="text-4xl font-bold mb-4">Соглашение об обработке данных</h1>
        <h2 className="text-xl text-blue-400 mb-8">Data Processing Agreement (DPA)</h2>
        <p className="text-gray-400 mb-8">Последнее обновление: 31 января 2025 г.</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          <section className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Для кого это соглашение?</h2>
            <p className="text-gray-300 leading-relaxed">
              Данное соглашение предназначено для <strong className="text-white">корпоративных клиентов</strong>,
              которым требуется формальное соглашение об обработке персональных данных для соответствия
              требованиям GDPR, законодательства о персональных данных или внутренней политики компании.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              Для подписания DPA свяжитесь с нами:{" "}
              <a href="mailto:support@staffix.io" className="text-blue-400 hover:text-blue-300">
                support@staffix.io
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Определения</h2>
            <ul className="text-gray-300 space-y-3">
              <li><strong className="text-white">Контролёр данных</strong> — Клиент, определяющий цели и средства обработки персональных данных.</li>
              <li><strong className="text-white">Процессор данных</strong> — Staffix, обрабатывающий персональные данные от имени Контролёра.</li>
              <li><strong className="text-white">Субъект данных</strong> — физическое лицо, чьи персональные данные обрабатываются.</li>
              <li><strong className="text-white">Персональные данные</strong> — любая информация, относящаяся к идентифицированному или идентифицируемому физическому лицу.</li>
              <li><strong className="text-white">Обработка</strong> — любая операция с персональными данными.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Предмет и объём обработки</h2>
            <p className="text-gray-300 leading-relaxed">
              2.1. Staffix обрабатывает персональные данные от имени Клиента исключительно для предоставления
              услуг по договору (AI-сотрудник для бизнеса).
            </p>
            <h3 className="text-xl font-medium text-white mb-3 mt-6">2.2. Категории персональных данных:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Контактные данные клиентов бизнеса (имя, телефон, email)</li>
              <li>Содержание переписки с AI-сотрудником</li>
              <li>Данные о записях и заявках</li>
              <li>Технические данные (IP-адрес, идентификаторы устройств)</li>
            </ul>
            <h3 className="text-xl font-medium text-white mb-3 mt-6">2.3. Категории субъектов данных:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Клиенты бизнеса Контролёра</li>
              <li>Сотрудники Контролёра (при использовании Сервиса)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Обязанности Процессора (Staffix)</h2>
            <p className="text-gray-300 leading-relaxed">Staffix обязуется:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Обрабатывать персональные данные только по документированным инструкциям Контролёра</li>
              <li>Обеспечивать конфиденциальность обрабатываемых данных</li>
              <li>Принимать технические и организационные меры безопасности</li>
              <li>Не привлекать субпроцессоров без письменного согласия Контролёра</li>
              <li>Содействовать Контролёру в выполнении запросов субъектов данных</li>
              <li>Уведомлять Контролёра об инцидентах безопасности в течение 72 часов</li>
              <li>Удалить или вернуть все персональные данные по окончании договора</li>
              <li>Предоставлять информацию для аудитов по запросу</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Обязанности Контролёра (Клиента)</h2>
            <p className="text-gray-300 leading-relaxed">Контролёр обязуется:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Обеспечить законность сбора персональных данных</li>
              <li>Получить необходимые согласия от субъектов данных</li>
              <li>Предоставить инструкции по обработке данных</li>
              <li>Информировать субъектов данных об использовании AI-сотрудника</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Меры безопасности</h2>
            <p className="text-gray-300 leading-relaxed">Staffix применяет следующие меры:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Шифрование данных при передаче (TLS 1.3)</li>
              <li>Шифрование данных в состоянии покоя (AES-256)</li>
              <li>Регулярное резервное копирование</li>
              <li>Разграничение доступа на основе ролей</li>
              <li>Двухфакторная аутентификация для администраторов</li>
              <li>Мониторинг и логирование доступа</li>
              <li>Регулярное тестирование безопасности</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Субпроцессоры</h2>
            <p className="text-gray-300 leading-relaxed">
              6.1. Staffix использует следующих субпроцессоров:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-gray-300">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="py-3 pr-4 text-white">Субпроцессор</th>
                    <th className="py-3 pr-4 text-white">Назначение</th>
                    <th className="py-3 text-white">Расположение</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-3 pr-4">Vercel Inc.</td>
                    <td className="py-3 pr-4">Хостинг приложения</td>
                    <td className="py-3">США, ЕС</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">Railway</td>
                    <td className="py-3 pr-4">База данных</td>
                    <td className="py-3">США</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">Anthropic</td>
                    <td className="py-3 pr-4">AI-модель</td>
                    <td className="py-3">США</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">Telegram</td>
                    <td className="py-3 pr-4">Мессенджер</td>
                    <td className="py-3">ОАЭ</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">Resend</td>
                    <td className="py-3 pr-4">Email-сервис</td>
                    <td className="py-3">США</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-300 leading-relaxed mt-4">
              6.2. Контролёр даёт общее согласие на использование указанных субпроцессоров.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Передача данных за пределы страны</h2>
            <p className="text-gray-300 leading-relaxed">
              7.1. Данные могут передаваться в страны, указанные в списке субпроцессоров.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              7.2. Передача осуществляется с соблюдением:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Стандартных контрактных условий (SCC)</li>
              <li>Решений о достаточности защиты (где применимо)</li>
              <li>Дополнительных мер безопасности</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Права субъектов данных</h2>
            <p className="text-gray-300 leading-relaxed">
              8.1. Staffix содействует Контролёру в реализации прав субъектов данных:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Право на доступ к данным</li>
              <li>Право на исправление</li>
              <li>Право на удаление (&quot;право быть забытым&quot;)</li>
              <li>Право на ограничение обработки</li>
              <li>Право на переносимость данных</li>
              <li>Право на возражение</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              8.2. Срок ответа на запрос — 30 календарных дней.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Инциденты безопасности</h2>
            <p className="text-gray-300 leading-relaxed">
              9.1. При обнаружении нарушения безопасности Staffix:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-4">
              <li>Уведомит Контролёра в течение 72 часов</li>
              <li>Предоставит описание инцидента и затронутых данных</li>
              <li>Опишет принятые и планируемые меры</li>
              <li>Окажет содействие в расследовании</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Срок действия и расторжение</h2>
            <p className="text-gray-300 leading-relaxed">
              10.1. DPA действует в течение срока действия основного договора.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              10.2. По окончании договора Staffix (по выбору Контролёра):
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4 mt-2">
              <li>Удалит все персональные данные, или</li>
              <li>Вернёт данные Контролёру в машиночитаемом формате</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              10.3. Срок хранения данных после расторжения — 30 дней.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Контакты</h2>
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-white font-medium">По вопросам защиты данных:</p>
              <p className="text-gray-300 mt-2">
                Email:{" "}
                <a href="mailto:support@staffix.io" className="text-blue-400 hover:text-blue-300">
                  support@staffix.io
                </a>
              </p>
              <p className="text-gray-300 mt-4 text-sm">
                Для подписания индивидуального DPA отправьте запрос с указанием реквизитов вашей компании.
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
