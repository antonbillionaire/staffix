-- hidePoweredBy was a Pro+ feature flag for hiding a "— staffix.io" footer
-- from bot replies. The footer itself was disabled in channel-ai.ts back in
-- June 2026 (Anton's call — looked like leftover template branding inside
-- the client's own bot). Since there is no footer to hide, the flag is a
-- dead promise. Drop it.
ALTER TABLE "Business" DROP COLUMN IF EXISTS "hidePoweredBy";
