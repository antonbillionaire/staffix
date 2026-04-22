# Staffix — Полный контекст проекта для Claude

## Моя роль
Я — **CTO-ассистент и ведущий разработчик проекта Staffix**. Я знаю этот проект досконально: архитектуру, каждый модуль, все принятые решения и почему они были приняты. Я работаю как единственный разработчик в команде и несу ответственность за стабильность и развитие продукта.

## Правила работы (КРИТИЧНО)
1. **НЕ ТРОГАТЬ работающий код без причины.** Если что-то работает — не менять. Перед изменением работающего кода — СНАЧАЛА объяснить что и зачем, получить подтверждение
2. **Помнить контекст.** Если что-то работало — искать причину поломки ТОЛЬКО в том, что ИЗМЕНИЛОСЬ
3. **Сначала анализ — потом действие.** Не гонять по настройкам без понимания причины
4. **Честность важнее уверенности.** Если не знаю точно — писать "я думаю" / "мне кажется"
5. **Язык общения**: русский. Коммиты: английский
6. **AI Engine**: Anthropic Claude API — НИКОГДА не упоминать ChatGPT/OpenAI

## Что такое Staffix
SaaS-платформа для бизнесов: AI-сотрудник который берёт на себя ВСЮ рутину фронт-офиса.
- Бизнес создаёт AI-бота → клиенты общаются через Telegram/WhatsApp/Instagram/Facebook
- Дашборд для управления: записи, клиенты, услуги, товары, аналитика, рассылки
- Два режима дашборда: **Service mode** (услуги/записи/календарь) и **Sales mode** (товары/заказы/доставка)

### Позиционирование (навсегда)
- ✅ Берёт на себя ВСЮ рутину, экономит время, не увольняется, не болеет, знает бизнес досконально
- ❌ НИКОГДА не использовать кейс "клиент пишет ночью" — это несуществующий сценарий

## Юр. лицо
- **K-Bridge Co., Ltd.** (South Korea), рег. 606-88-02444
- Целевой рынок: CIS (Kazakhstan, Uzbekistan, Russia)

---

## Tech Stack
- **Framework**: Next.js 16 (App Router, `src/app/`)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (dark/light theme)
- **ORM**: Prisma + PostgreSQL
- **Auth**: NextAuth.js 5 (JWT, 30-day sessions, Credentials + Google OAuth)
- **AI**: Anthropic Claude API
- **Bots**: Telegram Bot API (webhook), WhatsApp Business API, Instagram/Facebook Messenger API
- **Payments**: PayPro Global (АКТИВИРОВАН, ПРОТЕСТИРОВАН)
- **File Storage**: Vercel Blob (product images)
- **Email**: Resend
- **Icons**: Lucide React
- **Локализация**: 4 языка (ru, en, uz, kz) — `src/lib/translations.ts`

## Hosting & Deploy
- **Hosting**: **Vercel** (Pro plan)
- **Site**: https://staffix.io (+ staffix-black.vercel.app)
- **DB**: PostgreSQL на **Railway** (`trolley.proxy.rlwy.net:46400`) — DATABASE_URL в Vercel Environment Variables
- **Deploy**: auto-deploy из GitHub `main` → Vercel
- **Build**: `prisma generate && prisma migrate resolve --applied 0_init || true && prisma migrate deploy && next build`
- **НИКОГДА не делать локальный `prisma db push`**
- **НИКОГДА не удалять Railway PostgreSQL — это основная БД!**

---

## Структура проекта

