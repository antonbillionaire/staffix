-- ============================================================
-- FINANCES (Salaries for staff)
-- ============================================================

-- Add salary fields to Staff
ALTER TABLE "Staff" ADD COLUMN "baseRate" INTEGER;
ALTER TABLE "Staff" ADD COLUMN "commissionPercent" DOUBLE PRECISION;

-- Finance transactions (bonuses, fines, payouts, adjustments)
CREATE TABLE "FinanceTransaction" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "businessId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceTransaction_staffId_createdAt_idx" ON "FinanceTransaction"("staffId", "createdAt");
CREATE INDEX "FinanceTransaction_businessId_type_createdAt_idx" ON "FinanceTransaction"("businessId", "type", "createdAt");

ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- SERVICE PACKAGES
-- ============================================================

-- Add autoAddServiceIds to Service
ALTER TABLE "Service" ADD COLUMN "autoAddServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Service Package
CREATE TABLE "ServicePackage" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "discountType" TEXT NOT NULL DEFAULT 'percent',
  "discountPercent" DOUBLE PRECISION,
  "fixedPrice" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "autoSuggest" BOOLEAN NOT NULL DEFAULT true,
  "businessId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServicePackage_businessId_isActive_idx" ON "ServicePackage"("businessId", "isActive");

ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Service Package Items
CREATE TABLE "ServicePackageItem" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ServicePackageItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServicePackageItem_packageId_serviceId_key" ON "ServicePackageItem"("packageId", "serviceId");
CREATE INDEX "ServicePackageItem_packageId_idx" ON "ServicePackageItem"("packageId");

ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Service Incompatibilities
CREATE TABLE "ServiceIncompatibility" (
  "id" TEXT NOT NULL,
  "serviceAId" TEXT NOT NULL,
  "serviceBId" TEXT NOT NULL,
  "cooldownDays" INTEGER NOT NULL DEFAULT 7,
  "bidirectional" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "businessId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceIncompatibility_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceIncompatibility_businessId_idx" ON "ServiceIncompatibility"("businessId");
CREATE INDEX "ServiceIncompatibility_serviceAId_idx" ON "ServiceIncompatibility"("serviceAId");
CREATE INDEX "ServiceIncompatibility_serviceBId_idx" ON "ServiceIncompatibility"("serviceBId");

ALTER TABLE "ServiceIncompatibility" ADD CONSTRAINT "ServiceIncompatibility_serviceAId_fkey" FOREIGN KEY ("serviceAId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceIncompatibility" ADD CONSTRAINT "ServiceIncompatibility_serviceBId_fkey" FOREIGN KEY ("serviceBId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceIncompatibility" ADD CONSTRAINT "ServiceIncompatibility_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- BOOKING: link to package
-- ============================================================
ALTER TABLE "Booking" ADD COLUMN "servicePackageId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "packageGroupId" TEXT;

CREATE INDEX "Booking_packageGroupId_idx" ON "Booking"("packageGroupId");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_servicePackageId_fkey" FOREIGN KEY ("servicePackageId") REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
