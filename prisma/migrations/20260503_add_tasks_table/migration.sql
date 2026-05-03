-- Tasks for managers — manual + AI-auto-created.
-- Главная боль малого бизнеса по фидбэку amoCRM: менеджеры теряют лидов
-- потому что забывают перезвонить. Эта таблица — "мои задачи на сегодня"
-- в дашборде. AI пишет сюда задачу когда передаёт диалог человеку
-- (notify_manager), менеджер может создать руками для любого клиента.

CREATE TABLE "Task" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "businessId"      TEXT         NOT NULL,
  "assignedStaffId" TEXT,
  "clientId"        TEXT,
  "title"           TEXT         NOT NULL,
  "description"     TEXT,
  "dueAt"           TIMESTAMP(3),
  "priority"        TEXT         NOT NULL DEFAULT 'normal',
  "status"          TEXT         NOT NULL DEFAULT 'pending',
  "createdBy"       TEXT,
  "completedAt"     TIMESTAMP(3),
  "completedBy"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Task_businessId_status_dueAt_idx"           ON "Task"("businessId", "status", "dueAt");
CREATE INDEX "Task_businessId_assignedStaffId_status_idx" ON "Task"("businessId", "assignedStaffId", "status");
CREATE INDEX "Task_clientId_idx"                          ON "Task"("clientId");