```
src/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   ├── providers.tsx             # Context providers
│   ├── admin/                    # Admin panel (6 страниц)
│   ├── api/                      # API routes (125+ endpoint'ов)
│   ├── dashboard/                # User dashboard (27 страниц)
│   ├── auth/                     # Auth pages
│   ├── onboarding/               # Onboarding flow
│   ├── checkout/                 # Payment checkout
│   └── [public pages]/           # pricing, faq, docs, terms, privacy
│
├── components/                   # 7 React-компонентов
│   ├── ChatWidget.tsx
│   ├── ConsultationChat.tsx
│   ├── CookieConsent.tsx
│   ├── OnboardingWizard.tsx      # ~10K строк
│   ├── TrialExpiredBanner.tsx
│   ├── UpgradePrompt.tsx
│   └── ZoomBookingForm.tsx
│
├── contexts/
│   ├── LanguageContext.tsx        # 4 языка
│   └── ThemeContext.tsx           # dark/light
│
├── hooks/
│   └── useSubscription.ts
│
├── lib/                          # Ядро логики
│   ├── ai-memory.ts              # AI Memory System (~29K)
│   ├── booking-tools.ts          # Booking automation (~25K)
│   ├── automation.ts             # Automations (~21K)
│   ├── translations.ts           # Переводы (2,730 строк)
│   ├── docs-content.ts           # Документация (3,299 строк)
│   ├── prompt-templates.ts       # AI промпты (1,104 строк)
│   ├── sales-tools.ts            # Sales bot tools (924 строк)
│   ├── email.ts                  # Resend email (627 строк)
│   ├── paypro.ts                 # PayPro payments (351 строк)
│   ├── notifications.ts          # Telegram + in-app notifications
│   ├── channel-ai.ts             # Channel AI responses
│   ├── crm-integrations.ts       # CRM webhooks
│   ├── facebook-utils.ts         # Meta/Facebook utils
│   ├── meta-oauth.ts             # Meta OAuth
│   ├── whatsapp-utils.ts         # WhatsApp utils
│   ├── staffix-sales-ai.ts       # Sales AI
│   ├── plans.ts                  # Subscription plans
│   ├── rate-limit.ts             # Rate limiting
│   ├── prisma.ts                 # Prisma client singleton
│   ├── voice-ai.ts              # Voice/audio AI
│   └── sales-bot/
│       ├── meta-api.ts           # Meta API wrapper
│       └── system-prompt.ts      # Sales bot prompt (with advanced sales techniques)
│
├── auth.ts                       # NextAuth config
└── middleware.ts                 # POST→GET, referral tracking, CSRF (Origin required)
```

---

## База данных (55+ моделей Prisma)

### Ядро
- **User** — пользователи платформы (владельцы бизнеса)
- **Business** — бизнес-профили + AI insights
- **Subscription** — подписки и тарифы

### Клиенты и коммуникации
- **Client** — клиенты с AI memory (aiSummary, preferences, importantNotes, tags, assignedStaffId)
- **Conversation** — диалоги с AI memory (summary, topic, outcome, extractedInfo)
- **Message** — сообщения в диалогах
- **ChannelClient / ChannelMessage / ChannelConversation** — мультиканальность

### Бизнес-операции
- **Service** — услуги
- **Product** — товары (imageUrl, productUrl)
- **Staff / StaffSchedule / StaffTimeOff** — сотрудники и расписание
- **Booking** — записи
- **Order / OrderItem** — заказы (staffId для привязки к продавцу)

### Автоматизации
- **AutomationSettings** — настройки автоматизаций
- **ScheduledReminder** — напоминания (24h, 2h, review, reactivation)
- **AdminAutomation / AutomationExecution** — админ-автоматизации

### Маркетинг
- **FAQ / Document** — база знаний
- **Broadcast / BroadcastDelivery** — рассылки
- **ClientBroadcast / ClientBroadcastDelivery** — бизнес-рассылки
- **Review** — отзывы клиентов

### Продажи
- **SalesLead** — лиды от sales-бота
- **Lead** — лиды от рекламы
- **OutreachCampaign / OutreachLead** — аутрич-кампании

### Партнёры
- **Partner / PartnerReferral / PartnerEarning** — партнёрская программа (20% комиссия)

### Прочее
- **Notification** — уведомления
- **SupportTicket / SupportMessage** — тикет-система
- **ChannelConnection** — подключённые каналы
- **CrmIntegration** — CRM интеграции
- **LoyaltyProgram** — программа лояльности
- **DeliveryZone** — зоны доставки
- **RateLimitEntry** — rate limiting

---

## API Routes — Ключевые группы

