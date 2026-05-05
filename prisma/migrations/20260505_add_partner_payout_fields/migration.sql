-- Add fields for partner payout management.
-- Подготовка к Phase 1 партнёрской программы — админ-страница и кабинет партнёра.
--
-- Поля:
-- - cardNumber/cardHolder/bankName/payoutNotes — реквизиты выплат на карту
-- - adminNotes — внутренние заметки админа (партнёру невидимы)
-- - agreementSignedAt — флаг что партнёрское соглашение подписано (gate для выплат)
-- - minPayoutAmount — порог выплаты в долларах (по умолчанию 50)
--
-- Все поля nullable / с default-значениями — миграция безопасна на live данных.

ALTER TABLE "Partner"
  ADD COLUMN IF NOT EXISTS "minPayoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "cardNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "cardHolder" TEXT,
  ADD COLUMN IF NOT EXISTS "bankName" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "adminNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "agreementSignedAt" TIMESTAMP(3);
