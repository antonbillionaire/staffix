-- Fix #11: Add onDelete: SetNull on Booking.serviceId
-- Drop existing FK and recreate with ON DELETE SET NULL
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_serviceId_fkey";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix #12: Add onDelete: SetNull on Booking.staffId
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_staffId_fkey";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix #16: Add index on (staffId, date) in Booking
CREATE INDEX IF NOT EXISTS "Booking_staffId_date_idx" ON "Booking"("staffId", "date");

-- Fix #17: Add index on (businessId, clientTelegramId, date) in Booking
CREATE INDEX IF NOT EXISTS "Booking_businessId_clientTelegramId_date_idx" ON "Booking"("businessId", "clientTelegramId", "date");
