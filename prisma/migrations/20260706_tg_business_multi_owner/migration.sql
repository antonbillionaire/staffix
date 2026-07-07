-- Allow multiple TelegramBusinessConnection rows per business — one per person
-- who connected the bot to their personal Telegram (owner + staff members).
-- Before: businessId was UNIQUE, only one connection ever allowed.
-- After:  (businessId, ownerUserId) unique — same person can't connect twice,
--         but different people (owner + N staff) can each have their own row.

-- Drop the old single-connection uniqueness
DROP INDEX IF EXISTS "TelegramBusinessConnection_businessId_key";

-- Add staffId (nullable — null means owner, set means specific staff member)
ALTER TABLE "TelegramBusinessConnection"
  ADD COLUMN IF NOT EXISTS "staffId" TEXT;

-- Composite uniqueness: same person can't have two active connections
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramBusinessConnection_businessId_ownerUserId_key"
  ON "TelegramBusinessConnection"("businessId", "ownerUserId");

-- Index for filtering staff-specific connections
CREATE INDEX IF NOT EXISTS "TelegramBusinessConnection_staffId_idx"
  ON "TelegramBusinessConnection"("staffId");

-- FK to Staff. ON DELETE SET NULL so deleting a staff member doesn't lose
-- the connection row (there may still be active TG-side link even if we
-- remove them internally — we can clean up gracefully later).
ALTER TABLE "TelegramBusinessConnection"
  ADD CONSTRAINT "TelegramBusinessConnection_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
