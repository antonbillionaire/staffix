-- Sprint 4E (M28): Loyalty Ledger — история движений баллов
CREATE TABLE IF NOT EXISTS "LoyaltyLedger" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "relatedId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoyaltyLedger_businessId_clientId_createdAt_idx"
  ON "LoyaltyLedger"("businessId", "clientId", "createdAt");

CREATE INDEX IF NOT EXISTS "LoyaltyLedger_businessId_createdAt_idx"
  ON "LoyaltyLedger"("businessId", "createdAt");

ALTER TABLE "LoyaltyLedger"
  ADD CONSTRAINT "LoyaltyLedger_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyLedger"
  ADD CONSTRAINT "LoyaltyLedger_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
