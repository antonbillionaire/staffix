-- AI Learning: extend ChannelClient with memory fields
ALTER TABLE "ChannelClient" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE "ChannelClient" ADD COLUMN IF NOT EXISTS "preferences" JSONB;
ALTER TABLE "ChannelClient" ADD COLUMN IF NOT EXISTS "importantNotes" TEXT;
ALTER TABLE "ChannelClient" ADD COLUMN IF NOT EXISTS "communicationStyle" TEXT;
ALTER TABLE "ChannelClient" ADD COLUMN IF NOT EXISTS "totalVisits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChannelClient" ADD COLUMN IF NOT EXISTS "lastVisitDate" TIMESTAMP(3);
ALTER TABLE "ChannelClient" ADD COLUMN IF NOT EXISTS "summaryUpdatedAt" TIMESTAMP(3);

-- AI Learning: extend ChannelConversation with summary fields
ALTER TABLE "ChannelConversation" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "ChannelConversation" ADD COLUMN IF NOT EXISTS "topic" TEXT;
ALTER TABLE "ChannelConversation" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "ChannelConversation" ADD COLUMN IF NOT EXISTS "needsSummary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChannelConversation" ADD COLUMN IF NOT EXISTS "extractedInfo" JSONB;

CREATE INDEX IF NOT EXISTS "ChannelConversation_needsSummary_idx" ON "ChannelConversation"("needsSummary");

-- AI Learning: BotCorrection table
CREATE TABLE IF NOT EXISTS "BotCorrection" (
    "id" TEXT NOT NULL,
    "originalQuestion" TEXT NOT NULL,
    "wrongAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotCorrection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BotCorrection_businessId_isActive_idx" ON "BotCorrection"("businessId", "isActive");
ALTER TABLE "BotCorrection" ADD CONSTRAINT "BotCorrection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AI Learning: AiInsight table
CREATE TABLE IF NOT EXISTS "AiInsight" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiInsight_businessId_status_idx" ON "AiInsight"("businessId", "status");
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
