-- Add performance indexes for frequently queried columns

-- Subscription: filter by plan+expiry (admin analytics, cron jobs)
CREATE INDEX "Subscription_plan_expiresAt_idx" ON "Subscription"("plan", "expiresAt");

-- Subscription: filter by status+expiry (active/expired lookups)
CREATE INDEX "Subscription_status_expiresAt_idx" ON "Subscription"("status", "expiresAt");

-- ChannelMessage: filter by business+date (message history, analytics)
CREATE INDEX "ChannelMessage_businessId_createdAt_idx" ON "ChannelMessage"("businessId", "createdAt");
