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

Staffix — это SaaS-платформа, которая создаёт **AI-сотрудника** для вашего бизнеса. Он работает 24/7 в Telegram, WhatsApp, Instagram и Facebook, общается с клиентами как живой администратор, записывает на приём, оформляет заказы, отправляет напоминания и ведёт CRM.

## Для кого Staffix?

Staffix работает в двух режимах: **сервисный** (запись на услуги) и **продажный** (заказы товаров с доставкой).

**Сервисные бизнесы:**
- Салоны красоты, барбершопы, ногтевые студии
- Медицинские и стоматологические клиники
- Косметологические и эстетические клиники
- Автосервисы и шиномонтажи
- Спа-центры, массажные салоны, фитнес-клубы
- Образовательные центры и репетиторы
- Ветеринарные клиники
- Любой бизнес, работающий по записи

**Продажные бизнесы:**
- Магазины цветов и подарков
- Доставка еды, кофе, продуктов
- Онлайн и розничные магазины
- Оптовые продажи

## Ключевые возможности

**AI-сотрудник 24/7** — Умный AI отвечает за 3 секунды, понимает контекст, использует продвинутые техники продаж (SPIN, Gap Selling, работа с возражениями).

**Мультиканальность** — Один AI работает одновременно в Telegram, WhatsApp, Instagram и Facebook Messenger. Все переписки видны в одном дашборде.

**4 языка** — AI общается на русском, английском, узбекском и казахском. Автоматически подстраивается под язык клиента.

**Онлайн-запись и заказы** — Клиенты записываются на услуги или оформляют заказы через бота. Система проверяет свободное время и наличие товара, исключает дубли.

**Память клиента (AI Memory)** — AI помнит историю каждого клиента: предпочтения, прошлые визиты, важные заметки. Общается персонально.

**Самообучение (AI Learning)** — Если бот ответил неточно, исправьте ответ одной кнопкой — AI запомнит и больше не повторит ошибку.

**Привязка клиента к менеджеру** — Каждый менеджер получает персональную ссылку. Клиент по ней попадает к нему, и все его заказы и уведомления идут именно этому менеджеру. Работает в обоих режимах — продажи и услуги.

**Распределение лидов** — Если у вас команда менеджеров, новый клиент автоматически назначается следующему по очереди или тому у кого меньше нагрузки. Можно отключить и распределять вручную.

**Воронка продаж и Kanban** — Каждый клиент проходит этапы лид → записан → встреча прошла → клиент / не купил. AI двигает по этапам сам когда создаёт бронь или заказ. Можно перетаскивать карточки между колонками.

**Задачи менеджера** — Когда AI передаёт диалог человеку (notify_manager) — автоматически создаётся задача с дедлайном. Менеджер видит свои открытые задачи на главной странице дашборда.

**Кастомные поля клиента** — Добавьте свои поля под ваш бизнес: дата свадьбы, госномер машины, размер обуви — что угодно. AI сам пытается заполнить их из истории диалогов.

**Email-рассылки** — Рассылка не только в Telegram, но и на email. Резеnд + одноклик-отписка по требованию закона.

**Пакеты услуг** — Создавайте комбо со скидкой (стрижка + борода = -10%) или с фиксированной ценой (свадебный комплекс). AI автоматически предлагает их клиентам.

**Несовместимости услуг** — AI учитывает что некоторые услуги нельзя делать сразу (например, массаж после ботокса) и мягко предупреждает клиента.

**Фото и ссылки на товары** — В карточке товара можно загрузить фото и ссылку на сайт магазина. AI отправляет фото и ссылку клиенту вместе с описанием.

**Импорт каталога** — Загрузите товары из Excel, CSV, PDF-каталога или прямо с URL вашего сайта — AI извлечёт товары автоматически.

**Геолокация для доставки** — Клиент отправляет геолокацию в Telegram, Google Maps ссылка приходит менеджеру.

**CRM-система** — База клиентов с историей визитов и заказов, сегментацией (VIP, активные, неактивные), AI-сводкой по каждому клиенту.

**Автоматизации** — Напоминания о визите (за 24ч и 2ч), сбор отзывов после визита, реактивация ушедших клиентов, рассылки по сегментам.

**База знаний** — Загрузите прайсы, FAQ, документы (PDF, DOCX, Excel) — AI будет отвечать на основе ваших данных.

**Аналитика** — Статистика по сообщениям, записям, конверсиям, выручке. Экспорт в CSV.

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

Настройка Staffix занимает 15-20 минут. Следуйте этим шагам:

### Шаг 1. Регистрация

1. Перейдите на staffix.io и нажмите **«Начать бесплатно»**
2. Заполните форму: имя, email, пароль, название бизнеса
3. Выберите режим: **сервисный** (запись на услуги) или **продажный** (заказы товаров)
4. На ваш email придёт **6-значный код подтверждения**
5. Введите код — аккаунт активирован

Вы получаете 14 дней бесплатного доступа ко всем функциям + 100 сообщений AI-сотрудника.

### Шаг 2. Подключение каналов общения

В Staffix можно подключить 4 канала: Telegram, WhatsApp, Instagram и Facebook. Они работают одновременно — AI отвечает в каждом.

**Telegram (рекомендуем начать с него):**
1. Откройте Telegram, найдите **@BotFather**
2. Отправьте **/newbot**, придумайте имя и username бота
3. Получите **токен** — длинную строку вида 123456789:ABCdef...
4. В дашборде → Каналы → Telegram → вставьте токен → «Подключить»

**WhatsApp:**
1. В дашборде → Каналы → WhatsApp → «Подключить через Facebook»
2. Войдите в Facebook (нужен бизнес-аккаунт Meta)
3. Введите номер телефона WhatsApp Business
4. Подтвердите через SMS код

**Instagram и Facebook:**
1. В дашборде → Каналы → Instagram & Facebook
2. Нажмите «Подключить через Facebook»
3. Выберите страницу Facebook и связанный Instagram-аккаунт
4. Подтвердите разрешения

### Шаг 3. Загрузка Базы знаний

База знаний — это всё что AI знает о вашем бизнесе.

1. Перейдите в **База знаний**
2. Добавьте **FAQ** — частые вопросы и ответы
3. Загрузите **документы** — прайсы, правила, описания (PDF, DOCX, Excel, TXT)
4. Чем подробнее данные — тем точнее отвечает AI

### Шаг 4. Услуги (для сервисного режима)

1. Перейдите в **Услуги**
2. Нажмите **«Добавить услугу»**, укажите название, описание, цену, длительность
3. Загрузите CSV/Excel — все услуги добавятся одним кликом
4. Опционально: создайте **пакеты услуг** со скидкой и **правила несовместимости**

### Шаг 4 (альтернатива). Товары (для продажного режима)

1. Перейдите в **Товары**
2. Добавьте товары вручную с фото и ценами
3. Или импортируйте каталог: Excel, CSV, **PDF-каталог** или **прямо с URL** вашего сайта — AI извлечёт товары автоматически
4. Загрузите фото товара (хранится в облаке) или вставьте ссылку
5. Опционально: добавьте ссылку на товар на сайте — бот пришлёт её клиенту

### Шаг 5. Добавление команды

1. Перейдите в **Моя команда**
2. Добавьте сотрудников: имя, должность, фото, Telegram username
3. Настройте расписание смен и отгулы
4. Если у вас 2+ менеджеров — выберите режим распределения лидов (вручную / по очереди / по нагрузке)
5. В продажном режиме каждый продавец получит **персональную ссылку** для своих клиентов

### Шаг 6. Тестирование

1. Откройте вашего бота в Telegram (или Instagram, WhatsApp)
2. Напишите ему как клиент: «Хочу записаться» или «Покажите товары»
3. Проверьте как AI отвечает
4. Если ответ нужно поправить — нажмите кнопку коррекции прямо в чате (AI запомнит)

### Готово

Ваш AI-сотрудник готов к работе. Отправьте ссылку на бота своим клиентам, разместите QR-код в офлайн-точке или подключите к рекламной кампании.`,

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

AI-сотрудник — сердце Staffix. Он общается с клиентами через Telegram, WhatsApp, Instagram и Facebook, отвечает на вопросы, записывает на приём, оформляет заказы и помнит каждого клиента.

### Подключение каналов

Подключите столько каналов сколько нужно — AI работает в каждом одновременно.

**Telegram-бот:**
1. Создайте бота через @BotFather (команда /newbot)
2. Скопируйте токен
3. В дашборде → Каналы → Telegram → вставьте токен → «Активировать»

**WhatsApp Business:**
1. Дашборд → Каналы → WhatsApp → «Подключить через Facebook»
2. Войдите в Facebook (нужен бизнес-аккаунт Meta)
3. Введите номер WhatsApp Business, подтвердите SMS-кодом

**Instagram и Facebook:**
1. Дашборд → Каналы → Instagram & Facebook
2. Подключите через Facebook OAuth, выберите страницу

### Стиль общения

Выберите один из трёх стилей:

- **Дружелюбный** — тёплый, располагающий тон. Подходит для салонов, спа, фитнеса
- **Профессиональный** — деловой, корректный. Подходит для клиник
- **Неформальный** — расслабленный, молодёжный. Подходит для барбершопов, кафе

### Приветственное сообщение

Первое сообщение которое увидит клиент. Например: *«Здравствуйте! Я виртуальный помощник салона "Эстетика". Помогу записаться к мастеру или расскажу про услуги. Чем могу помочь?»*

### Специальные правила

Инструкции для AI которые он будет соблюдать:
- «Всегда упоминай акцию понедельника — скидка 15% на маникюр»
- «Не обсуждай конкурентов»
- «При записи на стрижку предложи пакет стрижка+борода»
- «Цены давай только из каталога, не выдумывай»

### Продвинутые техники продаж

AI владеет 7 техниками продаж и сам их применяет:
- **SPIN-вопросы** — Situation, Problem, Implication, Need-payoff
- **Gap Selling** — показывает разрыв между текущей и желаемой ситуацией
- **Pain Funnel** — мягкое углубление в проблему клиента
- **Социальный калькулятор** — считает выгоду из цифр клиента
- **Микро-обязательства** — ведёт через маленькие «да»
- **Зеркалирование** — повторяет последние слова клиента (техника Криса Восса)
- **Challenger Sale** — обучает клиента полезной информацией

Включаются автоматически — настраивать не нужно.

### Память AI (AI Memory)

AI запоминает каждого клиента:
- Имя, телефон, контакты
- История визитов и заказов
- Предпочтения (любимый мастер, удобное время)
- Важные заметки (аллергии, VIP-статус)
- Тон общения (формальный/дружеский)

При следующем обращении AI узнаёт клиента и общается персонально.

### Самообучение (AI Learning)

Если AI ответил неточно — нажмите кнопку коррекции прямо в чате. AI запомнит правильный ответ и больше не повторит ошибку. Все коррекции учитываются при следующих ответах AI.

### База знаний

AI обучается на ваших документах. Загрузите:
- Прайс-лист (PDF, Word)
- Описание услуг и процедур
- Правила и политики
- FAQ — частые вопросы

Поддерживаемые форматы: PDF, DOC, DOCX, TXT, XLSX, XLS.

### Аватар бота

Установите фото бота через @BotFather:
1. Отправьте /mybots
2. Выберите вашего бота
3. Edit Bot → Edit Botpic
4. Загрузите логотип`,

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

### Главное правило

Telegram-бот может писать сообщение клиенту **только** если клиент сам когда-то нажал /start в боте. Это правило самого Telegram, не ограничение Staffix. Поэтому импортированные клиенты (загруженные из CSV/Excel) сначала должны нажать /start через персональную ссылку — иначе рассылка до них не дойдёт.

В композере под выбором сегмента видна честная цифра: **«Получат сообщение: N из M (только клиенты, написавшие боту /start)»**.

### Создание рассылки

1. Перейдите в раздел **«Рассылки»**
2. Нажмите **«Создать рассылку»**
3. Заполните:
   - **Название** — для вашего удобства (клиенты не видят)
   - **Текст сообщения** — то, что получат клиенты. Можно использовать **{{имя}}** — Staffix подставит имя клиента из CRM.
   - **Сегмент** — кому отправить
   - **Когда отправить** — сейчас или запланировать на дату-время

### Персонализация

В тексте используйте плейсхолдер **{{имя}}** — при отправке Staffix заменит на имя клиента из CRM.

Пример: «Здравствуйте, {{имя}}! Скидка 15% до пятницы.» — Зарина получит «Здравствуйте, Зарина! Скидка 15% до пятницы.»

### Запланированные рассылки

Снимите галочку «Отправить сейчас» → появится поле даты-времени. Рассылка уйдёт автоматически (точность ±5 минут — Staffix проверяет очередь каждые 5 минут).

### Сегменты

- **Все клиенты** — все, кто когда-либо общался с ботом
- **VIP** — клиенты с 5+ визитами
- **Активные** — клиенты с визитами за последние 30 дней
- **Неактивные** — клиенты без визитов больше 30 дней

### Импортированные клиенты — приглашение в бот

Если у клиента в CRM статус «Не подключён к боту» — откройте его карточку, нажмите **«Скопировать ссылку для приглашения»** и отправьте через Telegram, WhatsApp, SMS, Email или Instagram. После клика клиент автоматически привяжется к карточке, и рассылки начнут до него доходить.

### Статистика

- **Отправлено** — Telegram принял запрос
- **Не отправлено** — клиент заблокировал бота или telegramId недействителен
- **В очереди** — для запланированных или больших рассылок

Telegram не сообщает ботам факт прочтения, поэтому отдельной метрики «доставлено клиенту» нет.

### Советы для эффективных рассылок

- Пишите коротко и с пользой для клиента
- Добавляйте конкретные цифры скидок
- Указывайте срок действия акции
- Не рассылайте чаще 2-3 раз в месяц
- Используйте сегменты — VIP-клиентам можно отправить эксклюзивное предложение
- Используйте {{имя}} для персонализации`,

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

Staffix поддерживает несколько каналов для общения с клиентами. Все каналы управляются из раздела **Дашборд → Каналы**.

### Telegram (основной канал)

Telegram — основной и самый полный канал. Подключается через токен @BotFather.

**Что умеет Telegram-бот:**
- Отвечает на вопросы 24/7 с помощью AI
- Записывает на приём (проверяет расписание, исключает конфликты)
- Принимает заказы на товары
- Отправляет напоминания о записях (за 24ч и 2ч)
- Собирает отзывы после визита
- Отправляет массовые рассылки по сегментам клиентов
- Уведомляет о статусе заказа при его изменении

**Как подключить:**
1. Создайте бота через @BotFather → /newbot
2. Скопируйте токен (вида 123456789:ABCdef...)
3. Дашборд → AI-сотрудник → вставьте токен → «Активировать»

**Статистика канала (видна в Каналах):**
- Всего сообщений отправлено
- Клиентов подключено к боту
- Новые лиды за сегодня

### WhatsApp Business (в разработке)

WhatsApp-интеграция через Meta Business API позволит:
- Подключить ваш бизнес-номер WhatsApp к AI-боту
- AI будет отвечать клиентам в WhatsApp так же как в Telegram
- Настраивается в разделе **AI-сотрудник → Настройка WhatsApp**

**Что потребуется:**
- Аккаунт Meta Business
- Phone Number ID из Meta Developers
- Access Token

### Facebook Messenger (в разработке)

Facebook Messenger-интеграция позволит:
- Подключить Facebook-страницу бизнеса
- AI будет отвечать в Messenger как в Telegram
- Клиенты смогут писать через Facebook

### Instagram (в разработке)

Планируемые возможности:
- Авто-ответы в Direct
- Лиды из рекламы (Instagram Ads)
- Ответы на Stories и комментарии

### Единая база клиентов

Все клиенты из всех каналов попадают в единую CRM-систему Staffix. Независимо от того, через какой канал пришёл клиент, его история хранится в разделе **Мои клиенты**.`,

      en: `## Communication Channels

Staffix supports multiple client communication channels, all managed from **Dashboard → Channels**.

### Telegram (Main Channel)

The primary channel with full feature support.

**What the Telegram bot can do:**
- Answer questions 24/7 with AI
- Book appointments (checks schedule, prevents conflicts)
- Accept product orders
- Send appointment reminders (24h and 2h before)
- Collect reviews after visits
- Send mass broadcasts by client segment
- Notify clients about order status changes

**How to connect:**
1. Create a bot via @BotFather → /newbot
2. Copy the token (format: 123456789:ABCdef...)
3. Dashboard → AI Employee → paste token → "Activate"

### WhatsApp Business (in development)

WhatsApp integration via Meta Business API:
- Connect your business WhatsApp number to the AI bot
- AI will respond in WhatsApp just like Telegram
- Requires: Meta Business account, Phone Number ID, Access Token

### Facebook Messenger (in development)

Connect your Facebook business page to receive and respond to Messenger messages via AI.

### Instagram (coming soon)

Auto-replies in Direct, ad leads, Story and comment responses.

### Unified Client Base

All clients from all channels are stored in a single Staffix CRM, visible in the **My Clients** section.`,

      uz: `## Aloqa kanallari

Staffix bir nechta aloqa kanallarini qo'llab-quvvatlaydi.

### Telegram (Asosiy kanal)
To'liq integratsiya: AI xabarlarga 24/7 javob beradi, uchrashuvga yozadi, buyurtmalar qabul qiladi, eslatmalar yuboradi, sharhlar yig'adi.

**Ulash tartibi:**
1. @BotFather orqali bot yarating → /newbot
2. Tokenni nusxa ko'chiring
3. Boshqaruv paneli → AI xodim → tokenni kiriting → "Faollashtirish"

### WhatsApp Business (ishlab chiqilmoqda)
Meta Business API orqali WhatsApp integratsiyasi. Phone Number ID va Access Token talab qilinadi.

### Facebook Messenger (ishlab chiqilmoqda)
Facebook sahifasini ulash orqali Messenger xabarlariga AI javob beradi.

### Barcha kanallar uchun yagona CRM
Barcha kanallardan kelgan mijozlar yagona "Mening mijozlarim" bo'limiga tushadi.`,

      kz: `## Байланыс арналары

Staffix бірнеше байланыс арналарын қолдайды.

### Telegram (Негізгі арна)
Толық интеграция: AI 24/7 хабарларға жауап береді, қабылдауға жазады, тапсырыстар қабылдайды, еске салулар жібереді.

**Қосу тәртібі:**
1. @BotFather арқылы бот жасаңыз → /newbot
2. Токенді көшіріңіз
3. Бақылау тақтасы → AI қызметкер → токенді енгізіңіз → "Белсендіру"

### WhatsApp Business (әзірленуде)
Meta Business API арқылы WhatsApp интеграциясы.

### Facebook Messenger (әзірленуде)
Facebook бетін қосу арқылы AI Messenger хабарларына жауап береді.

### Барлық арналар үшін бірыңғай CRM
Барлық арналардан келген клиенттер "Менің клиенттерім" бөліміне түседі.`,
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

