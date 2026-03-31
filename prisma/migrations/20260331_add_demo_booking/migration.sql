-- Demo booking table for Staffix sales bot
CREATE TABLE "DemoBooking" (
    "id" TEXT NOT NULL,
    "salesLeadId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactTelegram" TEXT,
    "contactWhatsapp" TEXT,
    "businessName" TEXT,
    "businessType" TEXT,
    "businessAddress" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoBooking_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "DemoBooking_scheduledAt_idx" ON "DemoBooking"("scheduledAt");
CREATE INDEX "DemoBooking_status_idx" ON "DemoBooking"("status");

-- Foreign key
ALTER TABLE "DemoBooking" ADD CONSTRAINT "DemoBooking_salesLeadId_fkey" FOREIGN KEY ("salesLeadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
