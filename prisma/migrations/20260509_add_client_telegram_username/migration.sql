-- Add telegramUsername column to Client.
--
-- Why: We capture message.from.username in the Telegram webhook (it's already
-- in the Activity Log payload), but never persist it on the Client row. As a
-- result, business owners see "Клиент" without @handle in /dashboard/customers,
-- even though the bot has the username. This column lets us display @handle
-- next to a client's name (like /admin/sales-leads already does for Виктор).
--
-- The webhook updates this on every message — Telegram users can change their
-- handle, so we always overwrite with the latest value.

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "telegramUsername" TEXT;
