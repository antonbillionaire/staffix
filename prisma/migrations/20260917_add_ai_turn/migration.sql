-- AI-телеметрия оборота (17 сентября 2026, Этап 1 research-плана).
--
-- Одна строка на оборот бота: входящее клиента → исходящее бота, включая весь
-- tool-loop. До этой таблицы разложить расход и поведение по диалогу / модели /
-- клиенту было невозможно: trackClaudeUsage() пишет кумулятивные счётчики на
-- Business, а какая модель отвечала — видно только в эфемерных логах Vercel.
--
-- Внешних ключей намеренно нет: удаление бизнеса не должно каскадом тянуть
-- миллионы строк телеметрии. Чистка — отдельной задачей, когда объём вырастет.

CREATE TABLE "AiTurn" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "conversationKey" TEXT NOT NULL,
    "clientRef" TEXT,
    "model" TEXT NOT NULL,
    "complexity" TEXT,
    "salesMode" BOOLEAN NOT NULL DEFAULT false,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheRead" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheCreate" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6),
    "latencyMs" INTEGER NOT NULL,
    "iterations" INTEGER NOT NULL DEFAULT 0,
    "toolsCalled" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recoveryUsed" BOOLEAN NOT NULL DEFAULT false,
    "safetyNetFired" TEXT,
    "emptyResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiTurn_businessId_createdAt_idx" ON "AiTurn"("businessId", "createdAt");
CREATE INDEX "AiTurn_businessId_model_idx" ON "AiTurn"("businessId", "model");
CREATE INDEX "AiTurn_conversationKey_idx" ON "AiTurn"("conversationKey");
