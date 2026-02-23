// Documentation content for Staffix - 12 sections, 4 languages
export type Language = "ru" | "en" | "uz" | "kz";

export interface DocSection {
  id: string;
  icon: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  content: Record<Language, string>;
}

export const docSections: DocSection[] = [
  // ===== 1. OVERVIEW =====
  {
    id: "overview",
    icon: "Brain",
    title: {
      ru: "Что такое Staffix",
      en: "What is Staffix",
      uz: "Staffix nima",
      kz: "Staffix дегеніміз не",
    },
    description: {
      ru: "Обзор платформы и ключевые возможности",
      en: "Platform overview and key capabilities",
      uz: "Platforma haqida umumiy ma'lumot",
      kz: "Платформа туралы жалпы ақпарат",
    },
    content: {
      ru: `## Что такое Staffix?

Staffix — это SaaS-платформа, которая создаёт **AI-сотрудника** для вашего бизнеса. Он работает 24/7 в Telegram, общается с клиентами как живой администратор, записывает на приём, отправляет напоминания и ведёт CRM.

## Для кого Staffix?

Staffix идеален для любого сервисного бизнеса:
- Салоны красоты и барбершопы
- Медицинские и стоматологические клиники
- Автосервисы и шиномонтажи
- Спа-центры и массажные салоны
- Фитнес-клубы и студии йоги
- Рестораны и кафе
- Ветеринарные клиники
- Репетиторские и учебные центры
- Любой бизнес, работающий по записи

## Ключевые возможности

**AI-сотрудник 24/7** — Умный бот в Telegram, который отвечает на вопросы, консультирует и записывает на приём даже ночью и в выходные.

**Онлайн-запись** — Клиенты записываются через бота. Система автоматически проверяет свободное время и исключает двойные записи.

**CRM-система** — Полная база клиентов с историей визитов, контактами, сегментацией (VIP, активные, неактивные).

**Рассылки** — Массовые сообщения по сегментам клиентов для акций, новостей и специальных предложений.

**Автоматизации** — Напоминания о визите (за 24ч и 2ч), сбор отзывов после визита, реактивация ушедших клиентов.

**Аналитика** — Статистика по сообщениям, записям, конверсиям, выручке. Экспорт в CSV.

**База знаний** — Загрузите прайсы, FAQ, документы — AI будет отвечать на основе ваших данных.

**Управление командой** — Добавляйте сотрудников, назначайте записи, отслеживайте загрузку.

## Все планы — все функции

Все тарифные планы включают полный набор функций. Единственная разница — количество сообщений AI-сотрудника в месяц. Подробнее на странице тарифов.`,

      en: `## What is Staffix?

Staffix is a SaaS platform that creates an **AI employee** for your business. It works 24/7 in Telegram, communicates with clients like a real administrator, books appointments, sends reminders, and maintains CRM.

## Who is Staffix for?

Staffix is ideal for any service business:
- Beauty salons and barbershops
- Medical and dental clinics
- Auto services
- Spa centers and massage salons
- Fitness clubs and yoga studios
- Restaurants and cafes
- Veterinary clinics
- Tutoring and educational centers
- Any appointment-based business

## Key Features

**AI Employee 24/7** — Smart Telegram bot that answers questions, consults, and books appointments even at night and on weekends.

**Online Booking** — Clients book through the bot. The system automatically checks availability and prevents double bookings.

**CRM System** — Complete client database with visit history, contacts, segmentation (VIP, active, inactive).

**Broadcasts** — Mass messages to client segments for promotions, news, and special offers.

**Automations** — Visit reminders (24h and 2h before), post-visit review collection, inactive client reactivation.

**Analytics** — Statistics on messages, bookings, conversions, revenue. CSV export.

**Knowledge Base** — Upload price lists, FAQ, documents — AI will answer based on your data.

**Team Management** — Add staff members, assign bookings, track workload.

## All Plans — All Features

All plans include the complete feature set. The only difference is the number of AI messages per month.`,

      uz: `## Staffix nima?

Staffix — bu sizning biznesingiz uchun **AI xodim** yaratadigan SaaS platforma. U Telegram'da 24/7 ishlaydi, mijozlar bilan haqiqiy administrator kabi muloqot qiladi, uchrashuvga yozadi, eslatmalar yuboradi va CRM yuritadi.

## Staffix kimlar uchun?

Staffix har qanday xizmat biznesi uchun ideal:
- Go'zallik salonlari va sartaroshxonalar
- Tibbiyot va stomatologiya klinikalari
- Avtoservislar
- Spa markazlar
- Fitnes klublar
- Restoranlar
- Veterinariya klinikalari
- Har qanday yozuv asosida ishlaydigan biznes

## Asosiy imkoniyatlar

**AI xodim 24/7** — Telegram'dagi aqlli bot savollarga javob beradi, maslahat beradi va uchrashuvga yozadi.

**Onlayn yozuv** — Mijozlar bot orqali yoziladi. Tizim avtomatik ravishda bo'sh vaqtni tekshiradi.

**CRM tizimi** — Tashrif tarixi, kontaktlar, segmentatsiya bilan to'liq mijozlar bazasi.

**Xabarlar** — Aksiyalar va maxsus takliflar uchun mijoz segmentlariga ommaviy xabarlar.

**Avtomatlashtirish** — Tashrif eslatmalari, sharh yig'ish, nofaol mijozlarni qaytarish.

**Analitika** — Xabarlar, yozuvlar, konversiyalar, daromad bo'yicha statistika.`,

      kz: `## Staffix дегеніміз не?

Staffix — бұл сіздің бизнесіңіз үшін **AI қызметкер** жасайтын SaaS платформа. Ол Telegram-да 24/7 жұмыс істейді, клиенттермен нағыз әкімші сияқты сөйлеседі, қабылдауға жазады, еске салулар жібереді және CRM жүргізеді.

## Staffix кімдерге арналған?

Staffix кез келген қызмет көрсету бизнесі үшін тамаша:
- Сұлулық салондары мен шаштаразханалар
- Медициналық және стоматологиялық клиникалар
- Автосервистер
- Спа орталықтар
- Фитнес клубтар
- Мейрамханалар
- Жазылу бойынша жұмыс істейтін кез келген бизнес

## Негізгі мүмкіндіктер

**AI қызметкер 24/7** — Telegram-дағы ақылды бот сұрақтарға жауап береді, кеңес береді және қабылдауға жазады.

**Онлайн жазылу** — Клиенттер бот арқылы жазылады. Жүйе автоматты түрде бос уақытты тексереді.

**CRM жүйесі** — Бару тарихы, контактілер, сегменттеу бар толық клиенттер базасы.

**Хабарламалар** — Акциялар мен арнайы ұсыныстар үшін клиент сегменттеріне жаппай хабарлар.

**Автоматтандыру** — Бару еске салулары, пікір жинау, белсенді емес клиенттерді қайтару.

**Аналитика** — Хабарлар, жазбалар, конверсиялар бойынша статистика.`,
    },
  },

  // ===== 2. GETTING STARTED =====
  {
    id: "getting-started",
    icon: "Rocket",
    title: {
      ru: "Начало работы",
      en: "Getting Started",
      uz: "Boshlash",
      kz: "Жұмысты бастау",
    },
    description: {
      ru: "Регистрация и первая настройка за 15 минут",
      en: "Registration and initial setup in 15 minutes",
      uz: "Ro'yxatdan o'tish va dastlabki sozlash",
      kz: "Тіркелу және алғашқы баптау",
    },
    content: {
      ru: `## Быстрый старт

Настройка Staffix занимает всего 10-15 минут. Следуйте этим шагам:

### Шаг 1. Регистрация

1. Перейдите на staffix.io и нажмите **«Начать бесплатно»**
2. Заполните форму: имя, email, пароль, название бизнеса
3. На ваш email придёт **6-значный код подтверждения**
4. Введите код — аккаунт активирован!

Вы получаете 14 дней бесплатного доступа ко всем функциям + 100 сообщений AI-сотрудника.

### Шаг 2. Создание Telegram-бота

1. Откройте Telegram и найдите **@BotFather**
2. Отправьте команду **/newbot**
3. Придумайте имя бота (например: «Салон Красоты Помощник»)
4. Придумайте username (например: salon_krasoty_bot)
5. BotFather выдаст вам **токен** — длинную строку вида 123456789:ABCdef...
6. Скопируйте токен

### Шаг 3. Подключение бота к Staffix

1. В дашборде перейдите в раздел **«AI-сотрудник»**
2. Вставьте токен в поле ввода
3. Нажмите **«Активировать»**
4. Бот подключён! Статус сменится на зелёный.

### Шаг 4. Добавление услуг

1. Перейдите в раздел **«Услуги»**
2. Нажмите **«Добавить услугу»**
3. Заполните: название, описание, цену, длительность (в минутах)
4. Повторите для каждой услуги

**Совет:** Чем подробнее описание, тем лучше AI сможет рассказать о ней клиенту.

### Шаг 5. Добавление сотрудников

1. Перейдите в раздел **«Команда»**
2. Нажмите **«Добавить сотрудника»**
3. Укажите имя, должность, загрузите фото (необязательно)

### Шаг 6. Создание базы знаний

1. Перейдите в раздел **«База знаний»**
2. Добавьте FAQ: напишите частые вопросы и ответы
3. Загрузите документы: прайс-листы, правила, описания (PDF, Word, Excel)

### Готово!

Ваш AI-сотрудник готов к работе. Отправьте ссылку на бота своим клиентам или разместите в соцсетях.`,

      en: `## Quick Start

Setting up Staffix takes just 10-15 minutes. Follow these steps:

### Step 1. Registration

1. Go to staffix.io and click **"Start Free"**
2. Fill in: name, email, password, business name
3. You'll receive a **6-digit verification code** via email
4. Enter the code — account activated!

You get 14 days of free access to all features + 100 AI messages.

### Step 2. Create a Telegram Bot

1. Open Telegram and find **@BotFather**
2. Send the **/newbot** command
3. Choose a bot name (e.g., "Beauty Salon Assistant")
4. Choose a username (e.g., beauty_salon_bot)
5. BotFather will give you a **token** — a long string like 123456789:ABCdef...
6. Copy the token

### Step 3. Connect the Bot to Staffix

1. In the dashboard, go to **"AI Employee"**
2. Paste the token in the input field
3. Click **"Activate"**
4. Bot connected! Status will turn green.

### Step 4. Add Services

1. Go to **"Services"** section
2. Click **"Add Service"**
3. Fill in: name, description, price, duration (in minutes)
4. Repeat for each service

### Step 5. Add Staff

1. Go to **"Team"** section
2. Click **"Add Staff"**
3. Enter name, role, upload photo (optional)

### Step 6. Create Knowledge Base

1. Go to **"Knowledge Base"** section
2. Add FAQ: write common questions and answers
3. Upload documents: price lists, policies (PDF, Word, Excel)

### Done!

Your AI employee is ready. Share the bot link with clients or post on social media.`,

      uz: `## Tez boshlash

Staffix-ni sozlash atigi 10-15 daqiqa oladi.

### 1-qadam. Ro'yxatdan o'tish
1. staffix.io ga o'ting va **"Bepul boshlash"** tugmasini bosing
2. To'ldiring: ism, email, parol, biznes nomi
3. Emailingizga **6 xonali tasdiqlash kodi** keladi
4. Kodni kiriting — akkaunt faollashtirildi!

### 2-qadam. Telegram-bot yaratish
1. Telegram'da **@BotFather** ni toping
2. **/newbot** buyrug'ini yuboring
3. Bot nomini tanlang
4. Username tanlang
5. Tokenni nusxalang

### 3-qadam. Botni Staffix-ga ulash
1. Dashboardda **"AI xodim"** bo'limiga o'ting
2. Tokenni kiriting va **"Faollashtirish"** ni bosing

### 4-qadam. Xizmatlarni qo'shish
1. **"Xizmatlar"** bo'limiga o'ting
2. Har bir xizmatni qo'shing: nom, tavsif, narx, davomiylik

### 5-qadam. Xodimlarni qo'shish
1. **"Jamoa"** bo'limiga o'ting
2. Ism, lavozim, rasm qo'shing

### 6-qadam. Bilimlar bazasini yaratish
1. **"Bilimlar bazasi"** bo'limiga o'ting
2. FAQ va hujjatlarni qo'shing

### Tayyor!`,

      kz: `## Жылдам бастау

Staffix-ті баптау небәрі 10-15 минут алады.

### 1-қадам. Тіркелу
1. staffix.io сайтына кіріп, **"Тегін бастау"** батырмасын басыңыз
2. Толтырыңыз: аты-жөн, email, құпия сөз, бизнес атауы
3. Email-ге **6 таңбалы растау коды** келеді
4. Кодты енгізіңіз — аккаунт белсендірілді!

### 2-қадам. Telegram-бот жасау
1. Telegram-да **@BotFather** табыңыз
2. **/newbot** командасын жіберіңіз
3. Бот атын таңдаңыз
4. Username таңдаңыз
5. Токенді көшіріңіз

### 3-қадам. Ботты Staffix-ке қосу
1. Басқару тақтасында **"AI қызметкер"** бөліміне өтіңіз
2. Токенді енгізіп, **"Белсендіру"** батырмасын басыңыз

### 4-қадам. Қызметтерді қосу
**"Қызметтер"** бөлімінде әрбір қызметті қосыңыз: атауы, сипаттамасы, бағасы, ұзақтығы.

### 5-қадам. Қызметкерлерді қосу
**"Команда"** бөлімінде аты, лауазымы, фотосуретін қосыңыз.

### 6-қадам. Білім базасын жасау
**"Білім базасы"** бөлімінде FAQ және құжаттарды қосыңыз.

### Дайын!`,
    },
  },

  // ===== 3. AI EMPLOYEE =====
  {
    id: "ai-employee",
    icon: "Bot",
    title: {
      ru: "AI-сотрудник",
      en: "AI Employee",
      uz: "AI xodim",
      kz: "AI қызметкер",
    },
    description: {
      ru: "Настройка бота, обучение и персонализация",
      en: "Bot setup, training and personalization",
      uz: "Bot sozlash, o'rgatish va shaxsiylashtirish",
      kz: "Бот баптау, үйрету және жекелендіру",
    },
    content: {
      ru: `## Настройка AI-сотрудника

AI-сотрудник — это сердце Staffix. Он общается с вашими клиентами через Telegram, отвечает на вопросы, записывает на приём и помнит каждого клиента.

### Подключение Telegram-бота

1. Создайте бота через @BotFather (команда /newbot)
2. Скопируйте токен
3. В дашборде → «AI-сотрудник» → вставьте токен → «Активировать»
4. Статус сменится на «Подключён» (зелёный)

### Стиль общения

Выберите один из трёх стилей:

- **Дружелюбный** — тёплый, располагающий тон. Подходит для салонов красоты, спа, фитнеса.
- **Профессиональный** — деловой, корректный. Подходит для клиник, юридических фирм.
- **Неформальный** — расслабленный, молодёжный. Подходит для барбершопов, кафе.

### Приветственное сообщение

Это первое сообщение, которое увидит клиент при запуске бота. Напишите что-то привлекательное:

*Пример: «Привет! Я — виртуальный помощник салона "Эстетика". Могу записать вас к мастеру, рассказать об услугах и ценах. Чем могу помочь?»*

### Специальные правила

Добавьте инструкции для AI:
- «Всегда упоминай акцию понедельника — скидка 15% на маникюр»
- «Не обсуждай конкурентов»
- «Предлагай комбо-услуги при записи на стрижку»
- «Если клиент спрашивает про цены — давай точные цифры из каталога»

### Шаблоны (6 готовых)

Выберите шаблон, подходящий вашей отрасли:
1. **Салон красоты** — акцент на бьюти-услуги
2. **Медицинская клиника** — деликатный медицинский тон
3. **Ресторан** — гостеприимный стиль
4. **Фитнес-клуб** — мотивирующий тон
5. **Автосервис** — технический, но понятный
6. **Онлайн-магазин** — продающий стиль

### Загрузка документов

AI обучается на ваших документах. Загрузите:
- Прайс-лист (PDF, Word)
- Описание услуг и процедур
- Правила и политики
- Часто задаваемые вопросы

Поддерживаемые форматы: PDF, DOC, DOCX, TXT, XLSX, XLS.

### Аватар бота

Установите фото бота через @BotFather:
1. Отправьте /mybots
2. Выберите вашего бота
3. Edit Bot → Edit Botpic
4. Загрузите логотип или фото

### Память AI

AI запоминает каждого клиента:
- Имя и контакты
- Историю визитов
- Предпочтения
- Предыдущие разговоры

Это позволяет персонализировать общение и предлагать релевантные услуги.`,

      en: `## Setting Up the AI Employee

The AI employee is the heart of Staffix. It communicates with your clients through Telegram, answers questions, books appointments, and remembers each client.

### Connecting the Telegram Bot

1. Create a bot via @BotFather (/newbot command)
2. Copy the token
3. Dashboard → "AI Employee" → paste token → "Activate"
4. Status changes to "Connected" (green)

### Communication Style

Choose one of three styles:
- **Friendly** — warm, welcoming tone. Great for salons, spas, fitness.
- **Professional** — business-like, correct. For clinics, law firms.
- **Casual** — relaxed, youthful. For barbershops, cafes.

### Welcome Message

This is the first message clients see when starting the bot. Write something engaging.

### Special Rules

Add instructions for AI:
- "Always mention Monday's promotion — 15% off manicure"
- "Don't discuss competitors"
- "Suggest combo services when booking a haircut"

### Templates (6 ready-made)

Choose a template for your industry:
1. Beauty Salon, 2. Medical Clinic, 3. Restaurant, 4. Fitness Club, 5. Auto Service, 6. Online Shop

### Document Upload

AI learns from your documents. Upload price lists, service descriptions, policies. Supported: PDF, DOC, DOCX, TXT, XLSX, XLS.

### AI Memory

AI remembers each client: name, contacts, visit history, preferences, previous conversations.`,

      uz: `## AI xodimni sozlash

AI xodim Staffix-ning yuragi. U Telegram orqali mijozlaringiz bilan muloqot qiladi.

### Telegram-botni ulash
1. @BotFather orqali bot yarating
2. Tokenni nusxalang
3. Dashboard → "AI xodim" → tokenni kiriting → "Faollashtirish"

### Muloqot uslubi
- **Do'stona** — iliq, samimiy ohang
- **Professional** — rasmiy, to'g'ri
- **Norasmiy** — erkin, yoshlarga mos

### Salomlash xabari
Mijoz botni ishga tushirganda ko'radigan birinchi xabar.

### Maxsus qoidalar
AI uchun ko'rsatmalar qo'shing.

### Hujjatlarni yuklash
AI hujjatlaringizdan o'rganadi. Narxlar, xizmat tavsiflari yuklang. Formatlar: PDF, DOC, DOCX, TXT, XLSX.

### AI xotirasi
AI har bir mijozni eslab qoladi: ism, tashrif tarixi, afzalliklar.`,

      kz: `## AI қызметкерді баптау

AI қызметкер Staffix-тің жүрегі. Ол Telegram арқылы клиенттеріңізбен сөйлеседі.

### Telegram-ботты қосу
1. @BotFather арқылы бот жасаңыз
2. Токенді көшіріңіз
3. Басқару тақтасы → "AI қызметкер" → токенді енгізіңіз → "Белсендіру"

### Қарым-қатынас стилі
- **Достық** — жылы, қонақжай үн
- **Кәсіби** — іскери, дұрыс
- **Бейресми** — еркін, жастарға арналған

### Сәлемдесу хабары
Клиент ботты іске қосқанда көретін бірінші хабар.

### Арнайы ережелер
AI үшін нұсқаулар қосыңыз.

### Құжаттарды жүктеу
AI құжаттарыңыздан үйренеді. Форматтар: PDF, DOC, DOCX, TXT, XLSX.

### AI жады
AI әрбір клиентті есте сақтайды: аты, бару тарихы, қалаулары.`,
    },
  },

  // ===== 4. AUTOMATIONS =====
  {
    id: "automations",
    icon: "Zap",
    title: {
      ru: "Автоматизации",
      en: "Automations",
      uz: "Avtomatlashtirish",
      kz: "Автоматтандыру",
    },
    description: {
      ru: "Напоминания, отзывы и реактивация клиентов",
      en: "Reminders, reviews and client reactivation",
      uz: "Eslatmalar, sharhlar va mijozlarni qaytarish",
      kz: "Еске салулар, пікірлер және клиенттерді қайтару",
    },
    content: {
      ru: `## Автоматизации

Автоматизации экономят ваше время и увеличивают выручку. Три мощных инструмента:

### 1. Напоминания о визите

Снижают неявки на 40-60%.

**Напоминание за 24 часа:**
Клиент получает сообщение за день до визита с деталями записи и кнопками:
- ✅ Подтвердить
- 🔄 Перенести
- ❌ Отменить

**Напоминание за 2 часа:**
Короткое напоминание перед самым визитом.

Включите оба в разделе **Автоматизации → Напоминания**.

### 2. Сбор отзывов

Повышает вашу репутацию в Google и 2GIS.

**Как работает:**
1. После завершения услуги (через настраиваемое время: 1-24 часа) клиент получает сообщение
2. Клиент ставит оценку от 1 до 5 звёзд
3. **4-5 звёзд** → AI просит оставить отзыв на Google Maps или 2GIS (вы добавляете ссылки)
4. **1-3 звезды** → AI просит описать проблему (отзыв остаётся приватным, вы получаете уведомление)

**Настройка:**
- Включите в разделе **Автоматизации → Отзывы**
- Установите задержку (рекомендуем 2-4 часа после визита)
- Добавьте ссылку на Google Maps и/или 2GIS

### 3. Реактивация клиентов

Возвращает ушедших клиентов с помощью персонализированных предложений.

**Как работает:**
- Система определяет клиентов, которые давно не приходили
- Автоматически отправляет сообщение со скидкой
- Разные сообщения в зависимости от срока неактивности

**Настройка:**
- Включите в разделе **Автоматизации → Реактивация**
- Укажите порог дней без визита (14-180 дней)
- Установите размер скидки (5-50%)
- Система не отправит повторное сообщение чаще раза в месяц`,

      en: `## Automations

Automations save time and increase revenue. Three powerful tools:

### 1. Visit Reminders

Reduce no-shows by 40-60%.

**24-hour reminder:** Client receives a message with booking details and buttons: Confirm, Reschedule, Cancel.

**2-hour reminder:** Short reminder before the visit.

Enable both in **Automations → Reminders**.

### 2. Review Collection

Boosts your Google and 2GIS reputation.

**How it works:**
1. After service completion (configurable: 1-24 hours), client receives a message
2. Client rates 1-5 stars
3. **4-5 stars** → AI asks to leave a review on Google Maps or 2GIS
4. **1-3 stars** → AI asks to describe the issue (stays private)

### 3. Client Reactivation

Brings back inactive clients with personalized offers.

**How it works:**
- System identifies clients who haven't visited recently
- Sends automated message with discount
- Different messages based on inactivity length
- Monthly cooldown prevents spam`,

      uz: `## Avtomatlashtirish

### 1. Tashrif eslatmalari
Kelmay qolishni 40-60% ga kamaytiradi. 24 soat va 2 soat oldin eslatma yuboriladi.

### 2. Sharhlar yig'ish
Xizmatdan so'ng mijoz 1-5 yulduz baho beradi. 4-5 yulduz — Google/2GIS ga yo'naltirish. 1-3 yulduz — shaxsiy fikr-mulohaza.

### 3. Mijozlarni qaytarish
Uzoq vaqt kelmagan mijozlarga avtomatik chegirma takliflari yuboriladi.`,

      kz: `## Автоматтандыру

### 1. Бару еске салулары
Келмей қалуды 40-60%-ға азайтады. 24 сағат және 2 сағат бұрын еске салу жіберіледі.

### 2. Пікірлер жинау
Қызметтен кейін клиент 1-5 жұлдыз баға береді. 4-5 жұлдыз — Google/2GIS-ке бағыттау. 1-3 жұлдыз — жеке кері байланыс.

### 3. Клиенттерді қайтару
Ұзақ уақыт келмеген клиенттерге автоматты жеңілдік ұсыныстары жіберіледі.`,
    },
  },

  // ===== 5. BROADCASTS =====
  {
    id: "broadcasts",
    icon: "Send",
    title: {
      ru: "Рассылки",
      en: "Broadcasts",
      uz: "Xabarlar",
      kz: "Хабарламалар",
    },
    description: {
      ru: "Массовые сообщения клиентам по сегментам",
      en: "Mass messages to client segments",
      uz: "Mijoz segmentlariga ommaviy xabarlar",
      kz: "Клиент сегменттеріне жаппай хабарлар",
    },
    content: {
      ru: `## Рассылки

Рассылки — мощный инструмент для акций, новостей и удержания клиентов.

### Создание рассылки

1. Перейдите в раздел **«Рассылки»**
2. Нажмите **«Создать рассылку»**
3. Заполните:
   - **Название** — для вашего удобства (клиенты не видят)
   - **Текст сообщения** — то, что получат клиенты
   - **Сегмент** — кому отправить

### Сегменты

- **Все клиенты** — все, кто когда-либо общался с ботом
- **VIP** — отмеченные как VIP клиенты
- **Активные** — клиенты с недавними визитами
- **Неактивные** — клиенты, давно не приходившие

### Статистика

После отправки отслеживайте:
- Количество получателей
- Доставлено
- Не доставлено (ошибки)

### Советы для эффективных рассылок

- Пишите коротко и с пользой для клиента
- Добавляйте конкретные цифры скидок
- Указывайте срок действия акции
- Не рассылайте чаще 2-3 раз в месяц
- Используйте сегменты — VIP-клиентам можно отправить эксклюзивное предложение`,

      en: `## Broadcasts

Broadcasts are a powerful tool for promotions, news, and client retention.

### Creating a Broadcast

1. Go to **"Broadcasts"** section
2. Click **"Create Broadcast"**
3. Fill in: title, message text, target segment

### Segments
- **All clients** — everyone who interacted with the bot
- **VIP** — marked as VIP
- **Active** — recent visitors
- **Inactive** — haven't visited recently

### Tips
- Keep messages short and valuable
- Include specific discount numbers
- Set promotion deadlines
- Don't broadcast more than 2-3 times per month`,

      uz: `## Xabarlar

### Xabar yaratish
1. **"Xabarlar"** bo'limiga o'ting
2. **"Xabar yaratish"** ni bosing
3. Sarlavha, xabar matni, maqsad segmentini to'ldiring

### Segmentlar
- Barcha mijozlar, VIP, Faol, Nofaol

### Maslahatlar
- Qisqa va foydali yozing
- Chegirma raqamlarini ko'rsating
- Oyiga 2-3 martadan ko'p yubormaing`,

      kz: `## Хабарламалар

### Хабарлама жасау
1. **"Хабарламалар"** бөліміне өтіңіз
2. **"Хабарлама жасау"** батырмасын басыңыз
3. Тақырып, хабар мәтіні, мақсатты сегментті толтырыңыз

### Сегменттер
- Барлық клиенттер, VIP, Белсенді, Белсенді емес

### Кеңестер
- Қысқа және пайдалы жазыңыз
- Жеңілдік сандарын көрсетіңіз`,
    },
  },

  // ===== 6. CHANNELS =====
  {
    id: "channels",
    icon: "MessageSquare",
    title: {
      ru: "Каналы",
      en: "Channels",
      uz: "Kanallar",
      kz: "Арналар",
    },
    description: {
      ru: "Telegram, WhatsApp и Instagram",
      en: "Telegram, WhatsApp and Instagram",
      uz: "Telegram, WhatsApp va Instagram",
      kz: "Telegram, WhatsApp және Instagram",
    },
    content: {
      ru: `## Каналы связи

### Telegram (активен)

Telegram — основной канал работы AI-сотрудника. Полная интеграция:
- AI отвечает на сообщения
- Записывает на приём
- Отправляет напоминания и рассылки
- Собирает отзывы

**Статистика канала:**
- Всего отправлено сообщений
- Всего подключённых клиентов
- Новые лиды за сегодня

### WhatsApp (скоро)

Планируемые возможности:
- Авто-ответы 24/7
- Интеграция с рекламой Click-to-WhatsApp
- QR-коды для подключения
- Шаблоны сообщений

### Instagram (скоро)

Планируемые возможности:
- Авто-ответы в Direct
- Лиды из рекламы
- Ответы на Stories
- Ответы на комментарии

### Единая база клиентов

Когда WhatsApp и Instagram будут подключены, все клиенты из всех каналов попадут в единую CRM. AI будет отвечать везде одинаково качественно.`,

      en: `## Communication Channels

### Telegram (Active)
Full integration: AI answers messages, books appointments, sends reminders and broadcasts, collects reviews.

### WhatsApp (Coming Soon)
Planned: 24/7 auto-responses, Click-to-WhatsApp ads, QR codes, message templates.

### Instagram (Coming Soon)
Planned: Direct message auto-responses, ad leads, Story replies, comment responses.

### Unified Client Base
All clients from all channels will go into a single CRM.`,

      uz: `## Aloqa kanallari

### Telegram (Faol)
To'liq integratsiya: AI xabarlarga javob beradi, uchrashuvga yozadi, eslatmalar va xabarlar yuboradi.

### WhatsApp (Tez kunda)
Rejalashtirilgan: 24/7 avto-javoblar, QR kodlar, xabar shablonlari.

### Instagram (Tez kunda)
Rejalashtirilgan: Direct xabarlarga avto-javoblar, reklama lidlari.`,

      kz: `## Байланыс арналары

### Telegram (Белсенді)
Толық интеграция: AI хабарларға жауап береді, қабылдауға жазады, еске салулар мен хабарламалар жібереді.

### WhatsApp (Жақында)
Жоспарланған: 24/7 авто-жауаптар, QR кодтар, хабар шаблондары.

### Instagram (Жақында)
Жоспарланған: Direct хабарларға авто-жауаптар, жарнама лидтері.`,
    },
  },

  // ===== 7. SERVICES =====
  {
    id: "services",
    icon: "FileText",
    title: {
      ru: "Услуги",
      en: "Services",
      uz: "Xizmatlar",
      kz: "Қызметтер",
    },
    description: {
      ru: "Каталог услуг с ценами и описаниями",
      en: "Service catalog with prices and descriptions",
      uz: "Narxlar va tavsiflar bilan xizmatlar katalogi",
      kz: "Бағалар мен сипаттамалары бар қызметтер каталогі",
    },
    content: {
      ru: `## Управление услугами

### Добавление услуги

1. Перейдите в раздел **«Услуги»**
2. Нажмите **«Добавить»**
3. Заполните поля:
   - **Название** — краткое и понятное
   - **Описание** — что включает, результат, особенности
   - **Цена** — в вашей валюте
   - **Длительность** — в минутах (минимум 5 мин)

### Советы по описанию услуг

AI использует описания для ответов клиентам. Чем подробнее — тем лучше:

**Плохо:** «Маникюр — 500 руб»
**Хорошо:** «Классический маникюр — аккуратная обработка кутикулы, придание формы ногтям, покрытие лаком на выбор. Длительность 45 минут. Цена 500 руб.»

### Что писать в описании:
- Что входит в услугу
- Какой результат получит клиент
- Противопоказания (если есть)
- Рекомендации после процедуры
- Отличия от похожих услуг

### Редактирование и удаление

- Нажмите иконку карандаша для редактирования
- Нажмите иконку корзины для удаления
- Изменения сразу отражаются в работе AI`,

      en: `## Service Management

### Adding a Service
1. Go to **"Services"** section
2. Click **"Add"**
3. Fill in: name, description, price, duration (in minutes)

### Description Tips
AI uses descriptions to answer clients. The more detailed — the better.

**Bad:** "Manicure — $20"
**Good:** "Classic manicure — cuticle treatment, nail shaping, polish of your choice. 45 minutes. $20."

### What to include:
- What's included in the service
- Expected result
- Contraindications (if any)
- Post-procedure recommendations`,

      uz: `## Xizmatlarni boshqarish

### Xizmat qo'shish
1. **"Xizmatlar"** bo'limiga o'ting
2. **"Qo'shish"** ni bosing
3. To'ldiring: nom, tavsif, narx, davomiylik

### Tavsif bo'yicha maslahatlar
AI javob berish uchun tavsiflardan foydalanadi. Qanchalik batafsil bo'lsa — shunchalik yaxshi.`,

      kz: `## Қызметтерді басқару

### Қызмет қосу
1. **"Қызметтер"** бөліміне өтіңіз
2. **"Қосу"** батырмасын басыңыз
3. Толтырыңыз: атауы, сипаттамасы, бағасы, ұзақтығы

### Сипаттама бойынша кеңестер
AI клиенттерге жауап беру үшін сипаттамаларды пайдаланады. Неғұрлым егжей-тегжейлі болса — соғұрлым жақсы.`,
    },
  },

  // ===== 8. TEAM =====
  {
    id: "team",
    icon: "Users",
    title: {
      ru: "Команда",
      en: "Team",
      uz: "Jamoa",
      kz: "Команда",
    },
    description: {
      ru: "Управление сотрудниками",
      en: "Staff management",
      uz: "Xodimlarni boshqarish",
      kz: "Қызметкерлерді басқару",
    },
    content: {
      ru: `## Управление командой

### Добавление сотрудника

1. Перейдите в раздел **«Команда»**
2. Нажмите **«Добавить сотрудника»**
3. Заполните:
   - **Имя** — полное имя мастера/специалиста
   - **Должность** — например: «Стилист», «Косметолог», «Массажист»
   - **Фото** — необязательно, но рекомендуется (макс. 500 КБ)

### Зачем добавлять команду?

- AI сможет предлагать клиентам конкретного мастера
- Записи привязываются к сотрудникам
- Клиенты могут запросить запись к любимому мастеру
- В аналитике видна загрузка каждого сотрудника

### Редактирование

Нажмите на карточку сотрудника для изменения данных или удаления.`,

      en: `## Team Management

### Adding Staff
1. Go to **"Team"** section
2. Click **"Add Staff"**
3. Fill in: name, role, photo (optional, max 500KB)

### Why add team members?
- AI can suggest specific staff to clients
- Bookings are assigned to staff
- Clients can request their favorite specialist
- Analytics show workload per staff member`,

      uz: `## Jamoani boshqarish

### Xodim qo'shish
1. **"Jamoa"** bo'limiga o'ting
2. **"Xodim qo'shish"** ni bosing
3. To'ldiring: ism, lavozim, rasm (ixtiyoriy)

### Nima uchun jamoa qo'shish kerak?
- AI mijozlarga aniq mutaxassisni taklif qila oladi
- Yozuvlar xodimlarga biriktiriladi`,

      kz: `## Команданы басқару

### Қызметкер қосу
1. **"Команда"** бөліміне өтіңіз
2. **"Қызметкер қосу"** батырмасын басыңыз
3. Толтырыңыз: аты, лауазымы, фотосурет (міндетті емес)

### Неліктен команда қосу керек?
- AI клиенттерге нақты маманды ұсына алады
- Жазбалар қызметкерлерге тағайындалады`,
    },
  },

  // ===== 9. KNOWLEDGE BASE =====
  {
    id: "knowledge-base",
    icon: "BookOpen",
    title: {
      ru: "База знаний",
      en: "Knowledge Base",
      uz: "Bilimlar bazasi",
      kz: "Білім базасы",
    },
    description: {
      ru: "FAQ и документы для обучения AI",
      en: "FAQ and documents for AI training",
      uz: "AI o'rgatish uchun FAQ va hujjatlar",
      kz: "AI үйрету үшін FAQ және құжаттар",
    },
    content: {
      ru: `## База знаний

База знаний — это то, что делает вашего AI-сотрудника по-настоящему умным. Чем больше информации вы предоставите, тем точнее и полезнее будут ответы.

### Часть 1: FAQ (Вопросы и ответы)

Добавляйте пары «вопрос — ответ». AI будет использовать их для точных ответов.

**Примеры хороших FAQ:**

- **В:** Сколько стоит стрижка?
  **О:** Мужская стрижка — 500 руб, женская — от 800 руб. Цена зависит от длины волос.

- **В:** Как добраться до салона?
  **О:** Мы находимся по адресу ул. Ленина, 15. Вход со двора. Ближайшее метро — Площадь Революции (5 мин пешком).

- **В:** Можно ли прийти без записи?
  **О:** Рекомендуем записаться заранее, но если есть свободное окно — примем без записи.

### Какие вопросы добавить:

1. Цены на основные услуги
2. Адрес и как добраться
3. Часы работы
4. Правила отмены записи
5. Акции и скидки
6. Противопоказания (для мед. услуг)
7. Что взять с собой на визит
8. Формы оплаты (наличные, карта)
9. Парковка
10. Детские услуги (если есть)

### Часть 2: Документы

Загрузите файлы — AI извлечёт из них информацию:

- **PDF** — прайс-листы, каталоги
- **Word (DOC/DOCX)** — описания услуг, правила
- **Excel (XLSX)** — таблицы с ценами
- **TXT** — любая текстовая информация

### Советы для максимальной эффективности

- Обновляйте FAQ при изменении цен или условий
- Загружайте актуальные прайсы
- Добавляйте ответы на вопросы, которые часто задают клиенты
- Пишите ответы так, как хотели бы, чтобы AI отвечал
- Включайте детали: адрес, ориентиры, контакты для связи`,

      en: `## Knowledge Base

The knowledge base is what makes your AI employee truly smart. The more information you provide, the more accurate and useful responses will be.

### Part 1: FAQ (Questions & Answers)

Add question-answer pairs. AI will use them for accurate responses.

### What questions to add:
1. Prices for main services
2. Address and directions
3. Working hours
4. Cancellation policy
5. Promotions and discounts
6. Contraindications (for medical services)
7. What to bring to a visit
8. Payment methods
9. Parking
10. Children's services

### Part 2: Documents

Upload files — AI will extract information:
- PDF — price lists, catalogs
- Word — service descriptions, policies
- Excel — price tables
- TXT — any text information

### Tips for Maximum Effectiveness
- Update FAQ when prices or conditions change
- Upload current price lists
- Write answers the way you'd want AI to respond`,

      uz: `## Bilimlar bazasi

### 1-qism: FAQ
Savol-javob juftlarini qo'shing. AI aniq javoblar uchun ulardan foydalanadi.

### Qanday savollar qo'shish kerak:
1. Asosiy xizmatlar narxlari
2. Manzil va yo'nalishlar
3. Ish soatlari
4. Bekor qilish siyosati
5. Aksiyalar va chegirmalar

### 2-qism: Hujjatlar
Fayllarni yuklang — AI ma'lumotlarni oladi: PDF, Word, Excel, TXT.`,

      kz: `## Білім базасы

### 1-бөлім: FAQ
Сұрақ-жауап жұптарын қосыңыз. AI дәл жауаптар үшін оларды пайдаланады.

### Қандай сұрақтар қосу керек:
1. Негізгі қызметтер бағалары
2. Мекен-жай және жол
3. Жұмыс уақыты
4. Бас тарту саясаты
5. Акциялар мен жеңілдіктер

### 2-бөлім: Құжаттар
Файлдарды жүктеңіз — AI ақпарат алады: PDF, Word, Excel, TXT.`,
    },
  },

  // ===== 10. CRM =====
  {
    id: "crm",
    icon: "UserCheck",
    title: {
      ru: "CRM",
      en: "CRM",
      uz: "CRM",
      kz: "CRM",
    },
    description: {
      ru: "Управление клиентской базой",
      en: "Client database management",
      uz: "Mijozlar bazasini boshqarish",
      kz: "Клиенттер базасын басқару",
    },
    content: {
      ru: `## CRM-система

CRM в Staffix автоматически собирает и организует информацию о клиентах.

### Сегменты клиентов

- **VIP** — важные клиенты (помечаются вручную)
- **Активные** — клиенты с недавними визитами (за последние 30 дней)
- **Неактивные** — давно не приходили (более 30 дней)
- **Заблокированные** — заблокированные вами клиенты

### Информация о клиенте

Для каждого клиента хранится:
- Имя и телефон
- Количество визитов
- Количество сообщений
- Средняя оценка
- Дата последнего визита
- Статус (VIP/активный/неактивный)
- История всех записей
- История переписки с AI

### Поиск и фильтрация

- Поиск по имени или телефону
- Фильтр по сегментам
- Постраничная навигация

### Использование сегментов

Используйте сегменты для таргетированных рассылок:
- **VIP** → эксклюзивные предложения и ранний доступ к акциям
- **Активные** → новости и обновления услуг
- **Неактивные** → скидки для возвращения

### Автоматическое пополнение

CRM пополняется автоматически — каждый новый клиент, написавший боту, попадает в базу. AI извлекает имя и телефон из переписки.`,

      en: `## CRM System

CRM in Staffix automatically collects and organizes client information.

### Client Segments
- **VIP** — important clients (marked manually)
- **Active** — recent visitors (last 30 days)
- **Inactive** — haven't visited (30+ days)
- **Blocked** — blocked by you

### Client Information
For each client: name, phone, visits count, messages count, average rating, last visit date, status, booking history, AI conversation history.

### Using Segments for Broadcasts
- VIP → exclusive offers
- Active → news and updates
- Inactive → return discounts

### Automatic Population
CRM fills automatically — every new client who messages the bot gets added.`,

      uz: `## CRM tizimi

Staffix-dagi CRM mijozlar haqidagi ma'lumotlarni avtomatik yig'adi.

### Mijoz segmentlari
- **VIP**, **Faol**, **Nofaol**, **Bloklangan**

### Mijoz ma'lumotlari
Har bir mijoz uchun: ism, telefon, tashriflar soni, xabarlar soni, o'rtacha baho, oxirgi tashrif sanasi saqlanadi.

### CRM avtomatik to'ldiriladi
Botga yozgan har bir yangi mijoz bazaga tushadi.`,

      kz: `## CRM жүйесі

Staffix-тегі CRM клиенттер туралы ақпаратты автоматты жинайды.

### Клиент сегменттері
- **VIP**, **Белсенді**, **Белсенді емес**, **Бұғатталған**

### Клиент ақпараты
Әрбір клиент үшін: аты, телефоны, барулар саны, хабарлар саны, орташа баға, соңғы бару күні сақталады.

### CRM автоматты толтырылады
Ботқа жазған әрбір жаңа клиент базаға түседі.`,
    },
  },

  // ===== 11. ANALYTICS =====
  {
    id: "analytics",
    icon: "BarChart3",
    title: {
      ru: "Аналитика",
      en: "Analytics",
      uz: "Analitika",
      kz: "Аналитика",
    },
    description: {
      ru: "Статистика и отчёты по всем метрикам",
      en: "Statistics and reports for all metrics",
      uz: "Barcha ko'rsatkichlar bo'yicha statistika",
      kz: "Барлық көрсеткіштер бойынша статистика",
    },
    content: {
      ru: `## Аналитика и статистика

### Основные метрики

В разделе **«Статистика»** отслеживайте:

- **Сообщения** — сколько сообщений отправил AI за период
- **Записи** — количество созданных записей
- **Клиенты** — сколько уникальных клиентов
- **Время ответа** — средняя скорость ответа AI (в секундах)

### Тренды

Каждая метрика показывает тренд по сравнению с предыдущим периодом (рост или снижение в процентах).

### Периоды

Выберите период анализа:
- **Неделя** — последние 7 дней
- **Месяц** — последние 30 дней
- **Всё время** — с момента регистрации

### Конверсия

**Сообщения → Записи** — ключевая метрика эффективности AI. Показывает, какой процент переписок заканчивается записью на приём.

### Популярные вопросы

Список самых частых вопросов клиентов — помогает понять, что интересует клиентов и что добавить в базу знаний.

### CRM-аналитика

- **Сегменты клиентов** — соотношение VIP, активных и неактивных
- **Записи по статусам** — ожидание, подтверждённые, завершённые, отменённые
- **Выручка** — суммарная выручка по завершённым записям
- **Рассылки** — количество отправленных рассылок
- **Средняя оценка** — рейтинг от клиентов

### Экспорт данных

Нажмите **«Экспорт CSV»** для скачивания данных в таблицу. Полезно для отчётов и анализа в Excel.`,

      en: `## Analytics & Statistics

### Key Metrics
- **Messages** — AI messages sent per period
- **Bookings** — appointments created
- **Clients** — unique clients
- **Response time** — average AI response speed

### Trends
Each metric shows trend vs previous period (growth or decline %).

### Conversion
Messages → Bookings conversion rate — key AI effectiveness metric.

### Popular Questions
Most frequent client questions — helps understand what to add to knowledge base.

### CRM Analytics
- Client segments breakdown
- Bookings by status
- Revenue tracking
- Broadcast stats
- Average rating

### Data Export
Click "Export CSV" to download data for Excel analysis.`,

      uz: `## Analitika va statistika

### Asosiy ko'rsatkichlar
- Xabarlar, Yozuvlar, Mijozlar, Javob vaqti

### Konversiya
Xabarlar → Yozuvlar konversiya darajasi.

### CRM analitikasi
Mijoz segmentlari, yozuvlar holati, daromad, o'rtacha baho.

### Ma'lumotlarni eksport qilish
Excel tahlili uchun CSV yuklab olish.`,

      kz: `## Аналитика және статистика

### Негізгі көрсеткіштер
- Хабарлар, Жазбалар, Клиенттер, Жауап уақыты

### Конверсия
Хабарлар → Жазбалар конверсия деңгейі.

### CRM аналитикасы
Клиент сегменттері, жазбалар мәртебесі, табыс, орташа баға.

### Деректерді экспорттау
Excel талдауы үшін CSV жүктеп алу.`,
    },
  },

  // ===== 12. AI SALES BOT FOR SHOPS =====
  {
    id: "shop-sales",
    icon: "ShoppingCart",
    title: {
      ru: "AI-продавец для магазина",
      en: "AI Sales Bot for Shops",
      uz: "Do'kon uchun AI-sotuvchi",
      kz: "Дүкен үшін AI-сатушы",
    },
    description: {
      ru: "Каталог товаров, приём заказов через Telegram и управление продажами",
      en: "Product catalog, Telegram order intake, and sales management",
      uz: "Mahsulot katalogi, Telegram orqali buyurtma qabul qilish va savdoni boshqarish",
      kz: "Өнім каталогы, Telegram арқылы тапсырыс қабылдау және сатуды басқару",
    },
    content: {
      ru: `## AI-продавец для магазина

Staffix поддерживает два режима: **запись на услуги** (для салонов, клиник) и **продажа товаров** (для магазинов, ресторанов, цветочных). Режим выбирается автоматически по типу бизнеса, указанному при регистрации.

## Какой тип бизнеса активирует режим продаж?

При регистрации выберите один из типов:
- **Онлайн-торговля** — классический онлайн-магазин
- **Ресторан / Кафе** — продажа блюд, приём заказов
- **Цветочный магазин** — каталог букетов с доставкой
- Любой другой тип с ключевым словом "магазин", "shop", "store"

## Шаг 1: Добавьте товары в каталог

Перейдите в **Дашборд → Каталог**. Для каждого товара укажите:
- Название и описание
- Цена и старая цена (для скидки)
- Категория и теги
- Остаток на складе (или оставьте пустым для неограниченного)
- Фото товара (URL)

Товары автоматически становятся доступны AI-сотруднику. Он сможет искать их, объяснять преимущества и оформлять покупку.

## Шаг 2: Как работает AI-продавец

Когда клиент пишет боту, AI:

1. **Выявляет потребность** — задаёт уточняющие вопросы, узнаёт бюджет и предпочтения
2. **Ищет подходящие товары** — использует поиск по каталогу, фильтрует по категории
3. **Презентует** — объясняет преимущества, сравнивает варианты
4. **Работает с возражениями** — по цене, качеству, срокам доставки
5. **Оформляет заказ** — собирает имя, телефон, адрес доставки, подтверждает заказ
6. **Допродаёт** — предлагает сопутствующие товары после оформления

## Шаг 3: Управление заказами

Перейдите в **Дашборд → Заказы**. Здесь вы видите все заказы с:
- Статусом (Новый → Подтверждён → В обработке → Отправлен → Доставлен)
- Составом и суммой заказа
- Контактами покупателя и адресом

**Смена статуса:** выберите новый статус из выпадающего списка — клиент автоматически получит уведомление в Telegram.

**Оплата:** отметьте заказ как оплаченный кнопкой «Отметить оплаченным».

## Уведомления о новых заказах

Как только клиент оформит заказ, вы получите сообщение в Telegram:

🛒 *Новый заказ #1001*
👤 Иван Петров | +79991234567
📍 г. Алматы, ул. Абая 10, кв. 5
📦 Наушники Sony × 1 = 32 000
💰 *Итого: 32 000*

## Интеграция с CRM

Каждый новый заказ автоматически отправляется в вашу CRM (если настроена в разделе **Интеграции**):
- **Bitrix24** — создаётся лид и контакт
- **AmoCRM** — создаётся сделка
- **Google Sheets** — добавляется строка в таблицу
- **Webhook** — POST-запрос на ваш URL с данными заказа

## Техники продаж AI

AI-продавец применяет 10 профессиональных техник:
- **Активное слушание** — задаёт вопросы перед предложением
- **Ценность перед ценой** — сначала объясняет пользу, потом называет стоимость
- **Дефицит и срочность** — упоминает остатки, если их мало
- **Допродажи** — предлагает сопутствующий товар один раз после оформления
- **Работа с возражениями** — отвечает на "дорого", "подумаю", "не сейчас"`,

      en: `## AI Sales Bot for Shops

Staffix supports two modes: **service booking** (for salons, clinics) and **product sales** (for shops, restaurants, flower stores). The mode is automatically selected based on the business type set during registration.

## Which business types activate sales mode?

During registration, select one of:
- **Online Shop** — classic e-commerce
- **Restaurant / Cafe** — dish sales, order intake
- **Flower Shop** — bouquet catalog with delivery
- Any type with keywords: "shop", "store", "магазин"

## Step 1: Add products to catalog

Go to **Dashboard → Catalog**. For each product, specify:
- Name and description
- Price and old price (for discount display)
- Category and tags
- Stock quantity (leave empty for unlimited)
- Product image URL

Products become immediately available to your AI employee.

## Step 2: How the AI sales bot works

When a client writes to the bot, the AI:

1. **Identifies the need** — asks clarifying questions, learns budget and preferences
2. **Searches products** — uses catalog search, filters by category
3. **Presents** — explains benefits, compares options
4. **Handles objections** — responds to price, quality, delivery concerns
5. **Places order** — collects name, phone, delivery address, confirms order
6. **Upsells** — suggests related products after purchase

## Step 3: Order management

Go to **Dashboard → Orders**. Here you see all orders with:
- Status (New → Confirmed → Processing → Shipped → Delivered)
- Order items and total
- Customer contacts and delivery address

**Status change:** select a new status — the customer automatically receives a Telegram notification.

## New order notifications

When a customer places an order, you receive a Telegram message:

🛒 *New order #1001*
👤 John Smith | +1234567890
📍 123 Main St, City
📦 Sony Headphones × 1 = $350
💰 *Total: $350*

## CRM integration

Each new order is automatically sent to your CRM (if configured in **Integrations**):
- **Bitrix24** — lead and contact created
- **AmoCRM** — deal created
- **Google Sheets** — row added to spreadsheet
- **Webhook** — POST request with order data

## AI sales techniques

The AI salesperson applies 10 professional techniques:
- **Active listening** — asks questions before suggesting
- **Value before price** — explains benefits first, then mentions cost
- **Scarcity & urgency** — mentions low stock when applicable
- **Upselling** — suggests a related product once after purchase
- **Objection handling** — responds to "too expensive", "I'll think about it"`,

      uz: `## Do'kon uchun AI-sotuvchi

Staffix ikki rejimni qo'llab-quvvatlaydi: **xizmatlarga yozish** (salonlar, klinikalar uchun) va **mahsulot sotish** (do'konlar, restoranlar, gul do'konlari uchun). Rejim ro'yxatdan o'tishda ko'rsatilgan biznes turiga qarab avtomatik tanlanadi.

## 1-qadam: Katalogga mahsulot qo'shing

**Boshqaruv paneli → Katalog** bo'limiga o'ting. Har bir mahsulot uchun ko'rsating:
- Nomi va tavsifi
- Narxi va eski narxi (chegirma uchun)
- Kategoriya va teglar
- Ombordagi miqdor (cheksiz uchun bo'sh qoldiring)

## 2-qadam: AI-sotuvchi qanday ishlaydi

Mijoz botga yozganda, AI:

1. **Ehtiyojni aniqlaydi** — aniqlashtiruvchi savollar beradi
2. **Mahsulotlarni qidiradi** — katalog bo'yicha qidiradi
3. **Taqdim etadi** — afzalliklarni tushuntiradi, variantlarni solishtiradi
4. **E'tirozlar bilan ishlaydi** — narx, sifat, yetkazib berish muddati bo'yicha
5. **Buyurtma rasmiylashtiradi** — ism, telefon, yetkazib berish manzili
6. **Qo'shimcha sotadi** — rasmiylashtirish dan keyin qo'shimcha mahsulot taklif qiladi

## 3-qadam: Buyurtmalarni boshqarish

**Boshqaruv paneli → Buyurtmalar** bo'limiga o'ting. Har bir buyurtmada ko'rsatiladi:
- Holat (Yangi → Tasdiqlangan → Yuborilgan → Yetkazilgan)
- Tarkibi va umumiy summasi
- Xaridor kontaktlari va manzil

**Holat o'zgarishi:** yangi holatni tanlang — mijoz Telegram orqali bildirishnoma oladi.

## Yangi buyurtma haqida bildirishnomalar

Mijoz buyurtma berishi bilanoq siz Telegram xabari olasiz:

🛒 *Yangi buyurtma #1001*
👤 Ism Familiya | +998901234567
📦 Mahsulot × 1 = 350 000 so'm
💰 *Jami: 350 000 so'm*`,

      kz: `## Дүкен үшін AI-сатушы

Staffix екі режимді қолдайды: **қызметтерге жазу** (салондар, клиникалар үшін) және **өнім сату** (дүкендер, мейрамханалар, гүл дүкендері үшін). Режим тіркелу кезінде көрсетілген бизнес түріне қарай автоматты түрде таңдалады.

## 1-қадам: Каталогқа өнімдер қосыңыз

**Бақылау тақтасы → Каталог** бөліміне өтіңіз. Әр өнім үшін көрсетіңіз:
- Атауы мен сипаттамасы
- Бағасы және ескі бағасы (жеңілдік үшін)
- Санаты мен тегтері
- Қоймадағы саны (шексіз үшін бос қалдырыңыз)

## 2-қадам: AI-сатушы қалай жұмыс істейді

Клиент ботқа жазғанда, AI:

1. **Қажеттілікті анықтайды** — нақтылайтын сұрақтар қояды
2. **Өнімдерді іздейді** — каталог бойынша іздейді
3. **Таныстырады** — артықшылықтарды түсіндіреді
4. **Қарсылықтармен жұмыс істейді** — баға, сапа бойынша
5. **Тапсырысты рәсімдейді** — аты, телефон, жеткізу мекенжайы
6. **Қосымша сатады** — рәсімдеуден кейін қосымша өнім ұсынады

## 3-қадам: Тапсырыстарды басқару

**Бақылау тақтасы → Тапсырыстар** бөліміне өтіңіз. Әр тапсырыста көрсетіледі:
- Мәртебе (Жаңа → Расталған → Жіберілген → Жеткізілген)
- Құрамы мен жалпы сомасы
- Сатып алушы байланыстары мен мекенжайы

**Мәртебе өзгерісі:** жаңа мәртебені таңдаңыз — клиент Telegram арқылы хабарландыру алады.

## Жаңа тапсырыс туралы хабарландырулар

Клиент тапсырыс бергенде сіз Telegram хабары аласыз:

🛒 *Жаңа тапсырыс #1001*
👤 Аты-жөні | +77001234567
📦 Өнім × 1 = 160 000 тг
💰 *Барлығы: 160 000 тг*`,
    },
  },
];
