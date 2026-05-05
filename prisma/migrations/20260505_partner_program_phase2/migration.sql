-- Phase 2 партнёрской программы: hold-период + batch выплаты + cancelled статус.
--
-- Изменения PartnerEarning:
--   1. availableAt — когда earning становится доступен для выплаты (createdAt + 30 days)
--   2. cancelledReason — причина если status='cancelled' (refund/chargeback/manual)
--   3. payoutId — FK на новую таблицу PartnerPayout, заполняется при включении в batch
--
-- Новая таблица PartnerPayout — одна строка = один банковский перевод партнёру
-- за период (обычно месяц), включает несколько earning-записей.
--
-- Backfill для существующих earnings: ставим availableAt = createdAt + 30 days,
-- чтобы они либо стали available при следующем cron-tick'е (если им уже >30 дней),
-- либо остались pending до конца hold-периода.

BEGIN;

-- 1. Добавить поля в PartnerEarning
ALTER TABLE "PartnerEarning"
  ADD COLUMN IF NOT EXISTS "availableAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutId" TEXT;

-- 2. Backfill availableAt = createdAt + 30 days для всех existing записей
UPDATE "PartnerEarning"
   SET "availableAt" = "createdAt" + INTERVAL '30 days'
 WHERE "availableAt" IS NULL;

-- 3. Создать таблицу PartnerPayout
CREATE TABLE IF NOT EXISTS "PartnerPayout" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "partnerId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "periodLabel" TEXT,
  "paymentMethod" TEXT NOT NULL DEFAULT 'card',
  "reference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidByEmail" TEXT,
  "notes" TEXT,
  "recipientCardNumber" TEXT,
  "recipientCardHolder" TEXT,
  "recipientBankName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. FK + indexes
ALTER TABLE "PartnerPayout"
  ADD CONSTRAINT "PartnerPayout_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerEarning"
  ADD CONSTRAINT "PartnerEarning_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "PartnerEarning_status_availableAt_idx"
  ON "PartnerEarning"("status", "availableAt");

CREATE INDEX IF NOT EXISTS "PartnerEarning_payoutId_idx"
  ON "PartnerEarning"("payoutId");

CREATE INDEX IF NOT EXISTS "PartnerPayout_partnerId_paidAt_idx"
  ON "PartnerPayout"("partnerId", "paidAt");

CREATE INDEX IF NOT EXISTS "PartnerPayout_paidAt_idx"
  ON "PartnerPayout"("paidAt");

COMMIT;
