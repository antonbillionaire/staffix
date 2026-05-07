-- Журнал активности бота для каждого бизнеса.
-- Видит только владелец своего бизнеса через /dashboard/activity.

CREATE TABLE IF NOT EXISTS "BusinessActivityLog" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "severity"   TEXT NOT NULL DEFAULT 'info',
  "summary"    TEXT NOT NULL,
  "technical"  JSONB,
  "channel"    TEXT,
  "clientId"   TEXT,
  "staffId"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BusinessActivityLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessActivityLog_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Основной индекс для UI: список по бизнесу, отсортированный desc по дате
CREATE INDEX IF NOT EXISTS "BusinessActivityLog_businessId_createdAt_idx"
  ON "BusinessActivityLog"("businessId", "createdAt" DESC);

-- Фильтр по типу события
CREATE INDEX IF NOT EXISTS "BusinessActivityLog_businessId_type_createdAt_idx"
  ON "BusinessActivityLog"("businessId", "type", "createdAt" DESC);

-- Фильтр по severity (только ошибки и т.д.)
CREATE INDEX IF NOT EXISTS "BusinessActivityLog_businessId_severity_createdAt_idx"
  ON "BusinessActivityLog"("businessId", "severity", "createdAt" DESC);