Раздел **«Услуги»** — каталог всех ваших услуг. AI использует этот список, чтобы рассказывать о них клиентам и создавать записи.

### Добавление услуги вручную

1. Перейдите в раздел **«Услуги»** в левом меню
2. Нажмите **«Добавить»**
3. Заполните поля:
   - **Название** — краткое и понятное (например: «Стрижка женская», «Массаж шеи»)
   - **Описание** — что включает услуга, результат, особенности
   - **Цена** — в вашей валюте (числом, без символов)
   - **Длительность** — в минутах (от 5 до 480)
4. Нажмите **«Сохранить»**

### Массовый импорт через CSV

Если у вас много услуг — загрузите их одним файлом CSV:

1. Нажмите **«Импорт CSV»** на странице Услуги
2. Загрузите .csv файл или вставьте текст

**Формат файла (колонки через ; или ,):**
\`\`\`
Название;Цена;Длительность (мин);Описание
Стрижка;5000;30;Классическая стрижка с укладкой
Маникюр;3000;60;Обработка кутикулы и покрытие лаком
Педикюр;4500;90;
\`\`\`

- Первая строка может быть заголовком — будет пропущена автоматически
- Описание необязательно — можно оставить пустым
- Разделитель: точка с запятой (;) или запятая (,)

### Советы по описанию услуг

AI использует описания для ответов клиентам. Чем подробнее — тем лучше:

**Плохо:** «Маникюр»
**Хорошо:** «Классический маникюр — аккуратная обработка кутикулы, придание формы ногтям, покрытие лаком на выбор. Длительность 45 минут. Включает увлажняющий крем для рук.»

**Что писать в описании:**
- Что входит в услугу
- Какой результат получит клиент
- Противопоказания или ограничения
- Рекомендации после процедуры

### Редактирование и удаление

- Нажмите карандаш для редактирования
- Нажмите корзину для удаления
- Изменения сразу отражаются в работе AI-сотрудника

### Пакеты услуг (комбо со скидкой)

В разделе **«Мои пакеты услуг»** можно создавать комбо со скидкой или фиксированной ценой.

**Зачем это нужно:**
- Поднять средний чек («стрижка + борода = -10%»)
- Продавать комплексные программы («свадебный комплекс — 500 000 сум»)
- AI автоматически предлагает пакет если клиент выбирает услугу из него

**Как создать пакет:**
1. Дашборд → Мои пакеты услуг → «Создать пакет»
2. Название (например «Стрижка + Борода»)
3. Выберите услуги из списка
4. Тип скидки:
   - **Скидка %** — процент от суммы услуг
   - **Фиксированная цена** — общая цена за весь пакет
   - **Без скидки** — для группировки услуг без выгоды по цене
5. Включите «AI бот будет предлагать этот пакет автоматически»

**Как работает в чате:**
- Клиент: «Хочу записаться на стрижку»
- AI: «Записываю. Давайте сразу + бороду в пакете — выйдет на 10% дешевле, экономия 10 000 сум»

### Несовместимости услуг

Иногда услуги нельзя делать сразу — например массаж лица после ботокса. Создайте правило, и AI будет предупреждать клиентов.

**Как создать правило:**
1. Мои пакеты услуг → вкладка «Несовместимости» → «Добавить правило»
2. После услуги: ботокс
3. Нельзя делать: массаж лица
4. Период: 5 дней
5. Действует в обе стороны: да/нет
6. Причина (необязательно): «Чтобы препарат не сместился»

**Как работает в чате:**
AI смотрит историю клиента. Если недавно был ботокс и клиент просит массаж лица — AI мягко предупредит и предложит другую дату или альтернативу.`,

      en: `## Service Management

The **"Services"** section is your service catalog. AI uses this list to describe services to clients and create bookings.

### Adding a Service Manually

1. Go to **"Services"** in the left menu
2. Click **"Add"**
3. Fill in:
   - **Name** — short and clear (e.g. "Women's Haircut", "Neck Massage")
   - **Description** — what's included, result, details
   - **Price** — in your currency (number only)
   - **Duration** — in minutes (5 to 480)
4. Click **"Save"**

### Bulk Import via CSV

For many services — upload a CSV file:

1. Click **"Import CSV"** on the Services page
2. Upload a .csv file or paste text

**File format (columns separated by ; or ,):**
\`\`\`
Name;Price;Duration (min);Description
Haircut;20;30;Classic haircut with styling
Manicure;15;60;Cuticle treatment and polish
\`\`\`

- First row can be a header — auto-detected and skipped
- Description is optional
- Delimiter: semicolon (;) or comma (,)

### Description Tips

AI uses descriptions to answer clients. The more detailed — the better.

**Bad:** "Manicure"
**Good:** "Classic manicure — cuticle treatment, nail shaping, polish of choice. 45 minutes. Includes moisturizing hand cream."

### Edit and Delete

- Click ✏️ to edit
- Click 🗑 to delete
- Changes immediately reflect in AI responses`,

      uz: `## Xizmatlarni boshqarish

**"Xizmatlar"** bo'limi — barcha xizmatlaringiz katalogi. AI bu ro'yxatdan mijozlarga javob berish va yozuvlar yaratish uchun foydalanadi.

### Xizmat qo'shish

1. Chap menyudagi **"Xizmatlar"** bo'limiga o'ting
2. **"Qo'shish"** tugmasini bosing
3. To'ldiring: nom, tavsif, narx, davomiylik (daqiqalarda)
4. **"Saqlash"** ni bosing

### CSV orqali ommaviy import

Ko'p xizmat bo'lsa — CSV fayl yuklang:
1. Xizmatlar sahifasidagi **"CSV import"** tugmasini bosing
2. Faylni yuklang yoki matnni joylashtiring

**Format: Nom;Narx;Davomiylik;Tavsif**

### Tavsif bo'yicha maslahatlar

AI javob berish uchun tavsiflardan foydalanadi. Qanchalik batafsil — shunchalik yaxshi.`,

      kz: `## Қызметтерді басқару

**"Қызметтер"** бөлімі — барлық қызметтеріңіздің каталогы. AI бұл тізімді клиенттерге жауап беру және жазбалар жасау үшін пайдаланады.

### Қызмет қосу

1. Сол жақ мәзірдегі **"Қызметтер"** бөліміне өтіңіз
2. **"Қосу"** батырмасын басыңыз
3. Толтырыңыз: атауы, сипаттамасы, бағасы, ұзақтығы (минутпен)
4. **"Сақтау"** батырмасын басыңыз

### CSV арқылы жаппай импорт

Көп қызмет болса — CSV файлды жүктеңіз:
1. Қызметтер бетіндегі **"CSV импорт"** батырмасын басыңыз
2. Файлды жүктеңіз немесе мәтінді қойыңыз

**Формат: Атауы;Бағасы;Ұзақтығы;Сипаттамасы**`,
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

Раздел **«Команда»** подходит для любого типа бизнеса: сотрудники могут быть мастерами (салон, клиника) или менеджерами (магазин, доставка).

### Добавление сотрудника

1. Перейдите в раздел **«Команда»** в левом меню
2. Нажмите **«Добавить»**
3. Заполните форму:
   - **Имя** — полное имя сотрудника
   - **Должность / Специализация** — например: «Стилист», «Косметолог», «Менеджер», «Курьер»
   - **Фото** — рекомендуется (клиенты лучше выбирают мастера по фото), макс. 5 МБ
   - **Telegram** — @username сотрудника (для уведомлений)
4. Нажмите **«Сохранить»**

### Telegram-уведомления для сотрудников

Чтобы сотрудник получал уведомления о новых записях:
1. Укажите его Telegram @username в карточке
2. Сотрудник должен **написать /start** вашему боту
3. После этого статус сменится на «Подключён» (зелёный)

### Расписание сотрудника

Нажмите иконку 📅 на карточке сотрудника:
- Укажите рабочие дни и часы для каждого дня недели
- AI будет предлагать свободные слоты только в рабочее время

### Отпуска и больничные

Нажмите иконку 🛏 на карточке:
- Добавьте период отсутствия (отпуск, больничный, личные обстоятельства)
- В этот период сотрудник не будет доступен для записи

### Зачем добавлять команду?

- AI может предлагать клиентам конкретного специалиста
- Записи привязываются к конкретному сотруднику
- Клиенты могут запросить запись к любимому мастеру
- В аналитике видна загрузка каждого сотрудника
- Сотрудник получает уведомления о своих записях

### Типы бизнеса

| Тип бизнеса | Как называть сотрудников |
|-------------|--------------------------|
| Салон, клиника, спа | Мастер, специалист |
| Магазин, доставка | Менеджер, оператор |
| Ресторан | Официант, администратор |
| Образование | Преподаватель, репетитор |

### Распределение новых лидов между менеджерами

Если у вас 2+ менеджеров — на странице **Моя команда** появится блок «Распределение новых лидов» с тремя режимами:

- **Вручную** — никого не назначаем автоматически. Менеджеры берут лидов сами или через персональные ссылки.
- **По очереди** — каждый новый клиент идёт следующему менеджеру по кругу. Хорошо когда команда одинаково загружена.
- **По нагрузке** — лид идёт тому у кого меньше открытых задач и активных клиентов в воронке. Адаптивно.

Под каждой карточкой сотрудника появляется галочка «Принимает новых лидов» — снимите её на время отпуска или для админа который не работает с клиентами.

### Персональная ссылка для менеджера

