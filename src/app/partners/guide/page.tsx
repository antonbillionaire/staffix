"use client";

import Link from "next/link";
import {
  Zap,
  Target,
  MessageSquare,
  DollarSign,
  Users,
  CheckCircle,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Copy,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  content: React.ReactNode;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors ml-2"
    >
      <Copy className="h-3 w-3" />
      {copied ? "Скопировано!" : "Копировать"}
    </button>
  );
}

function ScriptBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400 font-medium">{title}</span>
        <CopyButton text={text} />
      </div>
      <div className="bg-[#1a1a35] border border-white/10 rounded-xl p-4 text-sm text-gray-200 whitespace-pre-line leading-relaxed font-mono">
        {text}
      </div>
    </div>
  );
}

const sections: Section[] = [
  {
    id: "who",
    title: "Кому продавать: ваши идеальные клиенты",
    icon: Target,
    color: "text-blue-400",
    content: (
      <div className="space-y-4">
        <p className="text-gray-300">
          Staffix решает конкретную проблему: <strong className="text-white">бизнес теряет клиентов потому что не успевает отвечать 24/7</strong>. Ваша задача — найти таких людей.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Горячая аудитория
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• <strong className="text-white">Салоны красоты и барбершопы</strong> — мастера заняты, телефон висит</li>
              <li>• <strong className="text-white">Клиники и стоматологии</strong> — запись по телефону = потеря клиентов ночью</li>
              <li>• <strong className="text-white">Фитнес-клубы и йога-студии</strong> — нужна запись на занятия</li>
              <li>• <strong className="text-white">Рестораны и доставка</strong> — принимают заказы в Telegram</li>
              <li>• <strong className="text-white">Онлайн-магазины</strong> — много вопросов о товарах и доставке</li>
              <li>• <strong className="text-white">Юристы и бухгалтеры</strong> — консультации 24/7</li>
            </ul>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <h4 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Признаки готового клиента
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Есть Telegram-канал или аккаунт в Instagram</li>
              <li>• Жалуется что не успевает отвечать клиентам</li>
              <li>• Принимает запись по телефону / вручную</li>
              <li>• Платит за рекламу, но теряет лиды ночью</li>
              <li>• Нанял администратора только для ответов</li>
              <li>• Бизнес работает 6-7 дней в неделю</li>
            </ul>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <h4 className="font-semibold text-blue-300 mb-2">Где их найти (каналы поиска)</h4>
          <div className="grid md:grid-cols-3 gap-3 text-sm text-gray-300">
            <div>
              <p className="font-medium text-white mb-1">Онлайн</p>
              <ul className="space-y-1">
                <li>• Instagram местных бизнесов</li>
                <li>• 2GIS и Google Maps</li>
                <li>• Telegram-каталоги города</li>
                <li>• LinkedIn (ваши знакомые)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-white mb-1">Оффлайн</p>
              <ul className="space-y-1">
                <li>• Бизнес-мероприятия</li>
                <li>• Коворкинги</li>
                <li>• Торговые центры</li>
                <li>• Ваши друзья-предприниматели</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-white mb-1">CRM-клиенты</p>
              <ul className="space-y-1">
                <li>• Ваши текущие клиенты на Битрикс24</li>
                <li>• База amoCRM-клиентов</li>
                <li>• Рефералы от существующих клиентов</li>
                <li>• Партнёрские базы других агентств</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "pitch",
    title: "Как представить Staffix: скрипты и сообщения",
    icon: MessageSquare,
    color: "text-purple-400",
    content: (
      <div className="space-y-5">
        <p className="text-gray-300">
          Не продавайте «AI» или «технологии» — <strong className="text-white">продавайте результат: клиент написал ночью, бот ответил, запись принята</strong>. Вот готовые скрипты:
        </p>

        <ScriptBox
          title="Холодное сообщение (Instagram DM / Telegram)"
          text={`Привет! Увидел(а) ваш [салон/магазин/клинику] — работа крутая 🔥

Смотрел(а) ваш аккаунт и заметил(а): запись, судя по всему, идёт через сообщения в ручном режиме. Вы не теряете клиентов ночью или в выходные, когда не успеваете ответить?

Есть сервис, который за 5 минут создаёт AI-сотрудника в Telegram — отвечает клиентам 24/7, принимает запись, помнит каждого клиента. Стоит от $20/мес.

Показать как это выглядит? Занимает буквально 10 минут.`}
        />

        <ScriptBox
          title="Для существующих CRM-клиентов (если вы дилер Битрикс24/amoCRM)"
          text={`Добрый день, [Имя]!

Хочу показать вам кое-что интересное — это не конкурент вашей CRM, это надстройка над ней.

Staffix добавляет AI-сотрудника в Telegram и WhatsApp, который принимает входящие 24/7 и автоматически создаёт сделки в вашем Битрикс24 / amoCRM. Менеджеры видят готовые лиды в CRM, не теряя ни одного обращения.

Нужно 15 минут чтобы показать демо на вашем примере. Удобно на этой неделе?`}
        />

        <ScriptBox
          title="Короткий питч для нетворкинга (устно, 30 секунд)"
          text={`Я помогаю малому бизнесу перестать терять клиентов ночью и в выходные.

Представь: твой клиент написал в 23:00, хочет записаться. Ты не видишь сообщение до утра. Он уходит к конкуренту.

Staffix создаёт AI-сотрудника в Telegram — он отвечает как живой человек, принимает запись, помнит клиента. Я работаю с Staffix как партнёр и могу помочь настроить за один день.`}
        />

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h4 className="font-semibold text-white mb-3">Демонстрация вживую (самый мощный инструмент)</h4>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">1.</span>
              Откройте staffix.io на телефоне прямо во время разговора
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">2.</span>
              Зарегистрируйтесь как «демо-салон» за 2 минуты (или покажите готовый демо-бот)
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">3.</span>
              Дайте клиенту написать боту любой вопрос про услуги
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-bold">4.</span>
              Пусть сам увидит как AI отвечает — лучше тысячи слов
            </li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "objections",
    title: "Работа с возражениями",
    icon: AlertCircle,
    color: "text-yellow-400",
    content: (
      <div className="space-y-4">
        {[
          {
            q: "«У меня уже есть администратор»",
            a: "Администратор не работает ночью и в выходные. А клиенты пишут в любое время. Staffix — не замена, а помощник: он отвечает когда администратора нет, а сложные вопросы передаёт людям.",
          },
          {
            q: "«Я не разбираюсь в технологиях»",
            a: "Именно поэтому Staffix. Настройка: 1) Регистрация на сайте → 2) Написать @BotFather → 3) Вставить токен. Занимает 5 минут. Если что-то непонятно — я помогу лично, а поддержка Staffix отвечает за 15 минут.",
          },
          {
            q: "«Слишком дорого» / «$20 в месяц — зачем?»",
            a: "Один записавшийся клиент которого бот «поймал» ночью — уже окупает месяц. Сколько вы тратите на рекламу? Если хоть один лид в месяц не теряется — Staffix окупился многократно.",
          },
          {
            q: "«У нас уже пробовали что-то похожее, не работало»",
            a: "Скорее всего был простой FAQ-бот который отвечал по ключевым словам. Staffix — это Claude / GPT, настоящий AI: понимает любой вопрос, помнит клиента, умеет записывать и уточнять детали как живой сотрудник.",
          },
          {
            q: "«Нужно подумать»",
            a: "Конечно. Вот что предлагаю: 14 дней бесплатно, карточка не нужна. Зарегистрируйтесь прямо сейчас, попробуйте с реальными клиентами — если не понравится, просто не продлевайте. Риска ноль.",
          },
          {
            q: "«В Битрикс24 (CRM) уже есть AI»",
            a: "Битрикс AI — это встроенные шаблоны внутри CRM. Staffix — полноценный LLM-агент (Claude/GPT) в Telegram и WhatsApp, с памятью каждого клиента, умеет записывать, уточнять, квалифицировать лиды. И автоматически создаёт сделки в вашем Битрикс24.",
          },
        ].map((item) => (
          <div key={item.q} className="bg-[#1a1a35] border border-white/10 rounded-xl p-4">
            <p className="font-medium text-yellow-300 mb-2">— {item.q}</p>
            <p className="text-sm text-gray-300 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "process",
    title: "Процесс продажи: от знакомства до комиссии",
    icon: TrendingUp,
    color: "text-green-400",
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            {
              step: "1",
              title: "Первый контакт",
              desc: "Отправьте холодное сообщение или поговорите на встрече. Цель — назначить 15-минутное демо (не продать!).",
              time: "День 1",
            },
            {
              step: "2",
              title: "Демо (15 минут)",
              desc: "Покажите Staffix вживую. Дайте попробовать самому. Задайте вопрос: «Как думаете, скольких клиентов вы теряете ночью?»",
              time: "День 1-3",
            },
            {
              step: "3",
              title: "Регистрация по вашей ссылке",
              desc: "Дайте ссылку: staffix.io/?ref=ВАШ_КОД. Помогите зарегистрироваться прямо сейчас — не давайте «подумать» больше 24 часов.",
              time: "День 1-3",
            },
            {
              step: "4",
              title: "Помощь с настройкой (опционально)",
              desc: "Если можете — помогите подключить бота. Клиент который уже настроен конвертируется в платного в 3х чаще.",
              time: "День 3-7",
            },
            {
              step: "5",
              title: "Конверсия в платный план",
              desc: "Через 14 дней триала Staffix напомнит клиенту об оплате. Клиент платит → вы получаете 20% на счёт.",
              time: "День 14+",
            },
            {
              step: "6",
              title: "Пассивный доход",
              desc: "Пока клиент активен — вы получаете 20% каждый месяц. Без дополнительных действий с вашей стороны.",
              time: "Ежемесячно",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 p-4 bg-[#1a1a35] border border-white/10 rounded-xl">
              <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center font-bold text-white text-sm">
                {item.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-white">{item.title}</p>
                  <span className="text-xs text-gray-500">{item.time}</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "crm",
    title: "Если вы CRM-дистрибьютор (Битрикс24, amoCRM)",
    icon: Building2,
    color: "text-cyan-400",
    content: (
      <div className="space-y-4">
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
          <p className="text-cyan-300 text-sm leading-relaxed">
            <strong className="text-white">Ключевое сообщение:</strong> Staffix — это НЕ конкурент CRM.
            Это AI-слой поверх существующей CRM. Ваши клиенты уже платят за Битрикс24 или amoCRM —
            Staffix добавляет им то, чего в CRM нет: живого AI-сотрудника в Telegram и WhatsApp.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-white">Как Staffix усиливает вашу CRM-базу</h4>
          {[
            {
              crm: "Битрикс24",
              flow: "Клиент пишет в WhatsApp → Staffix AI отвечает 24/7, квалифицирует → автоматически создаёт сделку в Битрикс24 → менеджер видит готовый лид в CRM",
              value: "«Битрикс24 уже настроен — Staffix добавляет AI-приём входящих без изменения процессов»",
            },
            {
              crm: "amoCRM",
              flow: "AI-сотрудник обрабатывает входящие лиды → отвечает, квалифицирует → пушит в воронку amoCRM → экономия на операторах",
              value: "«amoAI ограничен — Staffix даёт полноценного AI-сотрудника с памятью клиента»",
            },
            {
              crm: "Smartup / BILLZ",
              flow: "AI-сотрудник в WhatsApp → обрабатывает предзаказы, отвечает на вопросы по наличию → данные летят в Smartup",
              value: "«AI-консьерж для розницы без разработки с нуля»",
            },
          ].map((item) => (
            <div key={item.crm} className="bg-[#1a1a35] border border-white/10 rounded-xl p-4">
              <p className="font-semibold text-cyan-300 mb-2">{item.crm}</p>
              <p className="text-sm text-gray-300 mb-2">{item.flow}</p>
              <p className="text-xs text-gray-400 italic">Продающий тезис: {item.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h4 className="font-semibold text-white mb-2">Ваши преимущества как CRM-дистрибьютора</h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <span><strong className="text-white">Увеличиваете средний чек:</strong> продаёте CRM + Staffix = больше денег с клиента</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <span><strong className="text-white">Дифференциация:</strong> конкуренты делают проектную разработку — Staffix SaaS, дешевле и масштабируемее</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <span><strong className="text-white">Быстрый результат для клиента:</strong> 1-3 дня vs 2-4 месяца кастомной разработки</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
              <span><strong className="text-white">Рекуррентная комиссия:</strong> 20% с каждого платежа ваших клиентов, пока они пользуются</span>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "earnings",
    title: "Ваши начисления и выплаты",
    icon: DollarSign,
    color: "text-green-400",
    content: (
      <div className="space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          {[
            { plan: "Starter", price: 20, comm: 4 },
            { plan: "Pro", price: 45, comm: 9 },
            { plan: "Business", price: 95, comm: 19 },
            { plan: "Enterprise", price: 180, comm: 36 },
          ].map((p) => (
            <div key={p.plan} className="bg-[#1a1a35] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">{p.plan}</p>
              <p className="text-lg font-bold text-white">${p.price}/мес</p>
              <div className="border-t border-white/5 mt-2 pt-2">
                <p className="text-xs text-gray-400">Ваша комиссия</p>
                <p className="text-base font-bold text-green-400">${p.comm}/мес</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-2">
          <h4 className="font-semibold text-green-300">Примеры ежемесячного дохода</h4>
          {[
            { clients: 5, plan: "Starter ($20)", monthly: 20 },
            { clients: 10, plan: "Pro ($45)", monthly: 90 },
            { clients: 20, plan: "Business ($95)", monthly: 380 },
            { clients: 30, plan: "Mix (средний $50)", monthly: 300 },
          ].map((ex) => (
            <div key={ex.clients} className="flex justify-between text-sm">
              <span className="text-gray-300">{ex.clients} клиентов на {ex.plan}</span>
              <span className="text-green-400 font-bold">${ex.monthly}/мес</span>
            </div>
          ))}
        </div>

        <div className="bg-[#1a1a35] border border-white/10 rounded-xl p-4">
          <h4 className="font-semibold text-white mb-3">Как получить выплату</h4>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">1.</span>
              Начисления накапливаются автоматически в вашем{" "}
              <Link href="/partners/dashboard" className="text-blue-400 hover:underline">кабинете партнёра</Link>
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">2.</span>
              Минимальная сумма для выплаты — $50
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">3.</span>
              Напишите на partners@staffix.io когда накопится нужная сумма
            </li>
            <li className="flex gap-2">
              <span className="text-green-400 font-bold">4.</span>
              Выплачиваем на карту / USDT / Kaspi в течение 3 рабочих дней
            </li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "materials",
    title: "Материалы для работы",
    icon: Users,
    color: "text-orange-400",
    content: (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#1a1a35] border border-white/10 rounded-xl p-4">
            <h4 className="font-semibold text-white mb-3">Что отправить клиенту</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <span className="text-orange-400">→</span> Ваша реферальная ссылка:{" "}
                <span className="text-blue-400 font-mono text-xs">staffix.io/?ref=ВАШ_КОД</span>
              </li>
              <li>
                <span className="text-orange-400">→</span> Сайт с ценами:{" "}
                <span className="text-blue-400 font-mono text-xs">staffix.io</span>
              </li>
              <li>
                <span className="text-orange-400">→</span> Поддержка клиента:{" "}
                <span className="text-blue-400 font-mono text-xs">@staffix_support_bot</span>
              </li>
            </ul>
          </div>
          <div className="bg-[#1a1a35] border border-white/10 rounded-xl p-4">
            <h4 className="font-semibold text-white mb-3">Ваши инструменты</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <span className="text-orange-400">→</span>{" "}
                <Link href="/partners/dashboard" className="text-blue-400 hover:underline">Кабинет партнёра</Link>
                {" "}— статистика, начисления
              </li>
              <li>
                <span className="text-orange-400">→</span> Email для вопросов:{" "}
                <span className="text-blue-400">partners@staffix.io</span>
              </li>
              <li>
                <span className="text-orange-400">→</span> Демо-аккаунт: создайте отдельный аккаунт на staffix.io для показов
              </li>
            </ul>
          </div>
        </div>

        <ScriptBox
          title="Сообщение после регистрации клиента (отправьте сразу)"
          text={`[Имя], отлично — вы зарегистрировались!

Вот что сделать прямо сейчас:
1. Перейдите в Бот → создайте бота через @BotFather (5 мин)
2. Добавьте 3-5 услуг с ценами
3. Напишите боту /start и попробуйте записаться

Если возникнут вопросы — я помогу, просто напишите. Также есть поддержка @staffix_support_bot.

Удачи! 14 дней — этого точно хватит чтобы оценить.`}
        />

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <h4 className="font-semibold text-blue-300 mb-2">Частые вопросы партнёров</h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-white font-medium">Когда зачисляется комиссия?</p>
              <p className="text-gray-400">После оплаты клиентом. Видите в кабинете партнёра в разделе «Начисления».</p>
            </div>
            <div>
              <p className="text-white font-medium">Что если клиент отменил подписку?</p>
              <p className="text-gray-400">Начисления прекращаются. Если клиент вернётся — комиссия возобновляется.</p>
            </div>
            <div>
              <p className="text-white font-medium">Есть ли ограничение на количество рефералов?</p>
              <p className="text-gray-400">Нет. Приводите сколько угодно клиентов, 20% со всех.</p>
            </div>
            <div>
              <p className="text-white font-medium">Могу ли я помогать клиентам с настройкой за отдельную плату?</p>
              <p className="text-gray-400">Да, это ваш бизнес. Staffix платит вам комиссию, а вы можете брать за внедрение отдельно.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export default function PartnerGuidePage() {
  const [expandedSections, setExpandedSections] = useState<string[]>(["who"]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">Staffix</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/partners/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Мой кабинет
            </Link>
            <Link
              href="/partners"
              className="text-sm px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all"
            >
              Стать партнёром
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-sm mb-4">
            <Users className="h-4 w-4" /> Гайд для партнёров
          </div>
          <h1 className="text-4xl font-bold mb-3">
            Как зарабатывать с{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              партнёрской программой Staffix
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Полное руководство: от первого контакта до ежемесячных выплат. Скрипты, возражения, инструменты.
          </p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">20%</p>
              <p className="text-xs text-gray-400">рекуррентная комиссия</p>
            </div>
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">60 дн</p>
              <p className="text-xs text-gray-400">окно атрибуции</p>
            </div>
            <div className="bg-[#12122a] border border-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">$20–180</p>
              <p className="text-xs text-gray-400">тарифы клиентов/мес</p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;
            const isOpen = expandedSections.includes(section.id);

            return (
              <div
                key={section.id}
                className="bg-[#12122a] border border-white/5 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOpen ? "bg-white/10" : "bg-white/5"}`}>
                      <Icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    <h2 className="font-semibold text-white text-lg">{section.title}</h2>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {isOpen && <div className="px-6 pb-6">{section.content}</div>}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">Готовы начать?</h3>
          <p className="text-gray-400 mb-6">
            Подайте заявку — рассмотрим в течение 1-2 рабочих дней и пришлём реферальный код.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/partners#apply"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-all"
            >
              Подать заявку
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/partners/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-all"
            >
              Мой кабинет
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
