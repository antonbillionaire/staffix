-- Silent-follow-up nudge tracking (28 июля 2026)
--
-- Cron client-bot-follow-up шлёт ОДИН мягкий follow-up когда бот задал
-- вопрос, а клиент не ответил в течение ~45 минут. nudgeCount ≥ 1 →
-- диалог помечен как "уже тревожили" и больше не берётся в выборку.
--
-- Additive-safe: DEFAULT 0 покрывает все существующие записи, nudgeSentAt
-- nullable — старые диалоги останутся без даты.

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "nudgeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nudgeSentAt" TIMESTAMP(3);

ALTER TABLE "ChannelConversation"
  ADD COLUMN IF NOT EXISTS "nudgeCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nudgeSentAt" TIMESTAMP(3);
