-- Add follow-up tracking to SalesLead.
-- Cron /api/cron/victor-follow-up uses these fields to decide when Victor
-- (Staffix sales bot) sends a gentle nudge to a warm lead who went quiet
-- after his question. Cap on nudgeCount prevents spam.

ALTER TABLE "SalesLead"
  ADD COLUMN IF NOT EXISTS "lastNudgeAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nudgeCount"  INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "SalesLead_nudgeCount_updatedAt_idx"
  ON "SalesLead"("nudgeCount", "updatedAt");
