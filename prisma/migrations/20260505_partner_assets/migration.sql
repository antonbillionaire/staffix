-- Promo-материалы для партнёров (баннеры и шаблоны текстов).
-- Глобальные — видны всем approved партнёрам в их кабинете.

CREATE TABLE IF NOT EXISTS "PartnerAsset" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "content" TEXT,
  "category" TEXT,
  "language" TEXT NOT NULL DEFAULT 'ru',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerAsset_type_isActive_sortOrder_idx"
  ON "PartnerAsset"("type", "isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "PartnerAsset_language_isActive_idx"
  ON "PartnerAsset"("language", "isActive");
