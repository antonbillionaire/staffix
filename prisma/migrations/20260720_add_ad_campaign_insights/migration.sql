-- Sprint 4D (M18): Meta Ad Insights для владельца бизнеса

-- Business.fbAdAccountId — вводится вручную в настройках; nullable.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "fbAdAccountId" TEXT;

-- AdCampaignInsight — дневной снапшот кампании.
CREATE TABLE IF NOT EXISTS "AdCampaignInsight" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'meta',
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT,
    "ctr" DOUBLE PRECISION,
    "cpl" DOUBLE PRECISION,
    "attributedLeads" INTEGER NOT NULL DEFAULT 0,
    "attributedClients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdCampaignInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdCampaignInsight_businessId_campaignId_date_key"
  ON "AdCampaignInsight"("businessId", "campaignId", "date");

CREATE INDEX IF NOT EXISTS "AdCampaignInsight_businessId_date_idx"
  ON "AdCampaignInsight"("businessId", "date");

ALTER TABLE "AdCampaignInsight"
  ADD CONSTRAINT "AdCampaignInsight_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
