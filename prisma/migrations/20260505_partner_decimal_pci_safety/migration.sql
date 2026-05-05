-- Partner program critical fixes:
--   1. Float → Decimal для всех денежных полей (избежать drift)
--   2. cardNumber → cardLast4 (выйти из PCI-DSS scope)
--   3. UNIQUE на PartnerEarning.payproOrderId (защита от race при дублях webhook)
--
-- Все ALTER COLUMN с явным USING castом — Postgres сам конвертит DOUBLE PRECISION → NUMERIC.
-- Backfill cardLast4 берёт последние 4 цифры из существующих cardNumber, потом колонка дропается.

BEGIN;

-- 1. Partner: Float → Decimal на всех money-полях
ALTER TABLE "Partner"
  ALTER COLUMN "commissionRate"  TYPE DECIMAL(5, 4)  USING "commissionRate"::DECIMAL(5, 4),
  ALTER COLUMN "totalEarnings"   TYPE DECIMAL(12, 2) USING "totalEarnings"::DECIMAL(12, 2),
  ALTER COLUMN "totalPaid"       TYPE DECIMAL(12, 2) USING "totalPaid"::DECIMAL(12, 2),
  ALTER COLUMN "pendingPayout"   TYPE DECIMAL(12, 2) USING "pendingPayout"::DECIMAL(12, 2),
  ALTER COLUMN "minPayoutAmount" TYPE DECIMAL(12, 2) USING "minPayoutAmount"::DECIMAL(12, 2);

-- 2. PartnerEarning: Float → Decimal
ALTER TABLE "PartnerEarning"
  ALTER COLUMN "commissionAmount" TYPE DECIMAL(12, 2) USING "commissionAmount"::DECIMAL(12, 2),
  ALTER COLUMN "paymentAmount"    TYPE DECIMAL(12, 2) USING "paymentAmount"::DECIMAL(12, 2);

-- 3. PartnerPayout: Float → Decimal
ALTER TABLE "PartnerPayout"
  ALTER COLUMN "amount" TYPE DECIMAL(12, 2) USING "amount"::DECIMAL(12, 2);

-- 4. Partner.cardNumber → cardLast4 (backfill последние 4 цифры, потом drop full PAN)
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "cardLast4" TEXT;

UPDATE "Partner"
SET "cardLast4" = RIGHT(REGEXP_REPLACE("cardNumber", '\D', '', 'g'), 4)
WHERE "cardNumber" IS NOT NULL AND "cardLast4" IS NULL;

ALTER TABLE "Partner" DROP COLUMN IF EXISTS "cardNumber";

-- 5. PartnerPayout.recipientCardNumber → recipientCardLast4
ALTER TABLE "PartnerPayout" ADD COLUMN IF NOT EXISTS "recipientCardLast4" TEXT;

UPDATE "PartnerPayout"
SET "recipientCardLast4" = RIGHT(REGEXP_REPLACE("recipientCardNumber", '\D', '', 'g'), 4)
WHERE "recipientCardNumber" IS NOT NULL AND "recipientCardLast4" IS NULL;

ALTER TABLE "PartnerPayout" DROP COLUMN IF EXISTS "recipientCardNumber";

-- 6. UNIQUE на payproOrderId (race-safe idempotency).
-- Старый non-unique индекс заменяется на unique. Если в данных уже есть дубли —
-- migrate упадёт здесь, и нужно будет вручную дочистить (на dev этого нет).
DROP INDEX IF EXISTS "PartnerEarning_payproOrderId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerEarning_payproOrderId_key"
  ON "PartnerEarning"("payproOrderId");

COMMIT;
