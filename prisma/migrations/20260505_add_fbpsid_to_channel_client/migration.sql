-- Add fbPsid column to ChannelClient.
--
-- Why: Facebook PSIDs were ошибочно saved into instagramId.
-- Result: bots couldn't reliably distinguish FB and IG clients of the same
-- business. The right fix is a dedicated column.
--
-- Strategy: just add the column nullable. No automatic data migration,
-- because deciding "is this instagramId actually a FB PSID?" requires the
-- channel context that's not stored on the row reliably (lastChannel can
-- have changed). Existing rows continue to work via channel-memory.ts
-- fallback that checks both fbPsid and instagramId for FB lookups.
--
-- A manual cleanup migration can be run later once we trust the channel
-- attribution data (e.g., via ChannelMessage.channel correlation).

ALTER TABLE "ChannelClient"
  ADD COLUMN IF NOT EXISTS "fbPsid" TEXT;

CREATE INDEX IF NOT EXISTS "ChannelClient_fbPsid_idx"
  ON "ChannelClient"("fbPsid");
