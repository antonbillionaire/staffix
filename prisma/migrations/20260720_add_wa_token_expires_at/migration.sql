-- WhatsApp Cloud API long-lived tokens live ~60 days. Until now no cron
-- refreshed them, so any bot connected via Embedded Signup would silently
-- go dark ~60 days later. Add an expiry timestamp so refresh-meta-tokens
-- cron can pick them up.
ALTER TABLE "Business" ADD COLUMN "waTokenExpiresAt" TIMESTAMP(3);
