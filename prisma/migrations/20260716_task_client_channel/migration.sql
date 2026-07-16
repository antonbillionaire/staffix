-- Task: сохраняем канал и ID клиента в канале для построения прямой ссылки
-- на переписку в дашборде из карточки задачи (июль 2026).
-- Оба поля nullable — старые задачи и ручные задачи их не имеют.

ALTER TABLE "Task"
  ADD COLUMN "clientChannel"   TEXT,
  ADD COLUMN "clientChannelId" TEXT;
