-- Sprint Widget (21 июля 2026): кастомизация виджета для сайта клиента
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "widgetColor" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "widgetPosition" TEXT NOT NULL DEFAULT 'br';
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "widgetIcon" TEXT NOT NULL DEFAULT 'chat';
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "widgetCustomImageUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "widgetGreeting" TEXT;
