-- Partner commission tracking: добавляем payproOrderId на PartnerEarning
-- чтобы при refund/chargeback точно сопоставить earning с возвращённым платежом.

ALTER TABLE "PartnerEarning"
  ADD COLUMN IF NOT EXISTS "payproOrderId" TEXT;

CREATE INDEX IF NOT EXISTS "PartnerEarning_payproOrderId_idx"
  ON "PartnerEarning"("payproOrderId");
