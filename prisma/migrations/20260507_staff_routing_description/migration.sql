-- AI smart routing: добавляем поле для описания специализации каждого сотрудника.
-- Используется когда Business.leadAssignmentMode = 'ai_smart'. AI читает описания
-- команды + направляет клиента в нужного специалиста по контексту разговора.
--
-- Nullable — существующие staff не затронуты. Если поле пусто — staff не
-- участвует в AI-роутинге, но обычные функции (бронирования, уведомления) работают.

ALTER TABLE "Staff"
  ADD COLUMN IF NOT EXISTS "routingDescription" TEXT;
