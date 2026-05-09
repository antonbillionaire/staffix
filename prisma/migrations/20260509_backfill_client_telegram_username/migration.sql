-- One-shot backfill of Client.telegramUsername from BusinessActivityLog.
--
-- Webhook entries logged since 2026-05-08 (when activity log launched) carry
-- technical.username — the Telegram @handle Meta saw at that moment. We pick
-- the most recent handle per (businessId, telegramId) pair and copy it onto
-- Client rows that still have telegramUsername NULL.
--
-- Idempotent: re-running won't overwrite handles already set (whether from
-- this backfill or from a fresh webhook). Older clients without any activity
-- log entry stay NULL — they'll get a handle when they next message the bot.

UPDATE "Client" c
SET "telegramUsername" = sub.username
FROM (
  SELECT DISTINCT ON ("businessId", (technical->>'telegramId'))
    "businessId",
    (technical->>'telegramId')::bigint AS telegram_id,
    technical->>'username' AS username
  FROM "BusinessActivityLog"
  WHERE type = 'message_received'
    AND channel = 'telegram'
    AND technical->>'username' IS NOT NULL
    AND technical->>'username' <> ''
  ORDER BY "businessId", (technical->>'telegramId'), "createdAt" DESC
) sub
WHERE c."businessId" = sub."businessId"
  AND c."telegramId" = sub.telegram_id
  AND c."telegramUsername" IS NULL;