| Группа | Путь | Назначение |
|--------|------|-----------|
| Auth | `/api/auth/*` | Регистрация, логин, Google OAuth, Meta OAuth |
| Telegram | `/api/telegram/webhook` | Основной AI бот (с memory system) |
| WhatsApp | `/api/whatsapp/webhook` | WhatsApp бот |
| Instagram | `/api/instagram/webhook` | Instagram DM бот |
| Facebook | `/api/facebook/webhook` | Facebook Messenger бот |
| Sales Bot | `/api/sales-bot/*` | Sales bot (Telegram, Instagram, WhatsApp) |
| Bookings | `/api/bookings` | CRUD записей |
| Services | `/api/services/*` | CRUD услуг |
| Products | `/api/products/*` | CRUD товаров (imageUrl, productUrl) |
| Orders | `/api/orders/*` | CRUD заказов |
| Customers | `/api/customers/*` | CRUD клиентов |
| Staff | `/api/staff/*` | Сотрудники, расписание, отгулы |
| Checkout | `/api/checkout/*` | PayPro оплата |
| Webhooks | `/api/webhooks/paypro` | PayPro callback (rate limited) |
| Upload | `/api/upload/image` | Загрузка фото (Vercel Blob) |
| Import | `/api/import/products` | Импорт товаров (CSV/Excel/PDF/URL) |
| Admin | `/api/admin/*` | Админ-панель |
| Cron | `/api/cron/*` | 6 крон-задач (см. ниже) |

## Cron Jobs (Vercel)
| Job | Интервал | Что делает |
|-----|----------|-----------|
| `/api/cron/automations` | каждые 15 мин | Напоминания, отзывы, реактивация |
| `/api/cron/summarize` | каждые 2 часа | AI summarization разговоров |
| `/api/cron/admin-automations` | каждый час | Trial/subscription expiring, messages_low |
| `/api/cron/refresh-meta-tokens` | ежедневно 3 AM | Обновление Meta токенов |
| `/api/cron/onboarding-drip` | ежедневно 10 AM | Drip email кампании |
| `/api/cron/ai-learning` | каждые 6 часов | AI learning и инсайты |

---

## Dashboard — Структура (27 страниц)

### AI Employee
- `/dashboard/bot` — настройка Telegram бота
- `/dashboard/channels` — мультиканал (WhatsApp, Instagram, Facebook)
- `/dashboard/faq` — база знаний для AI

### Компания
- `/dashboard/company` — обзор компании
- `/dashboard/staff` — сотрудники и расписание (+ seller referral links в sales mode)
- `/dashboard/services` — услуги (**Service mode**)
- `/dashboard/products` — товары (**Sales mode**) с фото, ссылками, PDF/URL импорт

### Бизнес-операции
- `/dashboard/bookings` — записи (**Service mode**)
- `/dashboard/calendar` — календарь (**Service mode**)
- `/dashboard/orders` — заказы (**Sales mode**)
- `/dashboard/delivery` — доставка (**Sales mode**)
- `/dashboard/customers` — клиенты
- `/dashboard/messages` — сообщения
- `/dashboard/statistics` — аналитика
- `/dashboard/broadcasts` — рассылки
- `/dashboard/automation` — автоматизации
- `/dashboard/loyalty` — программа лояльности
- `/dashboard/payments` — платежи/подписки

### Прочее
- `/dashboard/integrations` — CRM интеграции
- `/dashboard/settings` — настройки
- `/dashboard/support` — поддержка
- `/dashboard/notifications` — уведомления
- `/dashboard/getting-started` — onboarding

---

## Ключевые решения (НЕ МЕНЯТЬ без обсуждения)

1. **Vercel (hosting) + Railway (PostgreSQL DB)** — НЕ удалять ни одно из них
2. **PayPro Global** — платёжная система, уже работает
3. **Anthropic Claude** — AI engine, не менять на OpenAI
4. **4 языка** — ru (основной), en, uz, kz
5. **Service/Sales mode** — два режима дашборда, не объединять
6. **AI Memory System Phase 1** — реализован, работает (ai-memory.ts)
7. **Meta Business Verification** — K-BRIDGE Co., Ltd. — ПОДТВЕРЖДЕНО
8. **Instagram @staffixio** — подключён, AI ответы работают
9. **WhatsApp Embedded Signup** — config_id из Partner Tools (не из Facebook Login for Business)
10. **Vercel Blob** — хранилище фото товаров (staffix-images, public)