Каждый сотрудник получает уникальную ссылку для своих клиентов: \`t.me/ВашБот?start=s_xxxxx\` — работает в обоих режимах (продажи и услуги).

**Как использовать:**
1. В карточке сотрудника нажмите «Копировать ссылку»
2. Передайте ссылку менеджеру
3. Менеджер отправляет её своим клиентам (визитка, WhatsApp, соцсети)
4. Когда клиент по ней попадает в бот — он привязывается к этому менеджеру
5. Все его заказы и уведомления идут конкретному менеджеру

### Ручное переназначение клиента

Есть два способа быстро поменять менеджера для существующего клиента:

**Через таблицу клиентов** (быстро, для нескольких клиентов сразу):
1. Откройте **Клиенты**
2. В таблице есть колонка **«Менеджер»** (видна на больших экранах)
3. В строке нужного клиента — выпадающий список со всеми сотрудниками
4. Выбираете → клиент мгновенно перепривязан

**Через карточку клиента** (детально, для одного клиента):
1. Откройте карточку клиента
2. В блоке «Информация» внизу — выпадашка «Менеджер»
3. Меняете → сохраняется автоматом

Если выбрать «не назначен» — клиент становится общим, любой из команды может с ним работать.

**Примеры использования персональных ссылок:**
- Продавец показывает клиенту QR-код своей ссылки на встрече
- Менеджер салона добавляет ссылку в подпись email
- Бьюти-мастер присылает клиенту в WhatsApp перед визитом

### Удаление сотрудника

Нажмите иконку корзины на карточке → подтвердите удаление. Существующие записи сохраняются.

### Кто из команды что видит в уведомлениях

Уведомления о заказах разделены по ролям, чтобы каждый видел только то что ему нужно для работы:

| Роль | Видит сумму заказа? | Получает уведомление |
|---|---|---|
| Владелец / Админ | ✅ Да | Все заказы |
| Менеджер (продавец) | ✅ Да | Только заказы привязанных к нему клиентов |
| Оператор | ❌ Нет | Уведомления о сборе/доставке без сумм |
| Склад | ❌ Нет | Уведомления о сборе без сумм |

**Логика:** оператор и склад выполняют физическую работу (собрать, упаковать, отправить) — им сумма не нужна. Менеджер ведёт продажи и видит только свой пул клиентов. Админ контролирует весь поток.

Менеджер становится «привязан» к клиенту через персональную реферальную ссылку, ручное назначение в карточке клиента, или автоматическое распределение лидов.`,

      en: `## Team Management

The **"Team"** section works for any business type — staff can be masters (salons, clinics) or managers (shops, delivery).

### Adding a Staff Member

1. Go to **"Team"** in the left menu
2. Click **"Add"**
3. Fill in:
   - **Name** — full name
   - **Role / Specialization** — e.g. "Stylist", "Manager", "Courier"
   - **Photo** — recommended (clients choose better with photos), max 5MB
   - **Telegram** — @username for notifications
4. Click **"Save"**

### Telegram Notifications for Staff

For staff to receive booking notifications:
1. Enter their Telegram @username in the card
2. The staff member must **send /start** to your bot
3. Status will change to "Connected" (green)

### Staff Schedule

Click the 📅 icon on the staff card:
- Set working days and hours for each day of the week
- AI will only offer available slots during working hours

### Time Off / Sick Leave

Click the 🛏 icon:
- Add absence periods (vacation, sick leave, personal)
- Staff won't be available for booking during this time

### Why Add Team Members?
- AI can suggest specific specialists to clients
- Bookings are assigned to specific staff
- Clients can request their favorite specialist
- Analytics show workload per staff member`,

      uz: `## Jamoani boshqarish

**"Jamoa"** bo'limi har qanday biznes turi uchun mos: xodimlar usta (salon, klinika) yoki menejer (do'kon, yetkazib berish) bo'lishi mumkin.

### Xodim qo'shish

1. Chap menyudagi **"Jamoa"** bo'limiga o'ting
2. **"Qo'shish"** tugmasini bosing
3. To'ldiring: ism, lavozim/mutaxassislik, rasm (ixtiyoriy, maks 5MB), Telegram @username
4. **"Saqlash"** ni bosing

### Xodimlar uchun Telegram bildirishnomalari

Xodim yangi yozuvlar haqida bildirishnomalar olishi uchun:
1. Uning Telegram @username'ini kartochkada ko'rsating
2. Xodim botingizga **/start** yozishi kerak
3. Shundan so'ng holat "Ulangan" (yashil) ga o'zgaradi

### Ish jadvali

Kartochkadagi 📅 belgisini bosing — har bir kun uchun ish vaqtini belgilang.

### Ta'til va kasallik

Kartochkadagi 🛏 belgisini bosing — ta'til yoki kasallik davrini qo'shing.`,

      kz: `## Команданы басқару

**"Команда"** бөлімі кез келген бизнес түріне сәйкес: қызметкерлер шебер (салон, клиника) немесе менеджер (дүкен, жеткізу) болуы мүмкін.

### Қызметкер қосу

1. Сол жақ мәзірдегі **"Команда"** бөліміне өтіңіз
2. **"Қосу"** батырмасын басыңыз
3. Толтырыңыз: аты, лауазымы, фотосурет (міндетті емес, макс 5МБ), Telegram @username
4. **"Сақтау"** батырмасын басыңыз

### Қызметкерлер үшін Telegram хабарландырулары

Жаңа жазбалар туралы хабарландыру алу үшін:
1. Карточкада Telegram @username көрсетіңіз
2. Қызметкер ботқа **/start** жіберуі керек
3. Содан кейін мәртебе "Қосылған" (жасыл) болады

### Жұмыс кестесі

Карточкадағы 📅 белгішесін басыңыз — әр күн үшін жұмыс уақытын белгілеңіз.

### Демалыс және ауру

Карточкадағы 🛏 белгішесін басыңыз — демалыс немесе аурухана кезеңін қосыңыз.`,
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

  // ===== 13. BOOKINGS & CALENDAR =====
  {
    id: "bookings",
    icon: "CalendarDays",
    title: {
      ru: "Записи и календарь",
      en: "Bookings & Calendar",
      uz: "Yozuvlar va taqvim",
      kz: "Жазбалар мен күнтізбе",
    },
    description: {
      ru: "Как работает онлайн-запись и управление расписанием",
      en: "How online booking and schedule management work",
      uz: "Onlayn yozuv va jadval boshqaruvi qanday ishlaydi",
      kz: "Онлайн жазылу және кесте басқару қалай жұмыс істейді",
    },
    content: {
      ru: `## Записи и Мой календарь

### Как клиент записывается через бота

1. Клиент пишет боту (например: «Хочу записаться на маникюр»)
2. AI узнаёт предпочтения: услуга, мастер, дата
3. AI проверяет свободные слоты (с учётом расписания мастеров и уже существующих записей)
4. Клиент выбирает удобное время
5. AI создаёт запись и подтверждает клиенту
6. Владелец и мастер получают Telegram-уведомление о новой записи

**Что проверяет AI перед записью:**
- Свободен ли мастер в выбранное время
- Не конфликтует ли запись с другими
- Входит ли выбранное время в рабочие часы мастера

### Раздел «Мои записи»

Перейдите **Дашборд → Записи** чтобы видеть все записи:

- **Предстоящие** — записи на ближайшие дни
- **Сегодня** — записи на текущий день с отметкой времени
- **Прошедшие** — история всех записей
- **Отменённые** — отменённые клиентом или вами

**Фильтры:**
- По мастеру
- По дате
- По статусу

### Раздел «Мой календарь»

Перейдите **Дашборд → Календарь** для визуального отображения:

- **День** — все записи за выбранный день с разбивкой по времени
- **Неделя** — обзор недели
- **Мастера** — колонки по каждому мастеру

**Что видно в календаре:**
- Имя клиента и услуга
- Время начала и конец записи
- Статус (ожидает/подтверждена/отменена)
- Цвет по мастеру (у каждого свой цвет)

### Статусы записей

| Статус | Когда присваивается |
|--------|---------------------|
| Подтверждена | Запись создана через бота |
| Выполнена | Вы отметили как выполненную |
| Отменена | Клиент или вы отменили |

### Как отметить запись выполненной

После того как клиент посетил — найдите запись в Записях и нажмите **«Отметить выполненной»**. Это запускает автоматику: через 2 часа (настраивается) клиент получит запрос на отзыв.

### Уведомления о записях

Владелец получает Telegram-уведомление при каждой новой записи. Содержание:

📅 *Новая запись*
👤 Имя клиента | +71234567890
💇 Услуга — Мастер
🗓 Дата и время

### Напоминания клиентам

AI автоматически напоминает клиентам о записи:
- **За 24 часа** — с кнопками «Подтвердить» / «Отменить»
- **За 2 часа** — финальное напоминание

Включается в разделе **Автоматизация → Напоминания**.`,

      en: `## Bookings & My Calendar

### How Clients Book via Bot

1. Client messages the bot ("I want to book a manicure")
2. AI clarifies: service, master, date
3. AI checks available slots (considering staff schedule and existing bookings)
4. Client selects convenient time
5. AI creates the booking and confirms to client
6. Owner and master receive a Telegram notification

**What AI checks before booking:**
- Is the master free at the selected time
- Does the slot conflict with other bookings
- Is the time within the master's working hours

### "My Bookings" Section

Go to **Dashboard → Bookings** to see all bookings:
- **Upcoming** — bookings for upcoming days
- **Today** — today's bookings with time markers
- **Past** — full booking history
- **Cancelled** — cancelled by client or you

### "My Calendar" Section

Go to **Dashboard → Calendar** for visual display:
- **Day** — all bookings for selected day with time slots
- **Week** — weekly overview
- **Staff** — columns per staff member

### Booking Statuses

| Status | When assigned |
|--------|---------------|
| Confirmed | Booking created via bot |
| Completed | You marked as completed |
| Cancelled | Client or you cancelled |

### Marking a Booking Complete

After a client visits — find the booking in Bookings and click **"Mark as Completed"**. This triggers automation: after 2 hours (configurable) the client receives a review request.

### Client Reminders

AI automatically reminds clients about their booking:
- **24 hours before** — with "Confirm" / "Cancel" buttons
- **2 hours before** — final reminder

Enable in **Automation → Reminders**.`,

      uz: `## Yozuvlar va Mening taqvimim

### Mijoz bot orqali qanday yoziladi

1. Mijoz botga yozadi ("Manikyurga yozilmoqchiman")
2. AI aniqlashtiradi: xizmat, usta, sana
3. AI bo'sh slotlarni tekshiradi (usta jadvali va mavjud yozuvlarni hisobga olib)
4. Mijoz qulay vaqtni tanlaydi
5. AI yozuv yaratadi va mijozga tasdiqlaydi
6. Egasi va usta Telegram bildirishnomasi oladi

### "Mening yozuvlarim" bo'limi

**Boshqaruv paneli → Yozuvlar** ga o'ting:
- Kelgusi, Bugungi, O'tgan va Bekor qilingan yozuvlar

### "Mening taqvimim" bo'limi

**Boshqaruv paneli → Taqvim** ga o'ting:
- Kun, Hafta ko'rinishlari
- Har bir usta uchun ustun

### Yozuv holatlari

| Holat | Qachon belgilanadi |
|-------|---------------------|
| Tasdiqlangan | Bot orqali yaratilgan |
| Bajarilgan | Siz belgilagan |
| Bekor qilingan | Mijoz yoki siz bekor qilgan |

### Mijozlarga eslatmalar

AI avtomatik ravishda eslatmalar yuboradi:
- **24 soat oldin** — "Tasdiqlash" / "Bekor qilish" tugmalari bilan
- **2 soat oldin** — yakuniy eslatma`,

      kz: `## Жазбалар мен Менің күнтізбем

### Клиент бот арқылы қалай жазылады

1. Клиент ботқа жазады ("Маникюрге жазылғым келеді")
2. AI нақтылайды: қызмет, шебер, күн
3. AI бос слоттарды тексереді (шебер кестесі мен бар жазбаларды ескере отырып)
4. Клиент ыңғайлы уақытты таңдайды
5. AI жазба жасайды және клиентке растайды
6. Иесі мен шебер Telegram хабарландырмасын алады

### "Менің жазбаларым" бөлімі

**Бақылау тақтасы → Жазбалар** өтіңіз:
- Алдағы, Бүгінгі, Өткен және Болдырылмаған жазбалар

### "Менің күнтізбем" бөлімі

**Бақылау тақтасы → Күнтізбе** өтіңіз:
- Күн, Апта көрінісі
- Әр шебер үшін баған

### Клиенттерге еске салулар

AI автоматты түрде еске салулар жібереді:
- **24 сағат бұрын** — "Растау" / "Болдырмау" батырмалармен
- **2 сағат бұрын** — соңғы еске салу`,
    },
  },

  // ===== 14. ORDERS =====
  {
    id: "orders",
    icon: "ShoppingBag",
    title: {
      ru: "Заказы",
      en: "Orders",
      uz: "Buyurtmalar",
      kz: "Тапсырыстар",
    },
    description: {
      ru: "Управление заказами интернет-магазина и статусами доставки",
      en: "Managing online store orders and delivery statuses",
      uz: "Onlayn do'kon buyurtmalarini va yetkazib berish holatlarini boshqarish",
      kz: "Онлайн дүкен тапсырыстарын және жеткізу мәртебелерін басқару",
    },
    content: {
      ru: `## Заказы

### Как клиент делает заказ через бота

1. Клиент пишет боту (например: «Хочу купить iPhone 15»)
2. AI-продавец помогает выбрать товар из каталога
3. Уточняет количество, параметры, адрес доставки
4. Запрашивает имя и телефон
5. Создаёт заказ и отправляет клиенту подтверждение
6. Владелец получает Telegram-уведомление о новом заказе

### Раздел «Мои заказы»

Перейдите **Дашборд → Заказы** для управления:

**Карточка заказа содержит:**
- Номер заказа (#1001, #1002...)
- Имя и телефон покупателя
- Состав заказа (товары × количество)
- Сумма заказа
- Адрес доставки (если указан)
- Дату оформления
- Текущий статус и кнопку смены

**Фильтрация по статусу:**
- Все заказы
- Новые (требуют внимания)
- В обработке
- Отправленные
- Доставленные
- Отменённые

### Статусы заказов и уведомления

Когда вы меняете статус заказа — клиент **автоматически получает Telegram-уведомление**:

| Статус | Сообщение клиенту |
|--------|-------------------|
| Подтверждён | ✅ Ваш заказ подтверждён! Мы начинаем обработку. |
| В обработке | ⚙️ Ваш заказ в обработке — идёт сборка. |
| Отправлен | 🚚 Ваш заказ отправлен! Ожидайте доставку. |
| Доставлен | 🎉 Ваш заказ доставлен! Надеемся, всё понравилось. |
| Отменён | ❌ Ваш заказ отменён. Свяжитесь с нами если ошибка. |

### Как изменить статус заказа

1. Откройте заказ в разделе **«Мои заказы»**
2. В выпадающем списке выберите новый статус
3. Клиент мгновенно получит уведомление в Telegram

### Отметить заказ оплаченным

В карточке заказа нажмите **«Отметить оплаченным»** — заказ получит метку ✅ оплачен.

### Уведомления владельцу о новом заказе

При каждом новом заказе вы получаете Telegram-уведомление:

🛒 *Новый заказ #1001*
👤 Иванов Иван | +71234567890
📍 ул. Ленина 15, кв.42
📦 *Состав:*
• iPhone 15 × 1 = 150 000
• Чехол × 2 = 3 000
💰 *Итого: 153 000*
🔗 Управление: staffix.io/dashboard/orders

### Статистика заказов

В верхней части страницы видны карточки:
- **Всего заказов**
- **Новых заказов** (требуют обработки)
- **Выручка** (сумма всех не отменённых заказов)`,

      en: `## Orders

### How Clients Place Orders via Bot

1. Client messages the bot ("I want to buy iPhone 15")
2. AI sales assistant helps choose from the catalog
3. Clarifies quantity, parameters, delivery address
4. Requests name and phone
5. Creates the order and sends confirmation to client
6. Owner receives a Telegram notification about the new order

### "My Orders" Section

Go to **Dashboard → Orders** to manage orders:

**Each order card contains:**
- Order number (#1001, #1002...)
- Buyer's name and phone
- Order items (products × quantity)
- Total amount
- Delivery address (if specified)
- Order date
- Current status with change button

### Order Statuses and Notifications

When you change an order status — the client **automatically receives a Telegram notification**:

| Status | Message to client |
|--------|-------------------|
| Confirmed | ✅ Your order is confirmed! We're starting processing. |
| Processing | ⚙️ Your order is being processed — assembly in progress. |
| Shipped | 🚚 Your order has been shipped! Expect delivery. |
| Delivered | 🎉 Your order has been delivered! Hope you enjoy it. |
| Cancelled | ❌ Your order has been cancelled. Contact us if this is an error. |

### How to Change Order Status

1. Open the order in **"My Orders"**
2. Select the new status from the dropdown
3. Client instantly receives a Telegram notification

### Mark as Paid

In the order card, click **"Mark as Paid"** — the order gets a ✅ paid marker.

### Order Statistics

At the top of the page:
- **Total Orders**
- **New Orders** (requiring processing)
- **Revenue** (sum of all non-cancelled orders)`,

      uz: `## Buyurtmalar

### Mijoz bot orqali qanday buyurtma beradi

1. Mijoz botga yozadi ("iPhone 15 sotib olmoqchiman")
2. AI-sotuvchi katalogdan tanlashga yordam beradi
3. Miqdor, manzil, ism va telefon so'raydi
4. Buyurtma yaratadi va mijozga tasdiqlaydi
5. Egasi Telegram bildirishnomasi oladi

### "Mening buyurtmalarim" bo'limi

**Boshqaruv paneli → Buyurtmalar** ga o'ting.

### Buyurtma holatlari va bildirishnomalar

Siz holatni o'zgartirganda — mijoz **avtomatik Telegram bildirishnomasi oladi**:

| Holat | Mijozga xabar |
|-------|---------------|
| Tasdiqlangan | ✅ Buyurtmangiz tasdiqlandi! |
| Ishlov berilmoqda | ⚙️ Buyurtmangiz ishlov berilmoqda. |
| Yuborildi | 🚚 Buyurtmangiz yuborildi! |
| Yetkazildi | 🎉 Buyurtmangiz yetkazildi! |
| Bekor qilindi | ❌ Buyurtmangiz bekor qilindi. |

### Holat qanday o'zgartiriladi

1. **"Mening buyurtmalarim"** da buyurtmani oching
2. Yangi holatni tanlang
3. Mijoz darhol bildirishnoma oladi`,

      kz: `## Тапсырыстар

### Клиент бот арқылы қалай тапсырыс береді

1. Клиент ботқа жазады ("iPhone 15 сатып алғым келеді")
2. AI-сатушы каталогтан таңдауға көмектеседі
3. Мөлшер, мекенжай, аты-жөні мен телефон сұрайды
4. Тапсырыс жасайды және клиентке растайды
5. Иесі Telegram хабарландырмасын алады

### "Менің тапсырыстарым" бөлімі

**Бақылау тақтасы → Тапсырыстар** өтіңіз.

### Тапсырыс мәртебелері мен хабарландырулар

Мәртебені өзгерткенде — клиент **автоматты Telegram хабарландырмасын алады**:

| Мәртебе | Клиентке хабар |
|---------|----------------|
| Расталды | ✅ Тапсырысыңыз расталды! |
| Өңделуде | ⚙️ Тапсырысыңыз өңделуде. |
| Жіберілді | 🚚 Тапсырысыңыз жіберілді! |
| Жеткізілді | 🎉 Тапсырысыңыз жеткізілді! |
| Болдырылмады | ❌ Тапсырысыңыз болдырылмады. |

### Мәртебені қалай өзгертуге болады

1. **"Менің тапсырыстарым"** бөлімінде тапсырысты ашыңыз
2. Жаңа мәртебені таңдаңыз
3. Клиент бірден хабарландырма алады`,
    },
  },

  // ===== 15. CLIENTS =====
  {
    id: "clients",
    icon: "Users2",
    title: {
      ru: "Мои клиенты",
      en: "My Clients",
      uz: "Mening mijozlarim",
      kz: "Менің клиенттерім",
    },
    description: {
      ru: "CRM-база клиентов, сегментация, история взаимодействий",
      en: "Client CRM database, segmentation, interaction history",
      uz: "Mijozlar CRM bazasi, segmentatsiya, o'zaro aloqalar tarixi",
      kz: "Клиенттер CRM базасы, сегменттеу, өзара әрекет тарихы",
    },
    content: {
      ru: `## Мои клиенты

Раздел **«Мои клиенты»** — это полноценная CRM-система Staffix. Каждый клиент, написавший вашему боту, автоматически сохраняется в базе.

### Как клиенты попадают в базу

- Клиент пишет вашему Telegram-боту → автоматически создаётся карточка
- Бот узнаёт имя и телефон в ходе разговора — данные обновляются
- Данные из других каналов (WhatsApp, Facebook) объединяются в одну карточку

### Что хранится в карточке клиента

- **Имя и телефон** — собираются ботом при первом контакте
- **Telegram ID** — для персональных рассылок
- **Дата первого визита** — когда клиент первый раз обратился
- **Дата последнего визита** — когда был последний контакт
- **Количество визитов** — сколько раз посещал
- **Теги** — метки: VIP, постоянный, проблемный и др.
- **Заметки** — личные заметки менеджера о клиенте
- **История разговоров** — все сообщения с AI-ботом
- **История записей** — все бронирования
- **История заказов** — все покупки (для магазинов)

### Сегментация клиентов

Staffix автоматически сегментирует клиентов:

| Сегмент | Критерий |
|---------|----------|
| **VIP** | Отмечен вручную менеджером |
| **Активный** | Визит за последние 30 дней |
| **Неактивный** | Не было визита 30-90 дней |
| **Потерянный** | Не было визита более 90 дней |

Сегменты используются для:
- Персонализированных рассылок
- Автоматической реактивации
- Специальных предложений

### Поиск и фильтрация

На странице клиентов доступны фильтры:
- По имени или телефону (поиск)
- По сегменту (VIP / Активные / Неактивные)
- По тегу
- По дате последнего визита

### Добавление тегов и заметок

1. Откройте карточку клиента
2. В разделе **«Теги»** добавьте метки (VIP, постоянный, и др.)
3. В разделе **«Заметки»** добавьте личную заметку (видна только вам)

### Экспорт базы клиентов

Нажмите **«Экспорт CSV»** — скачайте всю базу клиентов в формате Excel/CSV.

### Ручная отправка сообщения

Из карточки клиента можно отправить ему персональное сообщение напрямую в Telegram.

### Импортированные клиенты и распознавание в боте

Если у вас в CRM или CSV уже есть база давних клиентов с их скидками/уровнями лояльности — импортируйте их в Staffix и присвойте уровни (Gold/Silver/Platinum) или индивидуальный кэшбек прямо в карточке клиента.

**Как Staffix узнаёт давнего клиента когда он пишет боту:**

1. **При первом контакте в Telegram-боте** AI-продавец просит телефон в формате +998 XX XXX XX XX (или код вашей страны).
2. Получив номер, бот проверяет вашу базу. Если клиент найден — обращается по имени и упоминает статус: «Иван, рад снова вас видеть! У вас наш Gold-уровень — скидка 10% на все заказы.»
3. **Telegram ID клиента автоматически привязывается** к его записи в базе. Все последующие диалоги и заказы идентифицируются мгновенно, без повторных вопросов.

**Если клиент сразу делает заказ, минуя приветствие** — Staffix всё равно найдёт его при создании заказа: lookup идёт по телефону → имени. Скидка применится корректно в любом случае.

**Что попадёт в базу автоматически:**
- При импорте CSV — телефон, имя, теги, любые кастомные поля
- При присвоении уровня в карточке — Bronze / Silver / Gold / Platinum (или ваши кастомные с собственными процентами скидки)
- Индивидуальный кэшбек — задаётся прямо в карточке клиента, перекрывает программный

Это работает для импорта 10 клиентов или 10 000 — алгоритм один и тот же.`,

      en: `## My Clients

The **"My Clients"** section is Staffix's full CRM system. Every client who messages your bot is automatically saved to the database.

### How Clients Get into the Database

- Client messages your Telegram bot → client card is auto-created
- Bot learns name and phone during the conversation → data is updated
- Data from other channels (WhatsApp, Facebook) is merged into one card

### What's Stored in a Client Card

- **Name and phone** — collected by bot on first contact
- **Telegram ID** — for personal broadcasts
- **First visit date** — first contact date
- **Last visit date** — most recent contact
- **Visit count** — how many times they visited
- **Tags** — labels: VIP, regular, etc.
- **Notes** — manager's personal notes about the client
- **Conversation history** — all messages with AI bot
- **Booking history** — all reservations
- **Order history** — all purchases (for stores)

### Client Segmentation

Staffix automatically segments clients:

| Segment | Criteria |
|---------|----------|
| **VIP** | Manually marked by manager |
| **Active** | Visit within last 30 days |
| **Inactive** | No visit for 30-90 days |
| **Lost** | No visit for 90+ days |

Segments are used for: personalized broadcasts, automatic reactivation, special offers.

### Search and Filtering

Available filters on the clients page:
- By name or phone (search)
- By segment (VIP / Active / Inactive)
- By tag
- By last visit date

### Tags and Notes

1. Open the client card
2. In **"Tags"** add labels (VIP, regular, etc.)
3. In **"Notes"** add a personal note (visible only to you)

### Export Client Database

Click **"Export CSV"** to download the full client database in Excel/CSV format.`,

      uz: `## Mening mijozlarim

**"Mening mijozlarim"** bo'limi — Staffix to'liq CRM tizimi. Botingizga yozgan har bir mijoz avtomatik ravishda bazaga saqlanadi.

### Mijozlar bazaga qanday tushadi

- Mijoz Telegram botingizga yozadi → mijoz kartochkasi avtomatik yaratiladi
- Bot suhbat davomida ism va telefon oladi → ma'lumotlar yangilanadi

### Mijoz kartochkasida nima saqlanadi

- Ism va telefon, Telegram ID
- Birinchi va oxirgi tashrif sanasi, tashriflar soni
- Teglar (VIP, doimiy va b.) va izohlar
- Suhbatlar, yozuvlar va buyurtmalar tarixi

### Mijozlarni segmentatsiyalash

| Segment | Mezon |
|---------|-------|
| **VIP** | Menejer tomonidan belgilangan |
| **Faol** | So'nggi 30 kun ichida tashrif |
| **Nofaol** | 30-90 kun tashrif yo'q |
| **Yo'qolgan** | 90+ kun tashrif yo'q |

### CSV eksport

**"CSV eksport"** tugmasini bosib barcha mijozlar bazasini yuklab oling.`,

      kz: `## Менің клиенттерім

**"Менің клиенттерім"** бөлімі — Staffix толық CRM жүйесі. Ботыңызға жазған әр клиент автоматты түрде дерекқорға сақталады.

### Клиенттер дерекқорға қалай түседі

- Клиент Telegram ботыңызға жазады → клиент карточкасы автоматты жасалады
- Бот сөйлесу барысында аты мен телефонды алады → деректер жаңартылады

### Клиент карточкасында не сақталады

- Аты мен телефон, Telegram ID
- Бірінші және соңғы бару күні, бару саны
- Тегтер (VIP, тұрақты т.б.) мен жазбалар
- Сөйлесулер, жазбалар және тапсырыстар тарихы

### Клиенттерді сегменттеу

| Сегмент | Критерий |
|---------|----------|
| **VIP** | Менеджер белгілеген |
| **Белсенді** | Соңғы 30 күнде бару |
| **Белсенді емес** | 30-90 күн бару жоқ |
| **Жоғалған** | 90+ күн бару жоқ |

### CSV экспорт

**"CSV экспорт"** батырмасын басып барлық клиенттер базасын жүктеңіз.`,
    },
  },

  // ===== 16. PRODUCTS =====
  {
    id: "products",
    icon: "Package",
    title: {
      ru: "Товары и каталог",
      en: "Products & Catalog",
      uz: "Mahsulotlar va katalog",
      kz: "Тауарлар мен каталог",
    },
    description: {
      ru: "Добавление товаров, управление каталогом и импорт из CSV",
      en: "Adding products, catalog management and CSV import",
      uz: "Mahsulot qo'shish, katalogni boshqarish va CSV import",
      kz: "Тауар қосу, каталогты басқару және CSV импорт",
    },
    content: {
      ru: `## Товары и каталог

Раздел **«Товары»** используется магазинами, доставками, цветочными салонами и любым бизнесом, продающим конкретные товары. AI-продавец использует каталог для консультации и оформления заказов.

### Добавление товара вручную

1. Перейдите в раздел **«Товары»** в левом меню
2. Нажмите **«Добавить товар»**
3. Заполните:
   - **Название** — понятное, как у покупателей принято
   - **Цена** — актуальная цена продажи
   - **Старая цена** — если есть скидка (бот покажет зачёркнутую цену)
   - **Категория** — для группировки (Электроника, Одежда, Еда...)
   - **Описание** — характеристики, состав, размеры
   - **Артикул (SKU)** — внутренний код товара (необязательно)
   - **Остаток** — количество на складе (пусто = неограниченно)
   - **Теги** — ключевые слова для поиска (через запятую)
4. Нажмите **«Добавить»**

### Массовый импорт через CSV

Для загрузки большого каталога (50, 100, 500 позиций):

1. Нажмите **«Импорт CSV»** на странице Товары
2. Загрузите .csv файл или вставьте текст

**Формат файла (колонки через ; или ,):**
\`\`\`
Название;Цена;Категория;Описание;Остаток;Артикул;Старая цена
iPhone 15;150000;Смартфоны;6.1" дисплей, 48 МП камера;10;IPH15;180000
Samsung S24;130000;Смартфоны;6.2" дисплей, 50 МП камера;5;SS24;
AirPods Pro;45000;Аксессуары;Шумоподавление, Bluetooth 5.3;;APP2;55000
\`\`\`

**Правила:**
- Обязательны только **Название** и **Цена**
- Остальные поля можно оставить пустыми (пропуск между двумя ; или ,)
- Первая строка с заголовками автоматически пропускается
- Старая цена учитывается только если она больше текущей цены

### Управление каталогом

**Активные / Неактивные товары:**
- Включите/выключите переключатель на карточке товара
- Неактивные товары не показываются клиентам через бота

**Редактирование:** нажмите иконку ✏️ на карточке
**Удаление:** нажмите иконку 🗑 (товар скрывается, но остаётся в истории заказов)

### Как AI использует каталог

При обращении клиента AI:
1. Ищет товары по ключевым словам, тегам, категории
2. Показывает до 10 подходящих позиций с ценой
3. По запросу даёт детальное описание конкретного товара
4. Проверяет наличие на складе (если задан остаток)
5. Оформляет заказ с выбранными позициями

### Отображение скидки

Если указана **Старая цена** выше текущей — AI упоминает скидку:
«iPhone 15 сейчас стоит 150 000 (было 180 000) — скидка 17%»

### Фото товара

В карточке товара можно добавить фото двумя способами:
1. **Загрузка файла** — нажмите иконку фото, выберите изображение с компьютера. Сохраняется в облачном хранилище Vercel Blob, бесплатно для большинства бизнесов.
2. **Вставить URL** — если фото уже хостится где-то (Instagram, ваш сайт, Google Drive)

Поддерживаются JPG, PNG, WebP, GIF. Максимальный размер 5 МБ.

**Что делает AI с фото:**
- В Telegram отправляет фото клиенту вместе с описанием товара (через sendPhoto)
- В дашборде показывает миниатюру в списке товаров вместо иконки
- Клиент видит как выглядит товар до покупки → выше конверсия

### Ссылка на товар на сайте

В карточке товара поле **«Ссылка на товар»** — URL страницы товара на вашем сайте магазина.

**Зачем нужно:**
AI отправляет ссылку клиенту вместе с описанием. Клиент может перейти на сайт чтобы посмотреть подробнее, отзывы, дополнительные фото.

Пример сообщения от бота:
*«iPhone 15 Pro, 256GB — 12 500 000 сум. Подробнее: shop.uz/iphone-15-pro»*

### Импорт каталога

Помимо CSV/Excel, в Staffix есть два умных способа импорта:

**Импорт PDF-каталога:**
1. Откройте «Импортировать каталог» → загрузите PDF
2. AI извлечёт товары с ценами автоматически
3. Проверьте превью → импортируйте

**Импорт с URL вашего сайта:**
1. Откройте «Импортировать каталог» → вставьте URL страницы каталога
2. AI зайдёт на сайт, прочитает HTML и извлечёт товары
3. Также извлекает ссылки на каждый товар (поле productUrl)

**Когда использовать что:**
- Excel/CSV — если товары уже структурированы в файле
- PDF — если у вас бумажный каталог или прайс
- URL — если у вас уже есть сайт магазина

### AI-обогащение каталога (автоматически)

После импорта Staffix сам в фоне обрабатывает каждый товар через AI и добавляет:
- Перевод описания на язык вашего бизнеса (если каталог пришёл на английском)
- Транслитерацию названий — для товара «Cleopatra» в теги добавится «клеопатра», чтобы клиент нашёл его написав по-русски
- Морфологические формы категории — «Клей» → «клеи», «клея», «клею»
- Транслит коротких кодов — латинская D → «д», «изгиб д»
- 8-15 поисковых тегов с синонимами и обиходными названиями

**Что вы видите:** на странице **«Товары»** появляется фиолетовая плашка «Каталог обогащается в фоне: X из Y · готово примерно через N часов». Можно закрыть вкладку — обогащение продолжится в фоне на сервере. Скорость: примерно 30 товаров каждые 30 минут.

**Кнопка «Обогатить вручную»** — для нетерпеливых, ускоряет процесс. Минус: вкладка должна быть открыта.

### Поиск товаров: как бот находит позицию

AI-продавец использует три уровня поиска:

1. **Точное совпадение** (название, артикул, теги) — для запросов «есть Cleopatra?», «нужен клей Lovely 5мл».
2. **Поиск по категории** — для обзорных запросов «какие у вас клеи?», «покажите все ресницы Lovely», «весь ассортимент пинцетов». Бот возвращает до 50 товаров категории.
3. **AI-нормализация при опечатках** — если клиент написал «клеопара» вместо «Cleopatra» или «клеев» вместо «Клей», AI фоном проверяет реальные названия в вашем каталоге и переспрашивает: «Возможно, вы имели в виду Cleopatra?»

При общих запросах («нужны ресницы коричневого цвета») бот сначала уточнит конкретику: «У нас есть тёмно-коричневый, шоколадный, тёмно-шоколадный — какой именно?» — и только после ответа покажет варианты.`,

      en: `## Products & Catalog

The **"Products"** section is for stores, delivery services, flower shops, and any business selling specific items. The AI sales assistant uses the catalog to consult clients and create orders.

### Adding a Product Manually

1. Go to **"Products"** in the left menu
2. Click **"Add Product"**
3. Fill in:
   - **Name** — clear and customer-friendly
   - **Price** — current selling price
   - **Old Price** — if there's a discount (bot shows strikethrough price)
   - **Category** — for grouping (Electronics, Clothing, Food...)
   - **Description** — specs, composition, sizes
   - **SKU** — internal product code (optional)
   - **Stock** — quantity available (empty = unlimited)
   - **Tags** — keywords for search (comma-separated)
4. Click **"Add"**

### Bulk Import via CSV

For uploading large catalogs (50, 100, 500+ items):

1. Click **"Import CSV"** on the Products page
2. Upload a .csv file or paste text

**File format (columns separated by ; or ,):**
\`\`\`
Name;Price;Category;Description;Stock;SKU;Old Price
iPhone 15;999;Smartphones;6.1" display, 48MP camera;10;IPH15;1199
Samsung S24;849;Smartphones;6.2" display, 50MP camera;5;SS24;
AirPods Pro;249;Accessories;Noise cancellation, BT 5.3;;APP2;299
\`\`\`

**Rules:**
- Only **Name** and **Price** are required
- Other fields can be left empty (leave blank between two ; or ,)
- Header row is auto-detected and skipped
- Old Price only counts if higher than current price

### Catalog Management

**Active / Inactive products:**
- Toggle the switch on the product card
- Inactive products won't be shown to clients via the bot

**Edit:** click ✏️ on the card
**Delete:** click 🗑 (product is hidden but remains in order history)`,

      uz: `## Mahsulotlar va katalog

**"Mahsulotlar"** bo'limi do'konlar, yetkazib berish xizmatlari va aniq mahsulotlar sotadigan har qanday biznes uchun. AI-sotuvchi mijozlarga maslahat berish va buyurtma rasmiylashtirish uchun katalogdan foydalanadi.

### Mahsulot qo'shish

1. Chap menyudagi **"Mahsulotlar"** bo'limiga o'ting
2. **"Mahsulot qo'shish"** tugmasini bosing
3. To'ldiring: nom, narx, eski narx (chegirma uchun), kategoriya, tavsif, SKU, qoldiq, teglar
4. **"Qo'shish"** ni bosing

### CSV orqali ommaviy import

Katta katalog uchun (50, 100, 500+ pozitsiya):

1. Mahsulotlar sahifasidagi **"CSV import"** tugmasini bosing
2. Faylni yuklang yoki matnni joylashtiring

**Format: Nom;Narx;Kategoriya;Tavsif;Qoldiq;SKU;Eski narx**

Faqat **Nom** va **Narx** majburiy. Qolgan maydonlar bo'sh qolishi mumkin.

### Katalogni boshqarish

Mahsulot kartochkasidagi tugma orqali faol/nofaol qiling.
Nofaol mahsulotlar mijozlarga ko'rsatilmaydi.`,

      kz: `## Тауарлар мен каталог

**"Тауарлар"** бөлімі дүкендер, жеткізу қызметтері және нақты тауарлар сататын кез келген бизнес үшін. AI-сатушы клиенттерге кеңес беру және тапсырыстар жасау үшін каталогты пайдаланады.

### Тауар қосу

1. Сол жақ мәзірдегі **"Тауарлар"** бөліміне өтіңіз
2. **"Тауар қосу"** батырмасын басыңыз
3. Толтырыңыз: атауы, бағасы, ескі бағасы, санаты, сипаттамасы, SKU, қалдық, тегтер
4. **"Қосу"** батырмасын басыңыз

### CSV арқылы жаппай импорт

Үлкен каталог үшін (50, 100, 500+ позиция):

1. Тауарлар бетіндегі **"CSV импорт"** батырмасын басыңыз
2. Файлды жүктеңіз немесе мәтінді қойыңыз

**Формат: Атауы;Бағасы;Санаты;Сипаттамасы;Қалдық;SKU;Ескі баға**

Тек **Атауы** мен **Бағасы** міндетті. Қалған өрістер бос қалуы мүмкін.`,
    },
  },

  // ===== 17. PAYMENTS =====
  {
    id: "payments",
    icon: "CreditCard",
    title: {
      ru: "Оплаты",
      en: "Payments",
      uz: "To'lovlar",
      kz: "Төлемдер",
    },
    description: {
      ru: "Интеграция с Payme и Click для приёма оплат через бота",
      en: "Payme and Click integration for bot payments",
      uz: "Payme va Click integratsiyasi",
      kz: "Payme мен Click интеграциясы",
    },
    content: {
      ru: `## Настройка оплат

Staffix интегрируется с популярными платёжными системами СНГ. После оформления заказа бот автоматически отправляет клиенту кнопки для оплаты.

### Поддерживаемые платёжные системы

| Система | Страна | Тип |
|---------|--------|-----|
| **Payme** | Узбекистан | Карты UzCard, Humo |
| **Click** | Узбекистан | Карты + Click-приложение |

### Настройка Payme

1. Зарегистрируйтесь в **Payme Business** (business.payme.uz)
2. Создайте проект — получите **Merchant ID**
3. В Staffix: Дашборд → AI-сотрудник → Оплаты → раздел Payme
4. Введите **Merchant ID**
5. Нажмите **«Сохранить»**

**Как работает:**
- Клиент делает заказ через бота
- Бот отправляет кнопку «Оплатить через Payme»
- Клиент нажимает → открывается страница оплаты Payme
- После оплаты заказ автоматически отмечается как оплаченный

### Настройка Click

1. Зарегистрируйтесь в **Click Business** (my.click.uz)
2. Получите **Service ID** и **Merchant ID**
3. В Staffix: Дашборд → AI-сотрудник → Оплаты → раздел Click
4. Введите **Service ID** и **Merchant ID**
5. Нажмите **«Сохранить»**

### Как клиент видит оплату

После оформления заказа бот отправляет:
\`\`\`
💳 Оплатите заказ #1001 — 153 000 сум:
[Оплатить через Payme] [Оплатить через Click]
\`\`\`

Клиент нажимает удобную кнопку → переходит на страницу оплаты → возвращается с подтверждением.

### Несколько систем одновременно

Можно подключить обе системы — клиент увидит кнопки всех доступных способов оплаты и выберет удобный.

### Проверка оплаты

В разделе **«Мои заказы»** вручную отметьте заказ как оплаченный (кнопка «Отметить оплаченным»). Автоматическая проверка оплаты требует Webhook-настройки со стороны платёжной системы.`,

      en: `## Payment Setup

Staffix integrates with popular CIS payment systems. After an order is placed, the bot automatically sends the client payment buttons.

### Supported Payment Systems

| System | Country | Type |
|--------|---------|------|
| **Payme** | Uzbekistan | UzCard, Humo cards |
| **Click** | Uzbekistan | Cards + Click app |

### Payme Setup

1. Register at **Payme Business** (business.payme.uz)
2. Create a project — get your **Merchant ID**
3. In Staffix: Dashboard → AI Employee → Payments → Payme section
4. Enter **Merchant ID**
5. Click **"Save"**

### Click Setup

1. Register at **Click Business** (my.click.uz)
2. Get **Service ID** and **Merchant ID**
3. In Staffix: Dashboard → AI Employee → Payments → Click section
4. Enter **Service ID** and **Merchant ID**
5. Click **"Save"**

### Multiple Systems at Once

You can connect both systems — the client will see buttons for all available payment methods and choose the convenient one.`,

      uz: `## To'lovlarni sozlash

Staffix mashhur MDH to'lov tizimlari bilan integratsiya qiladi. Buyurtma rasmiylashtirilgach, bot avtomatik ravishda mijozga to'lov tugmalarini yuboradi.

### Qo'llab-quvvatlanadigan to'lov tizimlari

| Tizim | Mamlakat |
|-------|---------|
| **Payme** | O'zbekiston |
| **Click** | O'zbekiston |

### Payme sozlash

1. **Payme Business** da ro'yxatdan o'ting (business.payme.uz)
2. Loyiha yarating — **Merchant ID** oling
3. Staffix da: Boshqaruv paneli → AI xodim → To'lovlar → Payme
4. **Merchant ID** kiriting → **"Saqlash"**

### Click sozlash

1. **Click Business** da ro'yxatdan o'ting (my.click.uz)
2. **Service ID** va **Merchant ID** oling
3. Staffix da: Boshqaruv paneli → AI xodim → To'lovlar → Click
4. Ma'lumotlarni kiriting → **"Saqlash"**`,

      kz: `## Төлемдерді баптау

Staffix танымал ТМД төлем жүйелерімен интеграцияланады. Тапсырыс рәсімделгеннен кейін бот клиентке автоматты түрде төлем батырмаларын жібереді.

### Қолдау көрсетілетін төлем жүйелері

| Жүйе | Ел |
|------|-----|
| **Payme** | Өзбекстан |
| **Click** | Өзбекстан |

### Payme баптау

1. **Payme Business** тіркеліңіз (business.payme.uz)
2. Жоба жасаңыз — **Merchant ID** алыңыз
3. Staffix: Бақылау тақтасы → AI қызметкер → Төлемдер → Payme
4. **Merchant ID** енгізіңіз → **"Сақтау"**

### Click баптау

1. **Click Business** тіркеліңіз (my.click.uz)
2. **Service ID** мен **Merchant ID** алыңыз
3. Staffix: Бақылау тақтасы → AI қызметкер → Төлемдер → Click
4. Деректерді енгізіңіз → **"Сақтау"**`,
    },
  },

  // ===== 18. NOTIFICATIONS SETUP =====
  {
    id: "notifications-setup",
    icon: "Bell",
    title: {
      ru: "Настройка уведомлений",
      en: "Notification Settings",
      uz: "Bildirishnomalarni sozlash",
      kz: "Хабарландыруларды баптау",
    },
    description: {
      ru: "Telegram-уведомления для владельца и сотрудников, колокольчик в дашборде",
      en: "Telegram notifications for owner and staff, dashboard bell icon",
      uz: "Egasi va xodimlar uchun Telegram bildiriшnomalari",
      kz: "Иесі мен қызметкерлер үшін Telegram хабарландырулары",
    },
    content: {
      ru: `## Настройка уведомлений

Staffix отправляет уведомления в двух местах:
1. **Telegram** — мгновенные уведомления на телефон
2. **Дашборд** — колокольчик 🔔 в правом верхнем углу

### Уведомления в Telegram для владельца

**Что требуется:**
- У вас должен быть подключён Telegram-бот
- Вы должны написать /start вашему собственному боту (один раз)

После этого вы будете получать уведомления о:

| Событие | Сообщение |
|---------|-----------|
| **Новая запись** | Имя клиента, услуга, мастер, дата/время |
| **Отмена записи** | Кто отменил, какая запись |
| **Новый заказ** | Состав, сумма, контакты покупателя |
| **Низкая оценка** | Клиент поставил 1-2 звезды — нужна реакция |
| **Эскалация к менеджеру** | Клиент просит человека — нужна помощь |

### Уведомление о записи (пример)

\`\`\`
📅 Новая запись!

👤 Анна Иванова
📞 +71234567890
💇 Стрижка — Мастер Светлана
🗓 15 февраля 2025, 14:00

Управление: staffix.io/dashboard/bookings
\`\`\`

### Уведомление об эскалации (пример)

Когда клиент задаёт вопрос вне компетенции AI, бот сообщает клиенту, что передаёт вопрос менеджеру, а вам приходит:

\`\`\`
📩 Новый запрос — требуется помощь менеджера

👤 Имя клиента
💬 Вопрос: [описание ситуации]

Клиент ждёт ответа в Telegram
\`\`\`

### Уведомления в Telegram для сотрудников

Каждый мастер/менеджер может получать уведомления о своих записях:

1. Добавьте сотрудника в разделе **«Команда»**
2. Укажите его Telegram @username
3. Сотрудник пишет /start вашему боту
4. Статус сменится на «Подключён» (зелёный)

После этого сотрудник получает уведомления о записях к нему.

### Настройка уведомлений (дашборд → AI-сотрудник)

В разделе настроек бота можно включить/выключить:
- **Уведомления о новых записях** — получать Telegram при каждой записи
- **Уведомления при отмене** — получать Telegram при отмене
- **Уведомления об истечении пробного периода** — за 7/3/1 день до конца

### Уведомления в дашборде (колокольчик 🔔)

В правом верхнем углу дашборда — иконка колокольчика. Число на ней = непрочитанные уведомления.

**Типы уведомлений в дашборде:**
- 📅 Новая запись
- ❌ Отмена записи
- 🛒 Новый заказ
- ⭐ Новый отзыв
- 👤 Новый клиент

Нажмите на уведомление — перейдёте к соответствующему разделу. Нажмите **«Отметить все прочитанными»** для очистки.

### Если уведомления не приходят

1. Убедитесь, что написали /start своему боту
2. Проверьте, что в настройках бота указан ваш Telegram Chat ID
3. Убедитесь, что бот активен (зелёный статус)
4. Проверьте настройки уведомлений Telegram (не заблокированы ли)`,

      en: `## Notification Settings

Staffix sends notifications in two places:
1. **Telegram** — instant phone notifications
2. **Dashboard** — bell icon 🔔 in the top right corner

### Telegram Notifications for Owner

**What's required:**
- You need a connected Telegram bot
- You need to send /start to your own bot (once)

After that you'll receive notifications for:

| Event | Message |
|-------|---------|
| **New booking** | Client name, service, master, date/time |
| **Booking cancellation** | Who cancelled, which booking |
| **New order** | Items, total, buyer contacts |
| **Low rating** | Client gave 1-2 stars — needs attention |
| **Manager escalation** | Client needs human — needs help |

### Staff Telegram Notifications

Each master/manager can receive notifications about their bookings:

1. Add the staff member in the **"Team"** section
2. Enter their Telegram @username
3. Staff member sends /start to your bot
4. Status changes to "Connected" (green)

### Dashboard Bell 🔔

In the top right corner — bell icon with unread count.

**Dashboard notification types:**
- 📅 New booking
- ❌ Booking cancellation
- 🛒 New order
- ⭐ New review
- 👤 New client

Click a notification to go to the relevant section. Click **"Mark all as read"** to clear.`,

      uz: `## Bildirishnomalarni sozlash

Staffix ikki joyda bildirishnomalar yuboradi:
1. **Telegram** — telefonga darhol bildirishnomalar
2. **Boshqaruv paneli** — o'ng yuqori burchakdagi qo'ng'iroq belgisi 🔔

### Egasi uchun Telegram bildiriшnomalari

**Talab qilinadi:**
- Telegram bot ulangan bo'lishi kerak
- Siz o'z botingizga /start yozishingiz kerak (bir marta)

Shundan so'ng quyidagi holatlar haqida bildirishnoma olasiz:

| Hodisa | Xabar |
|--------|-------|
| **Yangi yozuv** | Mijoz ismi, xizmat, usta, sana/vaqt |
| **Yozuv bekor qilish** | Kim bekor qildi, qaysi yozuv |
| **Yangi buyurtma** | Tarkib, summa, xaridor kontaktlari |
| **Past baho** | Mijoz 1-2 yulduz qo'ydi |
| **Menejerga murojaat** | Mijoz odamni so'rayapti |

### Xodimlar uchun Telegram bildiriшnomalari

1. **"Jamoa"** bo'limida xodim qo'shing
2. Telegram @username kiriting
3. Xodim botingizga /start yozadi
4. Holat "Ulangan" (yashil) ga o'zgaradi

### Boshqaruv paneli qo'ng'iroq belgisi 🔔

O'ng yuqori burchakda — o'qilmagan bildirishnomalar soni ko'rsatiladi.`,

      kz: `## Хабарландыруларды баптау

Staffix екі жерде хабарландырулар жібереді:
1. **Telegram** — телефонға жедел хабарландырулар
2. **Бақылау тақтасы** — оң жоғарғы бұрыштағы қоңырау белгішесі 🔔

### Иесі үшін Telegram хабарландырулары

**Талаптар:**
- Telegram боты қосылған болуы керек
- Сіз өз ботыңызға /start жіберуіңіз керек (бір рет)

Содан кейін мына жағдайлар туралы хабарландыру аласыз:

| Оқиға | Хабар |
|-------|-------|
| **Жаңа жазба** | Клиент аты, қызмет, шебер, күн/уақыт |
| **Жазбаны болдырмау** | Кім болдырмады, қандай жазба |
| **Жаңа тапсырыс** | Құрамы, сомасы, сатып алушы байланыстары |
| **Төмен баға** | Клиент 1-2 жұлдыз қойды |
| **Менеджерге эскалация** | Клиент адам сұрап жатыр |

### Қызметкерлер үшін Telegram хабарландырулары

1. **"Команда"** бөлімінде қызметкер қосыңыз
2. Telegram @username енгізіңіз
3. Қызметкер ботыңызға /start жібереді
4. Мәртебе "Қосылған" (жасыл) болады`,
    },
  },

  // ===== 19. FILE UPLOADS =====
  {
    id: "file-uploads",
    icon: "FileUp",
    title: {
      ru: "Загрузка файлов",
      en: "File Uploads",
      uz: "Fayl yuklash",
      kz: "Файлдарды жүктеу",
    },
    description: {
      ru: "Требования к файлам, форматы, база знаний и CSV-импорт",
      en: "File requirements, formats, knowledge base and CSV import",
      uz: "Fayl talablari, formatlar, bilimlar bazasi va CSV import",
      kz: "Файл талаптары, форматтар, білім базасы және CSV импорт",
    },
    content: {
      ru: `## Загрузка файлов в Staffix

В Staffix можно загружать файлы в нескольких разделах с разными целями.

### 1. База знаний — документы для AI

**Где:** Дашборд → База знаний → кнопка «Загрузить файл»

**Поддерживаемые форматы:**

| Формат | Расширение | Макс. размер |
|--------|-----------|-------------|
| PDF | .pdf | 10 МБ |
| Word | .doc, .docx | 10 МБ |
| Excel | .xls, .xlsx | 10 МБ |
| Текст | .txt | 5 МБ |
| Изображение | .jpg, .png | 5 МБ |

**Что можно загружать:**
- Прайс-листы и каталоги
- FAQ и ответы на частые вопросы
- Правила и условия обслуживания
- Описания услуг и продуктов
- Сертификаты и лицензии
- Инструкции и руководства

**Как AI использует документы:**
После загрузки AI извлекает текст из документа и использует его при ответах клиентам. Если клиент спросит о чём-то, что есть в документе — AI ответит на основе этой информации.

**Рекомендации:**
- Используйте понятные названия файлов (прайс_2025.pdf, а не doc1.pdf)
- Разделяйте документы по темам (услуги, цены, правила)
- Регулярно обновляйте файлы при изменении информации

### 2. Фото сотрудников

**Где:** Дашборд → Команда → карточка сотрудника → иконка камеры

**Требования:**
- Форматы: .jpg, .jpeg, .png, .webp
- Максимальный размер: **5 МБ**
- Рекомендуемый размер: 200×200 пикселей и выше (квадрат)
- Лицо сотрудника должно быть чётко видно

### 3. Логотип бизнеса

**Где:** Дашборд → AI-сотрудник → Общие настройки → «Загрузить логотип»

**Требования:**
- Форматы: .jpg, .jpeg, .png, .webp, .svg
- Максимальный размер: **5 МБ**
- Рекомендуется квадратное изображение
- Минимальное разрешение: 100×100 пикселей

### 4. CSV-импорт услуг

**Где:** Дашборд → Услуги → кнопка «Импорт CSV»

**Требования к файлу:**
- Расширение: .csv или .txt
- Кодировка: UTF-8 (без BOM)
- Разделитель: точка с запятой (;) или запятая (,)
- Первая строка: заголовок (необязательно, определяется автоматически)

**Структура столбцов:**
\`\`\`
Название;Цена;Длительность (мин);Описание
Стрижка;5000;30;Классическая стрижка с укладкой
Маникюр;3000;60;
\`\`\`

### 5. CSV-импорт товаров

**Где:** Дашборд → Товары → кнопка «Импорт CSV»

**Структура столбцов:**
\`\`\`
Название;Цена;Категория;Описание;Остаток;Артикул;Старая цена
iPhone 15;150000;Смартфоны;6.1" дисплей;10;IPH15;180000
\`\`\`

Минимально обязательны только первые 2 столбца (Название и Цена).

### Общие правила загрузки

- Все файлы хранятся в защищённом облачном хранилище
- Удалённые файлы не восстанавливаются
- Персональные данные клиентов в файлах обрабатываются согласно политике конфиденциальности
- При проблемах с загрузкой — проверьте формат и размер файла`,

      en: `## File Uploads in Staffix

Files can be uploaded in several sections for different purposes.

### 1. Knowledge Base — Documents for AI

**Where:** Dashboard → Knowledge Base → "Upload File" button

**Supported formats:**

| Format | Extension | Max size |
|--------|-----------|----------|
| PDF | .pdf | 10 MB |
| Word | .doc, .docx | 10 MB |
| Excel | .xls, .xlsx | 10 MB |
| Text | .txt | 5 MB |
| Image | .jpg, .png | 5 MB |

**What to upload:**
- Price lists and catalogs
- FAQ and common answers
- Service rules and terms
- Product and service descriptions
- Certificates and licenses

**How AI uses documents:**
After uploading, AI extracts text from the document and uses it when answering clients. If a client asks about something in the document — AI will answer based on that information.

### 2. Staff Photos

**Where:** Dashboard → Team → staff card → camera icon

**Requirements:**
- Formats: .jpg, .jpeg, .png, .webp
- Max size: **5 MB**
- Recommended: 200×200 pixels or larger (square)

### 3. Business Logo

**Where:** Dashboard → AI Employee → General Settings → "Upload Logo"

**Requirements:**
- Formats: .jpg, .jpeg, .png, .webp, .svg
- Max size: **5 MB**
- Square image recommended
- Min resolution: 100×100 pixels

### 4. CSV Import for Services

**Where:** Dashboard → Services → "Import CSV" button

**File requirements:**
- Extension: .csv or .txt
- Encoding: UTF-8
- Delimiter: semicolon (;) or comma (,)

**Column structure:**
\`\`\`
Name;Price;Duration (min);Description
Haircut;20;30;Classic haircut with styling
Manicure;15;60;
\`\`\`

### 5. CSV Import for Products

**Where:** Dashboard → Products → "Import CSV" button

**Column structure:**
\`\`\`
Name;Price;Category;Description;Stock;SKU;Old Price
iPhone 15;999;Smartphones;6.1" display;10;IPH15;1199
\`\`\`

Only the first 2 columns (Name and Price) are required.`,

      uz: `## Staffix da fayl yuklash

### 1. Bilimlar bazasi — AI uchun hujjatlar

**Qayerda:** Boshqaruv paneli → Bilimlar bazasi → "Fayl yuklash" tugmasi

**Qo'llab-quvvatlanadigan formatlar:**
- PDF (.pdf) — maks. 10 MB
- Word (.doc, .docx) — maks. 10 MB
- Excel (.xls, .xlsx) — maks. 10 MB
- Matn (.txt) — maks. 5 MB
- Rasm (.jpg, .png) — maks. 5 MB

**Nima yuklash mumkin:**
Narxlar, FAQ, xizmat shartlari, mahsulot tavsiflari, sertifikatlar.

### 2. Xodimlar rasmlari

**Qayerda:** Boshqaruv paneli → Jamoa → xodim kartochkasi → kamera belgisi

**Talablar:** .jpg, .png, .webp — maks. 5 MB

### 3. Biznes logotipi

**Qayerda:** Boshqaruv paneli → AI xodim → Umumiy sozlamalar

**Talablar:** .jpg, .png, .svg — maks. 5 MB

### 4. Xizmatlar uchun CSV import

**Format:** Nom;Narx;Davomiylik;Tavsif
Faqat Nom va Narx majburiy.

### 5. Mahsulotlar uchun CSV import

**Format:** Nom;Narx;Kategoriya;Tavsif;Qoldiq;SKU;Eski narx
Faqat Nom va Narx majburiy.`,

      kz: `## Staffix-те файлдарды жүктеу

### 1. Білім базасы — AI үшін құжаттар

**Қайда:** Бақылау тақтасы → Білім базасы → "Файл жүктеу" батырмасы

**Қолдау көрсетілетін форматтар:**
- PDF (.pdf) — макс. 10 МБ
- Word (.doc, .docx) — макс. 10 МБ
- Excel (.xls, .xlsx) — макс. 10 МБ
- Мәтін (.txt) — макс. 5 МБ
- Сурет (.jpg, .png) — макс. 5 МБ

**Не жүктеуге болады:**
Баға тізімдері, FAQ, қызмет шарттары, өнім сипаттамалары, сертификаттар.

### 2. Қызметкерлер суреттері

**Қайда:** Бақылау тақтасы → Команда → қызметкер карточкасы → камера белгішесі

**Талаптар:** .jpg, .png, .webp — макс. 5 МБ

### 3. Бизнес логотипі

**Қайда:** Бақылау тақтасы → AI қызметкер → Жалпы баптаулар

**Талаптар:** .jpg, .png, .svg — макс. 5 МБ

### 4. Қызметтер үшін CSV импорт

**Формат:** Атауы;Бағасы;Ұзақтығы;Сипаттамасы
Тек Атауы мен Бағасы міндетті.

### 5. Тауарлар үшін CSV импорт

**Формат:** Атауы;Бағасы;Санаты;Сипаттамасы;Қалдық;SKU;Ескі баға
Тек Атауы мен Бағасы міндетті.`,
    },
  },

  // ===== 20. DEAL PIPELINE / KANBAN =====
  {
    id: "deal-pipeline",
    icon: "TrendingUp",
    title: {
      ru: "Воронка продаж и Kanban",
      en: "Sales Funnel and Kanban",
      uz: "Sotuv voronkasi va Kanban",
      kz: "Сату воронкасы және Kanban",
    },
    description: {
      ru: "5 этапов сделки + автоматическое движение по AI",
      en: "5 deal stages + automatic AI-driven progression",
      uz: "5 bitim bosqichi + avtomatik AI harakati",
      kz: "5 мәміле кезеңі + автоматты AI қозғалысы",
    },
    content: {
      ru: `## Воронка продаж и Kanban-вид

Каждый клиент в Staffix проходит **5 этапов**:

1. **Лид** — новый клиент, ещё ничего не сделал
2. **Записан** — записан на встречу/консультацию/визит
3. **Встреча прошла** — встреча состоялась, ждём решение
4. **Клиент** — стал платящим клиентом (купил/заказал)
5. **Не купил** — отказался / не вышел / не подошло

### Как двигается этап

**AI двигает автоматически:**
- AI создал бронирование → стадия становится «Записан»
- Бронь завершена (статус completed) → «Встреча прошла»
- AI оформил заказ → «Клиент» + сумма заказа в поле «Сумма сделки»

**Менеджер двигает руками:**
- В таблице клиентов — выпадашка прямо в строке
- В карточке клиента — выпадашка в блоке «Воронка»
- В Kanban-виде — перетаскиванием карточки между колонками

**Правило:** этап только идёт вперёд. Если клиент уже на стадии «Клиент», новое бронирование НЕ откатит его назад в «Записан». «Не купил» — терминал, AI не двигает оттуда.

### Kanban-вид

В **Клиенты** есть переключатель «Таблица / Воронка». Воронка показывает 5 колонок, в каждой — карточки клиентов. Перетащите карточку → этап изменится. При перетаскивании в «Клиент» — попросит ввести сумму сделки. При «Не купил» — попросит причину.

### Аналитика воронки

В **Статистика** внизу страницы — блок «Воронка продаж» с конверсией между этапами и суммой выручки за период. Конверсия лид → клиент крупным зелёным процентом — главный KPI бизнеса.`,
      en: `## Sales Funnel & Kanban

Every client in Staffix moves through **5 stages**:

1. **Lead** — new client, hasn't done anything yet
2. **Booked** — has an appointment/consultation/visit
3. **Met** — meeting happened, waiting for decision
4. **Customer** — paying customer (booked or ordered)
5. **Lost** — refused / no-show / didn't fit

### Stage movement

**AI auto-moves:**
- AI creates a booking → stage becomes "Booked"
- Booking marked completed → "Met"
- AI creates an order → "Customer" + order total in "Deal Value"

**Manager moves manually:**
- Customer table — dropdown in the row
- Customer detail page — dropdown in the funnel block
- Kanban view — drag the card between columns

**Rule:** stage only moves forward. Once a client is "Customer", a new booking won't roll them back to "Booked". "Lost" is terminal — AI never moves out of it.

### Kanban view

On **Customers** there's a Table / Funnel toggle. Funnel shows 5 columns of client cards. Drag a card to change stage. Dropping on "Customer" prompts for deal amount; "Lost" prompts for reason.

### Funnel analytics

On **Statistics** there's a Sales Funnel block with stage-to-stage conversion and total closed-deal revenue for the period. The lead-to-customer percentage is the headline KPI.`,
      uz: `## Sotuv voronkasi va Kanban

Har bir mijoz **5 bosqichdan** o'tadi: Lid → Yozilgan → Uchrashuv o'tdi → Mijoz / Sotib olmadi.

AI buyurtma yoki bron yaratganda bosqichni avtomatik ko'taradi. Menejer Kanban'da kartochkani sudrab bosqichni qo'lda o'zgartira oladi.

Statistikada — voronka analitikasi: bosqichlar orasidagi konversiya va davr uchun yopilgan bitimlar daromadi.`,
      kz: `## Сату воронкасы және Kanban

Әр клиент **5 кезеңнен** өтеді: Лид → Жазылған → Кездесу өтті → Клиент / Сатып алмады.

AI тапсырыс немесе бронь жасаған кезде кезеңді автоматты түрде көтереді. Менеджер Kanban'да карточканы сүйреп ауыстыра алады.

Статистикада — воронка аналитикасы: кезеңдер арасындағы конверсия және кезеңдегі жабылған мәмілелердің кірісі.`,
    },
  },

  // ===== 21. TASKS =====
  {
    id: "tasks",
    icon: "ListTodo",
    title: {
      ru: "Задачи менеджера",
      en: "Manager Tasks",
      uz: "Menejer vazifalari",
      kz: "Менеджер тапсырмалары",
    },
    description: {
      ru: "Список дел на день — ручные + AI создаёт сам",
      en: "Daily todo list — manual + AI auto-created",
      uz: "Kunlik vazifalar — qo'lda + AI",
      kz: "Күндік тапсырмалар — қолмен + AI",
    },
    content: {
      ru: `## Задачи менеджера

На главной странице дашборда виджет **«Мои задачи»** — открытые задачи, отсортированные по дедлайну.

### Как создаются задачи

**Автоматически — AI**
Когда AI решает что разговор требует человека (сложный вопрос, клиент явно просит человека, нестандартное решение), он:
1. Уведомляет владельца в Telegram (как раньше)
2. Создаёт задачу в дашборде с заголовком «Связаться с клиентом: <имя>»
3. Если клиент срочный — приоритет «Высокий», дедлайн +30 мин. Иначе — дедлайн +4 часа.
4. Задача привязывается к клиенту → клик на имя ведёт в его карточку
5. Если у клиента уже назначен менеджер — задача уходит ему. Иначе — общая.

**Вручную**
Через API \`POST /api/tasks\` — пока без UI кнопки «Создать», добавим в следующей итерации если нужно.

### Как закрыть задачу

Кликните на круг слева от задачи — она пропадает из виджета (статус «Выполнена»). Откатить через API.

### Где смотреть все задачи

Виджет показывает топ-10 открытых. Полная страница со всеми задачами и фильтрами — следующая итерация.`,
      en: `## Manager Tasks

The dashboard home page has a **"My Tasks"** widget — open tasks sorted by due date.

### How tasks are created

**Automatically by AI** — when AI hands a conversation to a human (complex question, client asks for a person, unusual case), it now:
1. Pings the owner in Telegram (as before)
2. Creates a dashboard task titled "Contact client: <name>"
3. Urgent → high priority, due in 30 min. Otherwise — due in 4 hours.
4. Linked to the client; click name to open their card
5. Inherits the client's assigned manager if any

**Manually** — via API \`POST /api/tasks\` for now; UI Create button comes later.

### Marking a task done

Click the circle on the left → it disappears (status "done"). Reversible via API.`,
      uz: `## Menejer vazifalari

Bosh sahifada **"Mening vazifalarim"** vidjeti — muddati bo'yicha tartiblangan ochiq vazifalar. AI suhbatni odamga uzatganda (notify_manager) avtomatik vazifa yaratiladi.

Vazifani bajarilgan deb belgilash — chap tomondagi doiraga bosing.`,
      kz: `## Менеджер тапсырмалары

Басты бетте **«Менің тапсырмаларым»** виджеті — мерзімі бойынша сұрыпталған ашық тапсырмалар. AI әңгімені адамға бергенде (notify_manager) тапсырма автоматты түрде жасалады.

Тапсырманы орындалды деп белгілеу — сол жақтағы шеңберге басыңыз.`,
    },
  },

  // ===== 22. CSV EXPORT =====
  {
    id: "csv-export",
    icon: "Download",
    title: {
      ru: "Экспорт в CSV",
      en: "CSV Export",
      uz: "CSV eksport",
      kz: "CSV экспорт",
    },
    description: {
      ru: "Скачивание клиентов и заказов в Excel",
      en: "Download clients and orders to Excel",
      uz: "Mijozlar va buyurtmalarni Excel'ga yuklab olish",
      kz: "Клиенттер мен тапсырыстарды Excel'ге жүктеу",
    },
    content: {
      ru: `## Экспорт в CSV

На страницах **Клиенты** и **Заказы** есть кнопка «Экспорт CSV». Скачивает текущий список с применёнными фильтрами.

### Что попадает в файл

**Клиенты:** имя, телефон, email, теги, стадия сделки, сумма сделки, заметка, посещения, бонусные баллы, важные заметки + все ваши кастомные поля.

**Заказы:** номер, дата, статус, клиент, телефон, канал, адрес доставки, позиции, сумма, способ оплаты, продавец, заметки.

### Технически

- Кодировка UTF-8 с BOM — Excel и Google Sheets открывают кириллицу без танцев с бубном
- Имя файла включает дату и название бизнеса
- Лимит 10 000 строк за раз — для больших баз нужно фильтровать

### Зачем

- Бухгалтер просит выгрузку клиентов
- Сделать отчёт за месяц для собственника
- Импортировать клиентов в другую систему (amoCRM/Bitrix)
- Личный backup`,
      en: `## CSV Export

The Customers and Orders pages have an "Export CSV" button. Downloads the current list with active filters applied. UTF-8 with BOM so Excel reads Cyrillic correctly. Up to 10,000 rows per request.

Customers include all custom fields you've defined. Orders concatenate items into one cell so each order stays one row.`,
      uz: `## CSV eksport

Mijozlar va Buyurtmalar sahifalarida "CSV eksport" tugmasi. Joriy filtr bo'yicha ro'yxatni yuklab oladi. Excel uchun UTF-8 BOM bilan.`,
      kz: `## CSV экспорт

Клиенттер және Тапсырыстар беттерінде «CSV экспорт» түймесі. Ағымдағы сүзгі бойынша тізімді жүктеп алады. Excel үшін UTF-8 BOM-мен.`,
    },
  },

  // ===== 23. CUSTOM FIELDS =====
  {
    id: "custom-fields",
    icon: "ListPlus",
    title: {
      ru: "Кастомные поля клиента",
      en: "Custom Client Fields",
      uz: "Mijozning maxsus maydonlari",
      kz: "Клиенттің арнайы өрістері",
    },
    description: {
      ru: "Свои поля под ваш бизнес — AI заполняет сам",
      en: "Your own fields — AI fills them in",
      uz: "O'z maydonlaringiz — AI to'ldiradi",
      kz: "Өзіңіздің өрістеріңіз — AI толтырады",
    },
    content: {
      ru: `## Кастомные поля клиента

Стандартный набор полей в карточке клиента (имя, телефон, email и т.д.) подходит большинству бизнесов. Но иногда нужно что-то своё — дата свадьбы, госномер машины, размер ноги, любимая услуга.

### Как создать своё поле

1. Дашборд → **Настройки → Профиль** → блок «Дополнительные поля клиента»
2. Кнопка «Добавить поле» → введите название («Дата свадьбы») и выберите тип:
   - **Текст** — короткая строка
   - **Число** — целое или дробное число
   - **Дата** — дата в формате YYYY-MM-DD
   - **Выбор из списка** — варианты через запятую («Реклама, Знакомые, Соцсети»)
3. Сохраните — поле появится в карточке каждого клиента.

Лимит: 20 полей на бизнес.

### Кто заполняет

**Менеджер** — вручную в карточке клиента. Изменения сохраняются автоматически при выходе из поля.

**AI — сам, из истории диалогов** — раз в 2 часа крон-задача читает диалоги клиента и пытается извлечь значения для пустых полей. Например, если клиент написал «у нас свадьба 15 сентября» — AI заполнит «Дата свадьбы».

**Важно:** AI **не перезаписывает** поля которые менеджер уже заполнил руками. Только пустые.

### Где видны кастомные поля

- В карточке клиента (\`/dashboard/customers/[id]\`) — блок «Дополнительно»
- В CSV-экспорте клиентов — отдельные колонки в конце файла
- При следующих итерациях добавим: фильтрация в списке клиентов, использование в рассылках

### Что произойдёт если удалить поле

Данные клиентов **не пропадают** из БД — просто перестают отображаться в UI. Восстановить — вернуть определение поля с тем же ключом, и значения снова появятся.`,
      en: `## Custom Client Fields

The standard fields (name, phone, email, etc.) cover most businesses. For anything else — wedding date, license plate, shoe size — define your own fields.

**Create:** Settings → Profile → "Custom client fields" → Add field with label and type (text / number / date / select).

**Filled by:**
- Manager — manually in the client card
- AI — every 2 hours the summarize cron reads conversation history and extracts values for empty fields. AI never overwrites manual entries.

Limit: 20 fields per business. Removed fields keep their data in the DB and reappear if restored.

Visible in: client detail page + CSV export columns.`,
      uz: `## Mijozning maxsus maydonlari

Standart maydonlar yetmasa — Sozlamalar → Profil → "Mijoz qo'shimcha maydonlari"da o'zingizniki yarating: matn, raqam, sana yoki tanlov turi.

Menejer qo'lda yoki AI har 2 soatda diologlardan avtomatik to'ldiradi (faqat bo'sh maydonlarni). Maksimum 20 maydon. Mijoz kartochkasi va CSV eksportda ko'rinadi.`,
      kz: `## Клиенттің арнайы өрістері

Стандартты өрістер жетпесе — Баптаулар → Профиль → «Клиенттің қосымша өрістері»де өзіңіздікін жасаңыз: мәтін, сан, күн немесе таңдау түрі.

Менеджер қолмен немесе AI әр 2 сағат сайын диалогтардан автоматты түрде толтырады (тек бос өрістерді). Максимум 20 өріс. Клиент картасы мен CSV экспортында көрінеді.`,
    },
  },

  // ===== 24. EMAIL BROADCASTS =====
  {
    id: "email-broadcasts",
    icon: "Mail",
    title: {
      ru: "Email-рассылки",
      en: "Email Broadcasts",
      uz: "Email yuborish",
      kz: "Email жіберу",
    },
    description: {
      ru: "Рассылки не только в Telegram, но и на email",
      en: "Broadcasts via email, not just Telegram",
      uz: "Email orqali yuborishlar",
      kz: "Email арқылы жіберулер",
    },
    content: {
      ru: `## Email-рассылки

Раньше рассылки шли только в Telegram. Теперь можно слать на email — для бизнесов с email-базой (онлайн-школы, B2B, консалтинг).

### Как сделать

1. **Рассылки → Создать** → введите тему и текст
2. Выберите канал: **Telegram / Email / Оба**
3. Выберите сегмент (все / VIP / активные / неактивные)
4. Отправить сейчас или запланировать

### Кто получит email

- У клиента указан email в карточке (импортирован из CSV или AI извлёк)
- Клиент не отписался от рассылок (нажал «Отписаться» в предыдущем письме)
- Клиент не заблокирован

Если выбрали **Оба** — клиенты с Telegram получат в Telegram, без Telegram но с email — на почту.

### Отписка

Каждое email-письмо содержит обязательную ссылку **«Отписаться»** (требование Resend и почтовых клиентов). Клиент жмёт → попадает на страницу подтверждения → перестаёт получать email-рассылки. Telegram-канал не затрагивается.

Также Gmail и Apple Mail показывают встроенную кнопку Unsubscribe в шапке письма — это работает.

### Что нужно проверить до запуска

- В **Resend dashboard** домен \`staffix.io\` должен быть верифицирован (DNS-записи SPF / DKIM / DMARC). Без этого письма уйдут в спам.
- В рассылку попадают только **существующие клиенты** (которые уже что-то у вас покупали или общались). Холодные базы — отдельная история, требует юридических согласий.

### Технически

- Шапка письма: имя вашего бизнеса, тело: текст с переносами строк
- {{имя}} в тексте подставит имя клиента
- Лимит Resend: 100 писем/секунду — для больших списков шлём порциями`,
      en: `## Email Broadcasts

Broadcasts now support Email in addition to Telegram. Useful for businesses with email lists (online schools, B2B, consulting).

**Compose:** Broadcasts → Create → write subject and text → choose channel (Telegram / Email / Both) → segment → send now or schedule.

Email is sent only to clients with an email on file who haven't unsubscribed. Both means: clients with Telegram get a Telegram message, those with only email get a mail.

Each email includes a required **Unsubscribe** link (Resend and email-client policy). One-click Unsubscribe headers also work in Gmail and Apple Mail.

**Before launch:** verify the staffix.io domain in Resend (SPF / DKIM / DMARC) — without this emails go to spam.`,
      uz: `## Email yuborishlar

Endi yuborishlar Telegramga ham, Emailga ham boradi. Tanlash — Yuborishlar → Yaratish → Kanal: Telegram / Email / Ikkalasi.

Email faqat email kiritilgan va obunadan chiqmagan mijozlarga boradi. Har bir xatda majburiy "Obunani bekor qilish" havolasi.

Ishga tushirishdan oldin staffix.io domeni Resendda tasdiqlangan bo'lishi kerak.`,
      kz: `## Email жіберулер

Енді жіберулер Telegramға да, Email-ге де барады. Таңдау — Жіберулер → Жасау → Арна: Telegram / Email / Екеуі.

Email тек email көрсетілген және жазылудан бас тартпаған клиенттерге барады. Әр хатта міндетті «Жазылудан бас тарту» сілтемесі.

Іске қосудан бұрын staffix.io домені Resend-те расталған болуы керек.`,
    },
  },

  // ===== 25. SUBSCRIPTION MANAGEMENT =====
  {
    id: "subscription-mgmt",
    icon: "CreditCard",
    title: {
      ru: "Управление подпиской Staffix",
      en: "Staffix Subscription Management",
      uz: "Staffix obunasini boshqarish",
      kz: "Staffix жазылымын басқару",
    },
    description: {
      ru: "Смена тарифа, отмена, обновление карты — всё из дашборда",
      en: "Change plan, cancel, update card — all from dashboard",
      uz: "Tarifni o'zgartirish, bekor qilish, kartani yangilash",
      kz: "Тарифті ауыстыру, бас тарту, картаны жаңарту",
    },
    content: {
      ru: `## Управление подпиской Staffix

Раздел **Настройки → Подписка** показывает ваш текущий тариф, дату следующего списания и количество использованных сообщений.

### Сменить тариф

Кнопка «Изменить план» → выберите новый тариф и период (месяц/год).

**Если переходите дороже** (например с Pro на Business):
- Перебрасывает в PayPro для оплаты нового плана
- Неиспользованные дни старого плана пересчитываются и добавляются как бонус-дни к новому
- Старая подписка автоматически отменяется

**Если переходите дешевле** (с Business на Pro):
- Можно перейти **с использованием кредита** — без оплаты сейчас. Остаток денег от старого плана конвертируется в дополнительные дни нового тарифа. После — нужно оформить подписку заново.
- Или **через checkout** — платите новый тариф, кредит конвертируется в бонус-дни.

### Отменить подписку

Кнопка «Отменить подписку» → подписка отменяется в PayPro (Terminate). Сервис продолжает работать **до конца оплаченного периода**, после — переходит в trial.

Дальнейших списаний с карты не будет. На email приходит письмо «Доступ до X числа». За 7, 3 и 1 день до конца — напоминалки.

### Обновить карту

Кнопка «Управление картой» → открывается личный кабинет PayPro по адресу \`cc.payproglobal.com/customer/Account/Login\`.

**Первый раз?** На checkout PayPro вы карту вводили, но пароль не задавали — аккаунт создан автоматически по email. Чтобы войти:

1. Жмёте «Forgot password?» под формой логина
2. Вводите email с которым покупали
3. На email приходит ссылка для сброса
4. Задаёте пароль → входите
5. В кабинете можете менять карту, скачивать инвойсы, отменять подписку самостоятельно

В дальнейшем вход по email + пароль.

### Что произойдёт при неудачном списании

PayPro попытается списать ещё несколько раз в течение недели. На каждой попытке клиент получает email «Не получилось списать оплату — обновите карту до X числа». Если не сработало → подписка переходит в статус «Приостановлена», в дашборде — красный баннер с прямой ссылкой обновить карту в PayPro.

### Уведомления о подписке

- Оплата прошла → email клиенту с деталями плана и до какой даты активно
- Автопродление прошло → такой же email
- Списание не удалось → email со ссылкой обновить карту
- Подписка приостановлена → email с инструкциями возобновить
- Подписка отменена → email «доступ до X числа»
- За 7/3/1 день до конца отменённой подписки → напоминалки`,
      en: `## Staffix Subscription Management

**Settings → Subscription** shows your current plan, next charge date and usage.

**Change plan:** Click "Change plan" → pick new plan and period.
- Upgrade: pay new plan price, unused days of old plan become bonus days
- Downgrade with credit: no payment now, remaining money converts to extra days at new (cheaper) rate
- Downgrade with checkout: pay new plan, get bonus days

**Cancel:** Hits PayPro Terminate. Service runs until end of paid period, then drops to trial. 7/3/1-day reminders sent. No further card charges.

**Update card:** "Manage payment method" → opens PayPro customer portal at \`cc.payproglobal.com/customer/Account/Login\`. First time? You didn't set a password at checkout — click "Forgot password", enter your email, get a reset link, then log in. After that you can change card, download invoices, cancel.

**Failed charge:** Customer gets emails on each attempt; after retries fail, subscription moves to "Suspended" with a red banner in dashboard linking to PayPro to update card.`,
      uz: `## Staffix obunasini boshqarish

Sozlamalar → Obunada joriy tarif, keyingi to'lov sanasi va xabarlar soni ko'rinadi.

"Tarifni o'zgartirish" — yangi tarifga o'tish (qimmatroq → to'lash, arzonroq → kreditdan kun olish).

"Obunani bekor qilish" — to'langan davr oxirigacha ishlaydi, keyin trial.

"Karta boshqaruvi" — PayPro shaxsiy kabinetida kartani yangilash.`,
      kz: `## Staffix жазылымын басқару

Баптаулар → Жазылымда ағымдағы тариф, келесі төлем күні және хабарламалар саны көрінеді.

«Тарифті ауыстыру» — жаңа тарифке көшу.

«Жазылымнан бас тарту» — төленген кезеңнің соңына дейін жұмыс істейді.

«Картаны басқару» — PayPro жеке кабинетінде картаны жаңарту.`,
    },
  },

  // ===== 26. CONSULTATIONS HYBRID =====
  {
    id: "consultations",
    icon: "Calendar",
    title: {
      ru: "Запись на бесплатные консультации",
      en: "Free Consultation Bookings",
      uz: "Bepul konsultatsiyaga yozilish",
      kz: "Тегін кеңес беруге жазылу",
    },
    description: {
      ru: "Для онлайн-школ, консалтинга, коучей",
      en: "For online schools, consultants, coaches",
      uz: "Onlayn maktablar, konsalting uchun",
      kz: "Онлайн мектептер, консалтинг үшін",
    },
    content: {
      ru: `## Запись на консультации в продажном режиме

Обычно бизнес выбирает один режим: либо услуги (с записями), либо продажи (с заказами). Но онлайн-школам, консалтингам и коучам нужны **оба** — продают курс, но сначала записывают на бесплатную консультацию.

### Как включить

1. Дашборд → **Настройки → Подписка** → блок «Запись на бесплатные консультации»
2. Включите тоггл (виден только в режиме «Продажи»)
3. Сохранится автоматически

### Как работает

После включения AI получает оба набора инструментов:
- **Если клиент явно покупает** («хочу заказать», «беру курс») → AI создаёт заказ
- **Если клиент сомневается / хочет узнать подробнее** → AI предлагает записаться на бесплатную консультацию через ваше расписание услуг

Услугу-консультацию нужно создать в **Услуги** (бесплатную или с символической ценой). Менеджер созванивается → продаёт курс вне Staffix → когда продал, помечает клиента как «Клиент» вручную в воронке.

### Напоминания о консультации

После записи — клиенту приходят напоминалки за 24ч и 2ч до консультации (как для обычной услуги). Можете перенести / отменить через бот.`,
      en: `## Consultation Bookings in Sales Mode

Online schools, consultants, and coaches often need both: sell a product/course, but close it through a free intro call. Enable in Settings → Subscription → "Free consultation bookings" toggle (visible only in Sales mode).

When enabled, AI gets both sets of tools — orders for purchases, bookings for free consultations. Reminders 24h/2h before the call work as usual.`,
      uz: `## Sotuv rejimida konsultatsiyaga yozilish

Onlayn maktablar, konsaltinglar uchun: kurs sotish + bepul uchrashuvga yozish.

Yoqish: Sozlamalar → Obuna → "Bepul konsultatsiyaga yozilish".

AI ham buyurtma qabul qiladi, ham mijozlarni xizmat (bepul konsultatsiya) sifatida yozib oladi.`,
      kz: `## Сату режимінде кеңеске жазылу

Онлайн мектептер, консалтингтер үшін: курс сату + тегін кездесуге жазу.

Қосу: Баптаулар → Жазылым → «Тегін кеңес беруге жазылу».

AI әрі тапсырыс қабылдайды, әрі клиенттерді қызмет (тегін кеңес) ретінде жазып алады.`,
    },
  },

  // ===== 27. AI INSIGHTS (Sprint 4C — 20 июля 2026) =====
  {
    id: "ai-insights",
    icon: "Brain",
    title: {
      ru: "AI-подсказки для владельца",
      en: "AI Insights for Owners",
      uz: "Egasi uchun AI maslahatlar",
      kz: "Иесі үшін AI кеңестері",
    },
    description: {
      ru: "Раз в неделю AI сам находит слабые места бота",
      en: "Weekly, AI surfaces bot weak spots",
      uz: "Haftalik, AI botning zaif joylarini topadi",
      kz: "Аптасына, AI боттың әлсіз тұстарын табады",
    },
    content: {
      ru: `## AI-подсказки для владельца

Каждый понедельник в 09:00 UTC Staffix анализирует переписки бота с клиентами за прошедшую неделю и выкладывает 4 типа подсказок на странице **AI Обучение → Подсказки**.

### Тип 1 — «Часто спрашивают X»

Клиенты 3+ раз спросили одно и то же, бот ответил «уточните у менеджера». AI кластеризует похожие вопросы в один и предлагает добавить FAQ.

Одна кнопка «Принять» — Staffix создаёт FAQ автоматически. Бот сразу подхватывает новую тему и в следующий раз ответит сам.

### Тип 2 — «Бот часто передаёт менеджеру: X»

Похоже на первый тип, но обращает внимание не на «не знаю», а на явные эскалации: «передам менеджеру», «специалист свяжется». Значит эти вопросы бот **может** решать, если научить его.

Действие: либо добавить FAQ, либо оставить эскалацию, если тема действительно требует человека (медицина, деньги, юр. вопросы).

### Тип 3 — «Бот говорит "не знаю" в X% случаев»

Общий агрегат: если бот больше чем в 20% ответов честно признался что не знает — база знаний слаба в целом. Нужно расширить документы бизнеса или FAQ.

Показывается только если ответов было хотя бы 20 за неделю (иначе — статистический шум).

### Тип 4 — «Клиенты пишут на узбекском, а бот отвечает на русском»

Staffix автоматически определяет язык клиентов и язык ответов бота. Если 30%+ сообщений клиентов приходят не на языке бота — вы получаете подсказку сменить язык бота или расширить инструкции.

Определяются: русский, узбекский (латиница), казахский, английский.

### Как использовать

- Заходите в **AI Обучение → Подсказки** раз в неделю
- «Принять» → создать FAQ / поменять настройку
- «Отклонить» → подсказка больше не появится в этой формулировке 14 дней

Все подсказки не дублируются — если по одной теме уже был инсайт, второй раз не создаётся.`,
      en: `## AI Insights for Owners

Every Monday at 09:00 UTC, Staffix analyses the last week of bot ↔ client conversations and surfaces 4 kinds of insights on the **AI Learning → Insights** page.

### Type 1 — "Clients keep asking X"
3+ similar questions where the bot said "I don't know". One-click "Accept" creates a FAQ.

### Type 2 — "Bot keeps escalating: X"
Repeated hand-offs to a manager on similar topics. Either add a FAQ or leave the escalation intentional (medical/financial questions).

### Type 3 — "Bot says 'I don't know' X% of the time"
Aggregate signal: if >20% of bot replies are refusals over 20+ messages a week, your knowledge base is too thin.

### Type 4 — "Clients write in Uzbek, bot answers in Russian"
Automatic language detection (ru/kz/uz/en). If ≥30% of client messages are in a different language than the bot's, you're told to switch bot's language or extend its instructions.

Insights are deduplicated for 7–14 days so the same suggestion doesn't reappear every week.`,
      uz: `## Egasi uchun AI maslahatlar

Har dushanba 09:00 UTC da Staffix o'tgan haftadagi suhbatlarni tahlil qiladi va **AI o'qitish → Maslahatlar** sahifasida 4 xil maslahat chiqaradi.

1. **"Mijozlar tez-tez X so'raydi"** — 3+ o'xshash savol, bot javob bilmagan. Bir marta bosish bilan FAQ yaratiladi.
2. **"Bot menejerga topshiryapti"** — takroriy topshirishlar. FAQ qo'shing yoki savolni odam hal qilishiga qoldiring.
3. **"Bot X% javobda 'bilmadim'"** — bilim bazasi zaif ekanligini ko'rsatuvchi umumiy ko'rsatkich.
4. **"Mijozlar o'zbekcha yozadi, bot ruscha javob beradi"** — til nomuvofiqligi. Bot tilini o'zgartiring.`,
      kz: `## Иесі үшін AI кеңестері

Әр дүйсенбіде 09:00 UTC Staffix өткен аптадағы диалогтарды талдап, **AI үйрену → Кеңестер** бетінде 4 түрлі кеңес шығарады.

1. **"Клиенттер X сұрайды"** — 3+ ұқсас сұрақ, бот жауап білмеген.
2. **"Бот менеджерге жиі жібереді"** — қайталанатын тапсырулар.
3. **"Бот X% жауапта 'білмеймін' дейді"** — білім қоры әлсіз.
4. **"Клиенттер қазақша жазады, бот орысша жауап береді"** — тіл сәйкессіздігі.`,
    },
  },

  // ===== 28. META ADS (Sprint 4D — 20 июля 2026) =====
  {
    id: "meta-ads",
    icon: "BarChart3",
    title: {
      ru: "Реклама Meta — свой дашборд",
      en: "Meta Ads Dashboard",
      uz: "Meta Reklama boshqaruv paneli",
      kz: "Meta жарнамасы — өз панелі",
    },
    description: {
      ru: "Spend, CPL, CTR + воронка от клика до продажи",
      en: "Spend, CPL, CTR + click-to-sale funnel",
      uz: "Xarajat, CPL, CTR + savdo voronkasi",
      kz: "Шығын, CPL, CTR + сату воронкасы",
    },
    content: {
      ru: `## Реклама Meta — дашборд владельца

Staffix читает Meta Marketing API и показывает вам реальную стоимость лида и клиента с рекламы в Instagram/Facebook. Не нужно вручную сопоставлять кабинет Meta с базой Staffix.

### Подключение

1. Дашборд → **Каналы → Meta** → блок «Рекламный аккаунт»
2. Введите Ad Account ID из Meta Ads Manager (например \`123456789\`, без префикса \`act_\`)
3. Токен доступа берётся из уже подключённого Facebook Login. Если Meta-каналы работают — токен уже есть.
4. Данные появятся в течение суток (крон раз в день в 08:00 UTC), либо нажмите «Обновить» на странице «Реклама Meta» для ручной синхронизации.

### Что вы видите на странице «Реклама Meta»

- **Плитки KPI**: Потрачено / Клики / CTR / Средний CPL (в валюте вашего рекламного кабинета).
- **Воронка от рекламы до продажи**: Клики по рекламе → Лиды в IG/FB → Клиенты (три большие цифры + процент конверсии между ними).
- **Таблица по кампаниям**: Название / Показы / Клики / CTR / Потрачено / Лиды / CPL / Клиентов. Отсортировано по потраченной сумме.
- **Период**: неделя / месяц / всё время.

### Как считается атрибуция

Каждый день Staffix проверяет: сколько лидов пришло в этом бизнесе через IG/FB в этот день. Именно эти цифры складываются как «атрибуция» к кампаниям того дня.

**Важное ограничение**: разбивка по конкретной кампании (например «эта продажа с кампании А, эта с Б») пока не делается — все лиды дня записываются во все кампании этого дня. Точная UTM-атрибуция потребует отдельного трекинга ссылок.

### Как оценить эффективность

- **CPL** (стоимость лида) — сколько $ вы тратите на одно новое обращение в IG/FB. Норма зависит от ниши; клиника — $5-20, курсы — $2-10, доставка еды — $1-5.
- **CTR** — процент кликов от показов. Ниже 1% — креатив слабый; выше 3% — отличный.
- **Воронка Клик → Лид** — сколько людей от кликнувших реально написали в директ. Ниже 3% — оффер в объявлении не совпадает с оффером на странице.
- **Воронка Лид → Клиент** — сколько написавших дошли до сделки. Ниже 10% — бот теряет клиентов (посмотрите AI-подсказки).

### Ограничения (для честности)

- Только Meta. TikTok / Google Ads — в планах.
- Разбивка per-campaign не делается. Все лиды дня видны во всех кампаниях этого дня.
- Данные обновляются раз в сутки. Кнопка «Обновить» — если срочно.`,
      en: `## Meta Ads Dashboard

Staffix pulls Meta Marketing API and shows you the real cost of a lead and a client from your Instagram/Facebook ads. No more spreadsheets.

### Setup
1. Dashboard → **Channels → Meta** → "Ad Account" block
2. Enter Ad Account ID from Meta Ads Manager (e.g. \`123456789\`, no \`act_\` prefix)
3. Access token is taken from your already-connected Facebook Login
4. Data arrives within a day (daily cron 08:00 UTC) or click "Refresh" on the Meta Ads page

### What you see
- KPIs: Spend / Clicks / CTR / Average CPL
- **Funnel**: Ad clicks → IG/FB leads → Clients
- **Campaign table** sorted by spend
- Period switch: week / month / all time

### Attribution note
Per-day, all IG/FB leads are attributed to all campaigns of that day. Per-campaign UTM tracking would need separate infrastructure.`,
      uz: `## Meta Reklama boshqaruv paneli

Staffix Meta Marketing API dan ma'lumot oladi va Instagram/Facebook reklamasidan lid va mijoz haqiqiy narxini ko'rsatadi.

**Ulash**: Boshqaruv paneli → **Kanallar → Meta** → "Reklama akkaunti" bo'limi → Meta Ads Manager dan Ad Account ID ni kiriting.

Ma'lumot 24 soat ichida paydo bo'ladi (kunlik cron 08:00 UTC) yoki "Yangilash" tugmasini bosing.`,
      kz: `## Meta жарнамасы — иесінің панелі

Staffix Meta Marketing API-дан деректерді оқып, Instagram/Facebook жарнамасынан лид пен клиенттің нақты құнын көрсетеді.

**Қосу**: Панель → **Арналар → Meta** → «Жарнама аккаунты» блогы → Meta Ads Manager-ден Ad Account ID енгізіңіз.

Деректер 24 сағат ішінде пайда болады (күнделікті крон 08:00 UTC) немесе «Жаңарту» түймесін басыңыз.`,
    },
  },

  // ===== 29. LOYALTY LEDGER (Sprint 4E — 20 июля 2026) =====
  {
    id: "loyalty-ledger",
    icon: "Users",
    title: {
      ru: "История баллов лояльности",
      en: "Loyalty Points History",
      uz: "Sodiqlik ballari tarixi",
      kz: "Адалдық ұпайларының тарихы",
    },
    description: {
      ru: "Каждое начисление и списание записывается с причиной",
      en: "Every earn and spend recorded with reason",
      uz: "Har bir yig'ish va sarflash sabab bilan yoziladi",
      kz: "Әр есептеу мен алу себебімен жазылады",
    },
    content: {
      ru: `## История баллов лояльности

Раньше вы видели только текущий баланс баллов клиента. Теперь каждое движение баллов записывается отдельно с указанием **за что** и **когда**.

### Где смотреть

Карточка клиента (\`/dashboard/customers/[id]\`) → блок «Баллы лояльности» с иконкой подарка.

Показывает:
- Текущий баланс
- Количество визитов клиента
- Общую сумму покупок
- **Историю движений** — до 100 последних операций

### Типы движений

- **Начислено** — за визит, покупку или бронирование. AI записывает автоматически с указанием причины: «Кэшбек за услугу маникюр (5%)».
- **Потрачено** — списание, когда клиент оплачивает баллами (в будущих версиях).
- **Сгорело** — сгорание по срокам программы (крон в будущем).
- **Вручную** — начисление/списание от менеджера с комментарием.

### Ручное начисление от менеджера

В блоке «Баллы лояльности» на карточке клиента:
1. Введите количество баллов
2. Комментарий (необязательно, но рекомендуется — «Компенсация за задержку»)
3. Кнопка «Начислить» или «Списать»

**Защита**: ±100 000 за операцию (защита от опечатки). Баланс не может уйти в минус — если попытаетесь списать больше чем есть, спишется сколько было.

### Зачем это нужно

**Прозрачность**: клиент спрашивает «за что мне 500 баллов?» — вы открываете его карточку и видите точную запись.

**Аудит**: если что-то пошло не так (двойное начисление, ошибочное списание) — есть точная история для разбора.

**Обоснование**: менеджер помечает *почему* начислил бонусные баллы («извинение за задержку»). Через месяц вы или бухгалтерия видите обоснование.

### Ограничения

- История ведётся с 20 июля 2026 (backfill старых движений не делали — их не разобрать).
- Баланс до этой даты просто равен «сумме приращений на 20 июля».`,
      en: `## Loyalty Points History

Previously you saw only the current balance. Now every earn/spend is recorded with a reason.

### Where
Customer card (\`/dashboard/customers/[id]\`) → "Loyalty Points" block.

### Kinds
- **earn** — for visit/purchase/booking. AI writes automatically with reason: "Cashback for manicure (5%)".
- **spend** — points used as payment (future).
- **expire** — automatic burn per program terms (future cron).
- **manual** — manager credit/debit with comment.
- **adjustment** — technical fix (migration).

### Manual credit
Enter amount + optional reason, click "Credit" or "Debit". Bounded at ±100,000 per operation. Balance can't go negative.

Point-in-time note: history starts 20 July 2026 (no backfill of old movements).`,
      uz: `## Sodiqlik ballari tarixi

Ilgari faqat joriy balansni ko'rgansiz. Endi har bir ball harakati sabab bilan yoziladi.

Mijoz kartochkasi (\`/dashboard/customers/[id]\`) → "Sodiqlik ballari" bloki.

**Turlari**: earn (yig'ish), spend (sarflash), expire (kuyib ketish), manual (qo'lda menejer), adjustment (tuzatish).

Menejerdan qo'lda: miqdor + izoh → "Yig'ish" yoki "Sarflash". Chegara ±100 000. Salbiy balans mumkin emas.`,
      kz: `## Адалдық ұпайларының тарихы

Бұрын тек ағымдағы теңгерімді көретінсіз. Енді әр ұпай қозғалысы себебімен жазылады.

Клиент картасы (\`/dashboard/customers/[id]\`) → «Адалдық ұпайлары» блогы.

**Түрлері**: earn (есептеу), spend (жұмсау), expire (жанып кету), manual (менеджерден қолмен), adjustment (түзету).

Менеджерден қолмен: сан + пікір → «Есептеу» немесе «Алу». Шектеу ±100 000. Теріс теңгерім мүмкін емес.`,
    },
  },

  // ===== 30. WIDGET (Sprint Widget — 21 июля 2026) =====
  {
    id: "site-widget",
    icon: "Radio",
    title: {
      ru: "Виджет Staffix для вашего сайта",
      en: "Staffix Widget for Your Website",
      uz: "Sayt uchun Staffix vidjeti",
      kz: "Сайтыңызға арналған Staffix виджеті",
    },
    description: {
      ru: "Плавающая кнопка → клиент попадает в бота через TG/WA/IG/FB",
      en: "Floating button → visitor jumps into the bot via TG/WA/IG/FB",
      uz: "Suzuvchi tugma → mijoz TG/WA/IG/FB orqali botga kiradi",
      kz: "Қалқымалы түйме → клиент TG/WA/IG/FB арқылы ботқа өтеді",
    },
    content: {
      ru: `## Виджет для сайта

Разместите на своём сайте плавающую кнопку — посетитель одним кликом попадёт в переписку с вашим AI-сотрудником через Telegram, WhatsApp, Instagram Direct или Facebook Messenger.

Никакого чата в iframe — только deep-link в мессенджер, который у посетителя уже установлен. Это удобно клиенту (он общается там где привык) и снимает нагрузку с вашего сайта.

### Установка (1 минута)

1. **Дашборд → Виджет для сайта** — там персональный код с вашим ID.
2. Нажмите **«Скопировать»**.
3. Вставьте перед закрывающим тегом \`</body>\` на всех страницах вашего сайта.

Готово. Виджет появится в правом нижнем углу.

### Что видит посетитель

Круглая синяя кнопка → клик → всплывает панель со списком доступных мессенджеров (только тех что вы подключили в Staffix). Клик по кнопке — открывается приложение мессенджера / веб-версия с готовым чатом с вашим ботом.

### На разных платформах

**WordPress**: плагин «Insert Headers and Footers» → поле «Scripts in Footer» → вставить код.

**Tilda**: Настройки сайта → Ещё → HTML-код для вставки внутри HEAD/BODY → выбрать «Перед \`</body>\`».

**Wix**: Settings → Custom Code → + Add Custom Code → вставить, выбрать «Body — end» и «All pages».

**Чистый HTML / Next.js / React**: вставить строку прямо в шаблон layout перед \`</body>\`.

### Управление

- **Подключили новый канал** — он появится в виджете автоматически через ~5 минут (edge-cache).
- **Отключили канал** — соответствующая кнопка пропадёт у посетителя.
- **WhatsApp не открывается** — проверьте что в **Настройки → Профиль** указан ваш телефон в международном формате (+998...). Виджет строит ссылку wa.me/PHONE из этого поля.
- **Ни один канал не подключён** — виджет тихо не рендерится (не будет пустой кнопки).

### Технические детали (для тех кому интересно)

- Скрипт грузится асинхронно (\`async\`), не блокирует рендеринг сайта.
- Размер ~4 КБ (без React, чистый vanilla JS).
- Без cookies, без трекинга. Только deep-link.
- Edge-кэш 5 минут — минимальная нагрузка на наш API.
- CORS \`*\` — работает на любом домене.
- Если у вашего сайта строгий CSP — добавьте \`staffix.io\` в \`script-src\`.`,
      en: `## Website Widget

Add a floating button to your website — one click drops a visitor into a chat with your AI employee via Telegram, WhatsApp, Instagram Direct, or Facebook Messenger.

No embedded chat, no iframes — just a deep-link into the messenger the visitor already has installed. Comfortable for customers, zero overhead for your site.

### Install (1 minute)

1. **Dashboard → Website Widget** — grab your personalised snippet.
2. Click **"Copy"**.
3. Paste before \`</body>\` on all pages of your site.

Done — the widget appears in the bottom-right corner.

### What the visitor sees

Round blue button → click → panel with available messengers (only the ones you've connected in Staffix). Click a messenger → opens the app / web version with a ready-to-go chat with your bot.

### Platforms

- **WordPress**: "Insert Headers and Footers" plugin → "Scripts in Footer" field.
- **Tilda**: Site Settings → More → Insert HTML → "Before \`</body>\`".
- **Wix**: Settings → Custom Code → Add → "Body — end" + "All pages".
- **Raw HTML / Next.js / React**: paste directly into your layout before \`</body>\`.

### Notes

- Connect a new channel — appears in the widget within ~5 min.
- Widget script is async, ~4 KB, no cookies, no tracking.
- If your site has strict CSP, add \`staffix.io\` to \`script-src\`.
- WhatsApp uses your business phone from Settings → Profile (international format +...).`,
      uz: `## Sayt vidjeti

Saytingizga suzuvchi tugma qo'shing — mijoz bir marta bosish bilan Telegram, WhatsApp, Instagram yoki Messenger orqali AI-xodimingiz bilan yozishmaga tushadi.

### O'rnatish

1. **Boshqaruv paneli → Sayt vidjeti** — kodni oling.
2. **"Nusxalash"** ni bosing.
3. Saytingizning barcha sahifalarida \`</body>\` yopilishi oldiga joylashtiring.

WordPress, Tilda, Wix va toza HTML uchun batafsil ko'rsatmalar dashboard'da.

**WhatsApp uchun**: profilda telefon xalqaro formatda ko'rsatilgan bo'lishi kerak (+998...).`,
      kz: `## Сайт виджеті

Сайтыңызға қалқымалы түйме қосыңыз — клиент бір басумен Telegram, WhatsApp, Instagram немесе Messenger арқылы AI-қызметкеріңізбен жазысуға түседі.

### Орнату

1. **Панель → Сайт виджеті** — кодты алыңыз.
2. **«Көшіру»** басыңыз.
3. Сайтыңыздың барлық беттерінде \`</body>\` алдында орналастырыңыз.

WordPress, Tilda, Wix және таза HTML үшін толық нұсқаулық панельде.

**WhatsApp үшін**: профильде телефон халықаралық форматта көрсетілуі керек (+998...).`,
    },
  },
];
