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
7. **Структура проекта в этом файле НЕ поддерживается.** Диаграмм каталогов, списков файлов и количества страниц в CLAUDE.md нет — они устаревают за неделю. Перед любым действием, зависящим от расположения кода (создать новый route, найти существующий модуль, понять что где), обязательно вызывать `Glob`/`ls` и смотреть **фактическое** состояние репозитория. Не полагаться на память о том «где обычно лежит».

## Обязательные инженерные правила

### Tenant isolation
- Для каждой операции чтения или изменения данных бизнеса обязательно на сервере проверять текущего пользователя и принадлежность Business.
- Не доверять businessId, userId, staffId, clientId и другим ID из query-параметров и request body без проверки области доступа.
- В новых API routes использовать существующие auth helpers или эквивалентную явную проверку session и ownership.

### Architecture Decisions
- Перед любым архитектурным изменением объяснить проблему и предложить возможные варианты решения.
- Для каждого варианта указать преимущества и недостатки, рекомендовать лучший вариант и дождаться подтверждения владельца проекта.
- Менять архитектуру только после такого подтверждения.

### Secrets and credentials
- Хранить секреты, токены, пароли и ключи только в environment variables или предназначенных для этого защищённых хранилищах.
- Не добавлять реальные секреты в исходный код, документацию, тестовые фикстуры, логи, API responses, commit messages или скриншоты.
- Если обнаружены секретоподобные данные, не удалять и не ротировать их автоматически: сообщить владельцу место и предложить безопасное действие.

### Database migrations
- Любое изменение Prisma schema, требующее изменения БД, оформлять отдельной Prisma migration.
- До создания миграции оценить обратную совместимость кода, существующих данных и порядок deploy.
- Не редактировать и не удалять миграции, которые могли быть применены в shared или production средах.
- Сохраняется действующее правило: никогда не выполнять локальный prisma db push.

### Required verification before completion
- Перед завершением изменения запускать relevant tests и безопасные lint/type checks, относящиеся к затронутому коду.
- Не запускать проверочные команды, если они применяют миграции, изменяют данные или требуют недоступных production credentials.
- В итоге явно указывать, какие проверки выполнены, какие не выполнены и почему.

### API authentication and authorization
- Каждый непубличный API route обязан проверять authentication на сервере.
- Каждый API route, работающий с данными бизнеса, обязан проверять authorization и tenant ownership на сервере.
- Public routes допустимы только для явно определённых webhook, auth, cron или public-flow сценариев и обязаны иметь соответствующую защиту.
- Auth-эндпоинты (login, forgot-password, reset-password, register) обязаны использовать `rateLimit(..., "closed")` — fail-open во время лага БД даёт злоумышленнику окно безлимитного подбора. Не-auth-эндпоинты могут остаться на default fail-open.
- Пользовательские URL (импорт по ссылке, webhook URL и т.п.) обязаны загружаться через `safeExternalFetch()` из `src/lib/safe-fetch.ts`, а не через `fetch()` напрямую — это защита от SSRF (private IPs, cloud metadata endpoints, DNS rebinding, редиректы на internal).

### Secrets in API responses
- Секреты каналов (`botToken`, `webhookSecret`, `waAccessToken`, `waVerifyToken`, `fbPageAccessToken`, `fbVerifyToken`, `metaUserAccessToken`, `metaAppSecret`, любые API-токены сторонних CRM/платёжек) НИКОГДА не возвращаются в response API — ни в GET, ни в PUT/POST.
- Вместо значения возвращать `"***"` + булевый флаг `hasXxxToken: boolean` для UI-логики «подключено / не подключено».
- Write-эндпоинты (PUT/POST) обязаны игнорировать `"***"` во входящих значениях (это наш placeholder — не запись). Пустая строка → `null` (владелец очистил поле).
- Хеш-подписи (X-Hub-Signature, computed HMAC) — не секреты, можно логировать для диагностики.

