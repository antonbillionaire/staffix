-- Add needsContextRefresh flag to Conversation and ChannelConversation
-- Used to trim conversation history when knowledge base (FAQ / documents /
-- services / products) is updated, so new info isn't overridden by old answers.

ALTER TABLE "Conversation"
  ADD COLUMN "needsContextRefresh" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ChannelConversation"
  ADD COLUMN "needsContextRefresh" BOOLEAN NOT NULL DEFAULT false;
