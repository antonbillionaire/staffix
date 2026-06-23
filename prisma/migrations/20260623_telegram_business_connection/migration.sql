-- Telegram Business API connection — бот в личных чатах владельца.
-- См. doc-комментарий к model TelegramBusinessConnection в schema.prisma.
-- Связан с Business 1-к-1 через businessId (UNIQUE), удаляется каскадом.

CREATE TABLE "TelegramBusinessConnection" (
  "id"            TEXT NOT NULL,
  "connectionId"  TEXT NOT NULL,
  "ownerUserId"   BIGINT NOT NULL,
  "ownerChatId"   BIGINT NOT NULL,
  "canReply"      BOOLEAN NOT NULL DEFAULT false,
  "isEnabled"     BOOLEAN NOT NULL DEFAULT true,
  "pausedByOwner" BOOLEAN NOT NULL DEFAULT false,
  "connectedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastEventAt"   TIMESTAMP(3),
  "businessId"    TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TelegramBusinessConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramBusinessConnection_connectionId_key"
  ON "TelegramBusinessConnection"("connectionId");

CREATE UNIQUE INDEX "TelegramBusinessConnection_businessId_key"
  ON "TelegramBusinessConnection"("businessId");

CREATE INDEX "TelegramBusinessConnection_ownerUserId_idx"
  ON "TelegramBusinessConnection"("ownerUserId");

ALTER TABLE "TelegramBusinessConnection"
  ADD CONSTRAINT "TelegramBusinessConnection_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