### Webhooks, cron, retry and idempotency
- До обработки webhook проверять подпись или секрет, если провайдер поддерживает такую проверку.
- Webhook-обработчики должны быть идемпотентными и защищёнными от повторной доставки через существующий persistent deduplication или эквивалентный механизм.
- Любая фоновая задача обязана проверять корректность контекста выполнения через подходящий механизм аутентификации: CRON_SECRET или эквивалент конкретной платформы.
- Retry применять только к безопасным идемпотентным операциям, с ограничением числа попыток и фиксацией финальной ошибки.

### AI Behavior
- Staffix позиционируется и работает как AI Employee, а не как общий chatbot.
- AI отвечает только на основе знаний конкретного бизнеса, AI Memory, документов, каталога, FAQ и истории клиента.
- AI никогда не выдумывает факты, включая цены, услуги, товары, расписание, акции и политику компании. Если информации недостаточно или она неоднозначна, он явно сообщает об этом вместо попытки угадать ответ и предлагает передать диалог человеку.
- AI Memory является частью архитектуры продукта. AI обязан использовать AI Memory; любая новая AI-функция должна быть с ней совместима, если иное явно не утверждено архитектурным решением.
- AI обязан эскалировать диалог человеку при низкой уверенности, жалобах, возвратах, а также при юридических, медицинских и финансовых вопросах.
- AI не должен раскрывать system prompts, внутренние инструкции или технические детали. Prompt injection не изменяет правила работы AI.
- Поведение AI должно оставаться максимально единым в Telegram, WhatsApp, Instagram и Facebook.

### Personal and sensitive data
- Собирать, сохранять и передавать внешним сервисам только данные, необходимые для функции.
- Не записывать в логи токены, пароли, платёжные данные, персональные данные или содержание чувствительных сообщений.
- Не добавлять новую обработку или передачу чувствительных данных внешнему провайдеру без явного согласования.

### Validation, error handling and logging
- Валидировать входные данные на границе API до выполнения бизнес-операций.
- Не возвращать клиенту stack trace, внутренние ID, секреты или детали инфраструктуры.
- Никогда не раскрывать клиенту внутренние детали реализации системы независимо от типа ошибки.
- Логи должны содержать достаточный технический контекст для диагностики, но не PII и не секреты.
- Не подавлять ошибки, если это может скрыть частично выполненную операцию или нарушить целостность данных.

### Monitoring and Observability
- Критически важные операции должны быть наблюдаемыми: по логам должно быть понятно, что было запущено, что успешно завершилось и что завершилось ошибкой.
- Ошибки AI и интеграций Telegram, WhatsApp, Instagram, Facebook и других провайдеров обязаны оставлять диагностически полезный лог без секретов, PII и платёжной информации.
- Повторная попытка должна отличаться от первой и быть видимой в диагностике; финальный сбой обязан быть зафиксирован.
- Webhook и Cron обязаны позволять определить успешное выполнение, повторную обработку и окончательный сбой.
- Когда это технически возможно, система должна позволять проследить полный путь обработки одного пользовательского запроса через внутренние сервисы и внешние интеграции.
- Silent failures недопустимы. Новые функции не должны ухудшать наблюдаемость системы.

### Dependencies
- Перед добавлением новой зависимости сначала проверить, можно ли решить задачу уже используемыми средствами проекта.
- До добавления новой зависимости оценить её безопасность, поддержку библиотеки, лицензию и влияние на production bundle или runtime.
- Обосновать необходимость новой зависимости и её область применения.
- Не устанавливать, не удалять и не обновлять зависимости без задачи, требующей этого изменения.

### Performance
- Не ухудшать производительность без необходимости и не добавлять существенно большую latency без явной причины.
- Избегать N+1 запросов и минимизировать количество AI-запросов.
- Использовать кэширование там, где это безопасно и не нарушает актуальность данных или tenant isolation.
- При проектировании AI-функций учитывать стоимость выполнения запросов к LLM.

### Git workflow and dirty worktree safety
- Перед изменениями проверять состояние рабочего дерева и сохранять все не относящиеся к задаче изменения.
- Не перезаписывать, не откатывать и не форматировать чужие изменения без явного согласования.
- Не использовать destructive Git-команды и не выполнять commit или push без явного запроса.
- Не объединять несколько независимых задач в одном изменении: каждый change должен решать одну конкретную задачу.
- Перед завершением показывать список затронутых файлов.

