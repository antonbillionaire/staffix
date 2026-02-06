# Staffix Project Context

## Project Overview
Staffix - SaaS платформа для создания AI-сотрудников (чат-ботов) для малого бизнеса.
AI Engine: **Anthropic Claude API** (НЕ ChatGPT/OpenAI!)

## Tech Stack
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Backend: Next.js API Routes, Prisma ORM
- Database: PostgreSQL (Vercel Postgres)
- AI: Anthropic Claude API
- Messaging: Telegram Bot API
- Hosting: Vercel
- Payments: PayPro Global (в процессе интеграции)

## Company Info
- Legal Entity: K-Bridge Co. LTD (South Korea)
- Registration: 606-88-02444
- Target Market: CIS (Kazakhstan, Uzbekistan, Russia)

## Multi-language Support
Поддерживается 4 языка:
- ru (Russian) - основной
- en (English)
- uz (Uzbek)
- kz (Kazakh)

Переводы хранятся в: `src/lib/translations.ts`
Контекст языка: `src/contexts/LanguageContext.tsx`

## Key Features Implemented
1. Landing page с выбором языка
2. Dashboard с полной локализацией
3. AI Employee (бот) настройка
4. CRM для клиентов
5. FAQ и загрузка документов
6. Автоматизации (напоминания, отзывы, реактивация)
7. Аналитика
8. Настройки бизнеса
9. Система подписок (Starter/Pro/Business/Enterprise)

## Pricing Plans
| Plan | Price | Messages/Month |
|------|-------|----------------|
| Starter | $25/mo | 200 |
| Pro | $50/mo | 1,000 |
| Business | $100/mo | 3,000 |
| Enterprise | $200/mo | Unlimited |

## AI Memory System (Фаза 1) - IMPLEMENTED

### Архитектура
```
Клиент пишет → Загрузка контекста из БД → Claude API → Сохранение → Ответ
                     ↓
           ┌─────────────────┐
           │ Client Profile  │ (aiSummary, preferences, tags)
           │ Conversation    │ (summary, topic, extractedInfo)
           │ Business        │ (industryCategory, aiInsights)
           └─────────────────┘
```

### Ключевые файлы AI Memory
- `src/lib/ai-memory.ts` - Библиотека памяти AI
  - `buildClientContext()` - загрузка контекста клиента
  - `buildBusinessContext()` - загрузка контекста бизнеса
  - `buildSystemPrompt()` - генерация промпта с памятью
  - `generateConversationSummary()` - создание саммари
  - `updateClientSummary()` - обновление профиля клиента
- `src/app/api/telegram/webhook/route.ts` - Основной бот webhook
- `src/app/api/cron/summarize/route.ts` - Фоновая задача для summaries

### Новые поля в Prisma Schema
**Client model:**
- `aiSummary` - AI-описание клиента
- `preferences` - JSON с предпочтениями
- `importantNotes` - важные заметки
- `tags` - теги для категоризации
- `totalMessages`, `lastMessageAt` - статистика

**Conversation model:**
- `summary` - краткое содержание разговора
- `topic` - тема (booking, inquiry, complaint)
- `outcome` - результат
- `extractedInfo` - извлечённая информация
- `needsSummary` - флаг для фоновой обработки

**Business model:**
- `industryCategory` - детальная категория
- `city`, `country` - локация
- `averageCheck` - средний чек
- `targetAudience` - целевая аудитория
- `aiInsights` - выученные инсайты

### Cron Jobs
- `/api/cron/summarize` - каждые 2 часа создаёт summaries

## Recent Changes Log

### 2025-01-27 (Session 2)
- **AI Memory System (Phase 1) IMPLEMENTED**
  - Created `src/lib/ai-memory.ts` library
  - Created main bot webhook with memory
  - Added background summarization job
  - Updated Prisma schema with AI fields

### 2025-01-27 (Session 1)
- Added multi-language support to all dashboard pages
- Added language selector to landing page (header)
- Translated ~320 keys across 4 languages
- Fixed PAYPRO_PRODUCT_DESCRIPTION.md: GPT → Claude Anthropic

## Current Status
- Demo ready for PayPro review
- Live at: https://staffix.io
- Demo credentials: demo@staffix.io / PayProDemo2025!
- **AI Memory System: Phase 1 Complete** (needs DB migration)

## TODO / Next Steps
- [x] AI Memory System Phase 1
- [ ] Run Prisma migration on production
- [ ] PayPro integration completion
- [ ] Phase 2: RAG система (100+ пользователей)
- [ ] Phase 3: Fine-tuning (1000+ пользователей)

## Important Files
- `src/app/page.tsx` - Landing page
- `src/app/dashboard/` - All dashboard pages
- `src/lib/translations.ts` - All translations
- `src/lib/ai-memory.ts` - **AI Memory System**
- `src/contexts/LanguageContext.tsx` - Language state
- `prisma/schema.prisma` - Database schema
- `src/app/api/telegram/webhook/route.ts` - **Main bot webhook**

## Notes for Claude
- ALWAYS use Claude/Anthropic references, NEVER ChatGPT/OpenAI
- Maintain Russian as primary language for UI defaults
- Keep code simple and avoid over-engineering
