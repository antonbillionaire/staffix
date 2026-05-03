-- Lead → client deal pipeline on Client. Используется во всех бизнесах:
-- услуги, товары, консалтинг, онлайн-школы. Менеджер ведёт клиента по
-- этапам и фиксирует сумму сделки. AI потом сможет автоматически поднимать
-- stage когда видит что клиент записался / купил.
--
-- Допустимые значения dealStage:
--   lead                 — новый клиент, ещё ничего не сделал
--   consultation_booked  — записан на встречу/консультацию/звонок
--   consultation_done    — встреча состоялась, ждём решение клиента
--   client               — стал платящим клиентом (купил/заказал)
--   lost                 — отказался / не вышел на связь / не купил
--
-- Все существующие клиенты остаются на стадии "lead" — менеджер
-- сам двигает их в нужный этап (или дальше это делает AI).

ALTER TABLE "Client"
  ADD COLUMN "dealStage"    TEXT NOT NULL DEFAULT 'lead',
  ADD COLUMN "dealValue"    INTEGER,
  ADD COLUMN "dealClosedAt" TIMESTAMP(3),
  ADD COLUMN "dealNote"     TEXT;

CREATE INDEX "Client_businessId_dealStage_idx" ON "Client"("businessId", "dealStage");
