-- M19: separate "unsubscribed from marketing" (isBlocked) from
-- "bot must stop replying" (botMuted). Previously one flag pretended to
-- do both; only the mailing side worked. New column defaults to false so
-- existing clients keep receiving bot replies exactly as before.
ALTER TABLE "Client" ADD COLUMN "botMuted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChannelClient" ADD COLUMN "botMuted" BOOLEAN NOT NULL DEFAULT false;