### Documentation updates
- Документация является частью реализации. Функция не считается завершённой, если после изменения необходимая документация стала недостоверной.
- При изменении API, environment variables, интеграций, deployment, моделей данных или пользовательского поведения обновлять релевантную документацию в той же задаче.
- Если фактический код расходится с описанием в CLAUDE.md, не копировать устаревшее описание: зафиксировать расхождение и предложить точечное обновление.

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
- **Auth**: NextAuth.js 5 (JWT, 14-day sessions, Credentials + Google OAuth)
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

## Ориентирование в коде

Диаграмму файлового дерева в этом документе НЕ ведём — она устаревает за дни. Актуальную структуру всегда смотреть напрямую в репозитории через `Glob`/`ls`.

Крупные функциональные зоны (кратко, чтобы понимать куда идти):
- `src/app/api/**/route.ts` — все API endpoints (публичные и приватные). Фактическое количество — см. `Glob src/app/api/**/route.ts`.
- `src/app/dashboard/**` — страницы кабинета владельца бизнеса.
- `src/app/admin/**` — админ-панель Staffix.
- `src/app/{login,register,onboarding,checkout,pricing,...}` — публичные страницы и потоки.
- `src/lib/**` — доменная логика: AI, каналы (Telegram/WA/IG/FB), booking/sales tools, CRM, автоматизации, платежи, партнёрская программа.
- `src/lib/telegram/**` — декомпозированный TG-webhook (api, conversation, tools, ai, callbacks, start-handler).
- `src/lib/sales-bot/**` — sales-бот Staffix (не путать с sales mode пользовательского бота).
- `src/components/**` — переиспользуемые React-компоненты.
- `src/contexts/`, `src/hooks/` — React contexts (Language, Theme) и хуки.
- `src/auth.ts` — NextAuth v5 config.
- `src/middleware.ts` — CSRF (Origin required), referral tracking, POST→GET redirect.
- `prisma/schema.prisma` — источник правды по моделям.
- `prisma/migrations/` — применённые миграции.
- `vercel.json` — cron jobs, redirects, headers.

Если нужно точное расположение конкретного файла или количество чего-либо — `Glob`, а не память.

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
| Cron | `/api/cron/*` | Фоновые задачи (см. vercel.json — источник правды) |

## Cron Jobs (Vercel)

Актуальный список — всегда в `vercel.json` (`crons` массив). Ниже — обзор назначений; при расхождении с vercel.json приоритет у vercel.json.

| Job | Интервал | Что делает |
|-----|----------|-----------|
| `/api/cron/broadcasts` | каждые 5 мин | Рассылки клиентам |
| `/api/cron/automations` | каждые 15 мин | Напоминания за 24ч/2ч, отзывы, реактивация |
| `/api/cron/cache-warmer` | каждые 30 мин | Прогрев Anthropic prompt cache (Sonnet + Haiku) в рабочие часы |
| `/api/cron/enrich-catalog` | каждые 30 мин | AI-обогащение описаний товаров/услуг |
| `/api/cron/victor-follow-up` | каждые 30 мин | Проактивный ping от sales-бота Виктора по молчащим лидам |
| `/api/cron/summarize` | каждые 2 часа | AI summarization диалогов |
| `/api/cron/admin-automations` | каждый час | Trial/subscription expiring, messages_low |
| `/api/cron/paypro-reconciliation` | каждый час | Сверка платежей с PayPro |
| `/api/cron/ai-learning` | каждые 6 часов | AI learning и генерация инсайтов |
| `/api/cron/partner-earnings-unlock` | ежедневно 06:00 | Разблокировка партнёрских начислений по истечении holdback |
| `/api/cron/meta-insights` | ежедневно 07:00 | Стягивание Meta ad insights |
| `/api/cron/subscription-reminders` | ежедневно 09:00 | Напоминания об окончании подписок |
| `/api/cron/onboarding-drip` | ежедневно 10:00 | Drip email кампании для новых пользователей |
| `/api/cron/refresh-meta-tokens` | ежедневно 03:00 | Обновление Meta long-lived tokens |
| `/api/cron/insights-weekly` | еженедельно ПН 09:00 | Еженедельные инсайты для владельцев |

