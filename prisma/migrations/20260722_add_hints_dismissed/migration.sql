-- Onboarding contextual banners (22 июля 2026):
-- храним какие page-hints владелец скрыл вручную через «Понятно, скрыть».
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "hintsDismissed" TEXT[] NOT NULL DEFAULT '{}';
