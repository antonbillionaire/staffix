-- Стадия воронки и известные факты как СОСТОЯНИЕ диалога (Этап 4 research-плана,
-- 17 сентября 2026).
--
-- До этой миграции стадия воронки нигде не хранилась: модель определяла её
-- заново на каждом обороте, вчитываясь в историю. Одно неудачное сообщение —
-- и бот откатывался на «чем могу помочь». Семь стадий подробно описаны в
-- `prompts/funnel-rules.ts` (530 строк), но исполнения этого описания не было:
-- инструкция на стене, а не процесс.
--
-- funnelStage           — 1..7, ровно те же стадии что в funnel-rules.ts.
--                         Новых не выдумываем. Дефолт 1 (приветствие).
-- funnelStageUpdatedAt  — когда стадия менялась последний раз. Нужно progress
--                         guard'у: если стадия стоит несколько оборотов, бот
--                         топчется и тактику надо менять.
-- knownFacts            — что уже выяснено у клиента: чего хочет, для кого,
--                         бюджет, телефон, какие возражения были, что уже
--                         предлагали. Лекарство от «переспрашивает выясненное».
--
-- Обратная совместимость: все три колонки со значением по умолчанию либо
-- nullable, старый код их не читает и не пишет. Существующие диалоги остаются
-- на стадии 1 — переразмечать историю задним числом нечем и незачем:
-- состояние наберётся на живых оборотах.

ALTER TABLE "Conversation" ADD COLUMN "funnelStage" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Conversation" ADD COLUMN "funnelStageUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "knownFacts" JSONB;

ALTER TABLE "ChannelConversation" ADD COLUMN "funnelStage" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChannelConversation" ADD COLUMN "funnelStageUpdatedAt" TIMESTAMP(3);
ALTER TABLE "ChannelConversation" ADD COLUMN "knownFacts" JSONB;