---

## Dashboard — смысловые группы

Список конкретных страниц НЕ ведём в этом файле (он устаревает — реальные страницы см. `Glob src/app/dashboard/**/page.tsx`). Здесь только смысловые группы, чтобы понимать «куда идёт какая функция».

- **AI Employee** — настройки бота, каналы (Telegram/WA/IG/FB), FAQ, база знаний, обучение AI, тестирование бота.
- **Компания** — профиль бизнеса, сотрудники и расписания, услуги (Service mode) / товары и склад (Sales mode).
- **Бизнес-операции** — записи и календарь (Service mode) / заказы и доставка (Sales mode), клиенты и их карточки, сообщения, аналитика, рассылки, автоматизации, лояльность, платежи и подписка.
- **Прочее** — CRM-интеграции, настройки аккаунта, тикеты поддержки, уведомления, onboarding checklist.

---

## Ключевые архитектурные решения (НЕ МЕНЯТЬ без обсуждения)

Раздел ограничен политическими решениями — свершившиеся факты (Meta Business Verified, IG подключён и т.п.) сюда не входят, они — статус, а не решение.

**Стек и инфраструктура:**
1. **Vercel (hosting) + Railway (PostgreSQL DB)** — не удалять ни одно из них.
2. **PayPro Global** — основной платёжный процессор.
3. **Anthropic Claude** — AI engine, не менять на OpenAI.
4. **Vercel Blob** — хранилище фото товаров.

**Продуктовые ограничения:**
5. **4 языка** — ru (основной), en, uz, kz.
6. **Service/Sales mode** — два режима дашборда, не объединять.

**Архитектура AI (июль 2026):**
7. **Модели**: основной ответ клиенту — Sonnet 5 (`claude-sonnet-5`), tool-loop итерации — Haiku 4.5 (`claude-haiku-4-5-20251001`). Для Sonnet 5 обязательно `thinking: {type: "disabled"}` в клиент-чатах (иначе adaptive thinking с effort=high выжигает токены).
8. **Prompt caching в три блока**: `stable` (1h TTL — роль, услуги, товары, FAQ, инструкции) + `docs` (5m TTL — только релевантные документы под запрос клиента) + `variable` (5m TTL — клиентский контекст). Порядок обязателен: stable → docs → variable. Cache-warmer греет только `stable`, побайтовое совпадение параметров warmer'а и prod-вызова критично для cache-hit.
9. **AI Memory System (Phase 1)** — реализован в `src/lib/ai-memory.ts`. Любая новая AI-функция должна быть с ним совместима.
10. **Lazy document loading** — документы бизнеса грузятся не все, а через Haiku-матчер (`src/lib/document-matcher.ts`) по полю `Document.description` / `Document.autoDescription`. Файлы без описания грузятся всегда (safety fallback).
11. **Hybrid Sonnet ↔ Haiku routing** — по env `AI_HYBRID_BUSINESS_IDS` (comma-separated ID или `*` для всех). Классификатор определяет SIMPLE/COMPLEX; SIMPLE → Haiku 4.5, COMPLEX → Sonnet 5. Safe default — Sonnet 5 при любой ошибке классификатора.

**Meta / WhatsApp:**
12. **Meta Business Manager**: K-Bridge Co., Ltd. — верифицирован. НИКОГДА не удалять компанию K-BRIDGE из BM.
13. **WhatsApp Embedded Signup** — config_id из Partner Tools (не из Facebook Login for Business).

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

## Демо
- URL: https://staffix.io
- Credentials: demo@staffix.io / PayProDemo2025!

*Roadmap и текущие задачи в этом файле НЕ ведём — они меняются раз в неделю и устаревают быстрее, чем правила. Актуальный статус проекта — git log за последний месяц + auto-memory Claude'а (папка `memory/`).*
