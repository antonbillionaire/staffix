-- Sprint 3, step 1: unify all channels under one Client model.
--
-- Every WA/IG/FB webhook previously created records in the parallel
-- ChannelClient table because Client required a telegramId. That split
-- has caused ~20 findings in the audit: CRM, loyalty, deal pipeline,
-- assigned-manager routing and statistics all skipped non-TG clients.
--
-- This migration is backward-compatible:
--   * telegramId becomes NULLABLE — existing rows keep their id, new
--     WA/IG/FB-only clients can live with telegramId = NULL.
--   * Three new nullable columns hold channel-specific identity.
--   * One unique constraint per channel: (businessId, channelId).
--     PostgreSQL treats NULLs as distinct in UNIQUE by default, so
--     many rows can carry NULL for the columns they don't use.
--
-- No data migration here. A separate script (scripts/backfill-client-channels.mjs,
-- coming next) walks ChannelClient and merges rows into Client by phone/name.
-- Until then the old code paths keep working through ChannelClient.

ALTER TABLE "Client" ALTER COLUMN "telegramId" DROP NOT NULL;

ALTER TABLE "Client" ADD COLUMN "whatsappId"  TEXT;
ALTER TABLE "Client" ADD COLUMN "instagramId" TEXT;
ALTER TABLE "Client" ADD COLUMN "fbPsid"      TEXT;

CREATE UNIQUE INDEX "Client_businessId_whatsappId_key"  ON "Client"("businessId", "whatsappId");
CREATE UNIQUE INDEX "Client_businessId_instagramId_key" ON "Client"("businessId", "instagramId");
CREATE UNIQUE INDEX "Client_businessId_fbPsid_key"      ON "Client"("businessId", "fbPsid");

-- ClientBroadcastDelivery.telegramId also nullable — email delivery to a
-- non-TG client doesn't need a fake bigint 0 placeholder any more.
ALTER TABLE "ClientBroadcastDelivery" ALTER COLUMN "telegramId" DROP NOT NULL;
