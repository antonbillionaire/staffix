# Staffix

AI-сотрудник для малого и среднего бизнеса. Берёт на себя рутину фронт-офиса: отвечает клиентам в Telegram / WhatsApp / Instagram / Facebook, ведёт запись, работает с каталогом товаров, обновляет CRM, эскалирует сложные диалоги владельцу.

Официальный сайт: [staffix.io](https://staffix.io)
Юр. лицо: K-Bridge Co., Ltd. (South Korea)
Целевой рынок: СНГ (Казахстан, Узбекистан, Россия)

## Что делает

- **AI-бот на 4 канала** — общий движок для TG / WA / IG / FB, включая Telegram Business API (личные чаты владельца).
- **Два режима работы**: *Service mode* (услуги, записи, календарь) и *Sales mode* (товары, заказы, доставка).
- **AI Memory** — бот помнит клиента, его предпочтения, историю визитов и стиль общения.
- **Автоматизации** — напоминания за 24ч и 2ч до записи, запрос отзыва, реактивация «спящих» клиентов.
- **CRM** — клиенты, задачи, сделки, лиды, интеграции (webhook / Bitrix24 / amoCRM / Google Sheets).
- **Партнёрская программа** — реферальные ссылки, 20% комиссия, автоматические выплаты.
- **Sales-бот Staffix** («Виктор») — собственный AI-менеджер продаж для лидов на сам Staffix.

## Стек

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **ORM**: Prisma 6 + PostgreSQL (Railway)
- **Auth**: NextAuth v5 (Credentials + Google OAuth)
- **AI**: Anthropic Claude (Sonnet 5 + Haiku 4.5, hybrid routing)
- **Speech-to-text**: Groq Whisper (fallback OpenAI Whisper)
- **Email**: Resend
- **Файлы**: Vercel Blob
- **Мониторинг**: Sentry
- **Платежи**: PayPro Global
- **Hosting**: Vercel Pro
- **Тесты**: Vitest

## Запуск локально

Требования: Node.js 20+, npm, доступ к PostgreSQL (можно к prod-БД в Railway или к локальной).

```bash
git clone https://github.com/antonbillionaire/staffix.git
cd staffix
npm install
cp .env.example .env.local
# заполнить .env.local актуальными значениями (DATABASE_URL, ANTHROPIC_API_KEY, ...)
npx prisma generate
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000).

**Не выполнять локально `prisma db push`** — схема управляется миграциями, накатываемыми в `vercel.json` build-скрипте (`prisma migrate deploy`).

## Deployment

- Пуш в `main` → автоматический деплой на Vercel
- Миграции применяются в build-скрипте: `prisma migrate deploy`
- Cron jobs описаны в `vercel.json` (см. Vercel Cron)
- Секреты — только через Vercel Environment Variables

## Тесты

```bash
npm test        # Vitest, unit-тесты в src/lib/__tests__
npx tsc --noEmit -p tsconfig.json  # проверка типов
```

## Контекст для AI-разработчиков

Обязательные правила, архитектурные решения, продуктовые ограничения и полный контекст проекта — в [`.claude/CLAUDE.md`](.claude/CLAUDE.md). Читать перед любым изменением кода.

## Контакты

Владелец: Антон Мельников — anton.v.melnikov@gmail.com
Support: support@staffix.io
