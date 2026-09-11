-- Unread tracking для страницы «Мои сообщения» (11 сент 2026, Anton):
-- менеджеры не понимали в каких диалогах есть новое от клиента, а какие
-- уже отработаны. Добавляем `lastReadByOwnerAt` — временную метку когда
-- владелец / менеджер последний раз открыл этот диалог в дашборде.
--
-- Логика в API:
--   unread = updatedAt > lastReadByOwnerAt  (или lastReadByOwnerAt IS NULL)
--
-- Для существующих conversations выставляем lastReadByOwnerAt = updatedAt —
-- чтобы после деплоя все старые диалоги считались «прочитанными» и не
-- заваливали менеджера пометками красной точки на всю ленту.

ALTER TABLE "Conversation" ADD COLUMN "lastReadByOwnerAt" TIMESTAMP(3);
ALTER TABLE "ChannelConversation" ADD COLUMN "lastReadByOwnerAt" TIMESTAMP(3);

UPDATE "Conversation" SET "lastReadByOwnerAt" = "updatedAt";
UPDATE "ChannelConversation" SET "lastReadByOwnerAt" = "updatedAt";
