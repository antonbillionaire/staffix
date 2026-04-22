-- Add staff (seller) assignment to orders
ALTER TABLE "Order" ADD COLUMN "staffId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_staffId_idx" ON "Order"("staffId");

-- Add assigned staff to clients (from seller referral link)
ALTER TABLE "Client" ADD COLUMN "assignedStaffId" TEXT;
