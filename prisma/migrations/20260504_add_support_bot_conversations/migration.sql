-- Persist conversations with @staffix_support_bot to the database.
-- Previously history was kept in an in-memory Map which was lost on every
-- cold start of the Vercel function — the bot forgot context every few
-- minutes. Storing in DB also lets us review all support inquiries for
-- prompt-tuning and admin audit.

CREATE TABLE "SupportBotConversation" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "telegramChatId"  BIGINT       NOT NULL,
  "telegramUserId"  BIGINT,
  "username"        TEXT,
  "firstName"       TEXT,
  "lastName"        TEXT,
  "language"        TEXT,
  "userId"          TEXT,
  "lastMessageAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "SupportBotConversation_telegramChatId_key"
  ON "SupportBotConversation"("telegramChatId");
CREATE INDEX "SupportBotConversation_lastMessageAt_idx"
  ON "SupportBotConversation"("lastMessageAt");
CREATE INDEX "SupportBotConversation_userId_idx"
  ON "SupportBotConversation"("userId");

CREATE TABLE "SupportBotMessage" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "role"            TEXT         NOT NULL,
  "content"         TEXT         NOT NULL,
  "conversationId"  TEXT         NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportBotMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "SupportBotConversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SupportBotMessage_conversationId_createdAt_idx"
  ON "SupportBotMessage"("conversationId", "createdAt");
