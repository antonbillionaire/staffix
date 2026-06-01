-- Admin sanction fields on User. Lets admin block suspicious accounts
-- (competitors probing, spammers, ToS violators) without deleting them —
-- block is reversible, delete is not.
--
-- isBlocked=true → login refused in NextAuth authorize and bot reply
-- suppressed via subscription gate (which already checks the User chain).

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