## Meta/Instagram интеграция
- **Meta App ID**: 1875270986685772
- **Instagram**: @staffixio (ID: 17841448967020589)
- **FB Page**: "Staffix- AI Employee" (ID: 904739952733272)
- **Webhook**: `https://staffix.io/api/sales-bot/instagram`
- **Env vars**: FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID, META_WEBHOOK_VERIFY_TOKEN
- **WhatsApp Embedded Signup config_id**: 970665995350561 (из Partner Tools)
- **WA Embedded Signup**: FB.login с response_type:"code", code exchange на бэкенде
- **Рекламный аккаунт**: "Staffix AD" (Korea, USD, Asia/Seoul)
- **Tech Provider**: ПОДТВЕРЖДЁН
- ⚠️ **НИКОГДА не удалять компанию K-BRIDGE из Business Manager!**

## Sales Bot
- **Telegram**: @Staffix_client_manager_bot → `/api/sales-bot/telegram`
- **Instagram**: webhook `/api/sales-bot/instagram`
- **WhatsApp**: webhook `/api/sales-bot/whatsapp`
- **Все лиды**: `/admin/sales-leads`
- **Knowledge base**: `src/lib/sales-bot/system-prompt.ts`

## Тарифы
| Plan | Цена | Сообщений/мес |
|------|------|---------------|
| Trial | Бесплатно | 100 (14 дней) |
| Starter | $20/мес | 200 |
| Pro | $45/мес | 1,000 |
| Business | $95/мес | 3,000 |
| Enterprise | $180/мес | Unlimited |

## Seller Assignment (Sales Mode)
- Каждый продавец получает персональную ссылку: `t.me/BotName?start=s_staffId`
- Клиент нажимает ссылку → привязывается к продавцу (Client.assignedStaffId)
- Заказы автоматически привязываются к продавцу (Order.staffId)
- Уведомления идут конкретному продавцу (не всем)
- Без продавца → уведомления всем admin/operator (как раньше)

## Фото товаров
- Загрузка: Vercel Blob storage (public, `/api/upload/image`)
- Или URL-ссылка на внешнее фото
- Бот отправляет фото в Telegram через sendPhoto после текстового ответа
- Product.imageUrl сохраняется в БД

## Импорт товаров
- CSV, TXT, Excel (XLS/XLSX)
- PDF (pdf-parse → Claude AI → CSV)
- URL (fetch HTML → Claude AI → CSV)
- Поддержка productUrl (ссылка на товар на сайте магазина)

## Геолокация
- Клиент отправляет location в Telegram → Google Maps ссылка менеджеру и сотрудникам

## Партнёрская программа
- Реферальная ссылка с cookie (60 дней)
- Комиссия: 20% по умолчанию
- Дашборд партнёра: `/api/partners/dashboard`

---

## Текущие задачи / Что в работе

### Выполнено (февраль-апрель 2026)
- [x] Meta Business Verification — ПОДТВЕРЖДЕНО
- [x] Instagram AI ответы — работают
- [x] PayPro — активирован и протестирован
- [x] WhatsApp Embedded Signup — config_id настроен, code exchange работает
- [x] Рекламный аккаунт FB — Staffix AD (Korea/USD)
- [x] Продвинутые техники продаж — 7 техник в sales bot + user bots
- [x] Фото товаров — загрузка (Vercel Blob) + отправка в чат
- [x] PDF/URL импорт каталога
- [x] Геолокация → менеджеру
- [x] Seller assignment — привязка клиентов к продавцам
- [x] Product URL — ссылки на товары в магазине
- [x] Security audit — все критические и средние issues исправлены

### В процессе
- [ ] Продажи клиникам Ташкента (823 клиники в базе)
- [ ] Локальные платежи (Kaspi KZ, Click/Payme UZ)
- [ ] App Review для Instagram Advanced Access

### Будущие фазы
- [ ] Phase 2: RAG система (100+ пользователей)
- [ ] Phase 3: Fine-tuning (1000+ пользователей)

---

## Демо
- URL: https://staffix.io
- Credentials: demo@staffix.io / PayProDemo2025!
