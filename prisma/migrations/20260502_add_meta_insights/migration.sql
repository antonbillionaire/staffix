-- Meta-insights for Staffix admin (Anton): cross-business signals,
-- system health alerts, escalation patterns. Daily cron writes here,
-- /admin/meta-insights renders cards from this table.

CREATE TABLE "MetaInsight" (
  "id"          TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "severity"    TEXT NOT NULL DEFAULT 'info',
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "data"        JSONB,
  "businessId"  TEXT,
  "status"      TEXT NOT NULL DEFAULT 'new',
  "resolvedAt"  TIMESTAMP(3),
  "resolvedBy"  TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MetaInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetaInsight_status_severity_idx"
  ON "MetaInsight"("status", "severity");

CREATE INDEX "MetaInsight_type_createdAt_idx"
  ON "MetaInsight"("type", "createdAt");

CREATE INDEX "MetaInsight_businessId_idx"
  ON "MetaInsight"("businessId");

ALTER TABLE "MetaInsight"
  ADD CONSTRAINT "MetaInsight_businessId_fkey"
  FOREIGN KEY ("businessId")
  REFERENCES "Business"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
