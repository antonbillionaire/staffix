-- Lead distribution between managers — main pain for businesses with
-- a team of 2-5 people: leads come into the AI bot and disappear unless
-- someone manually claims them.
--
-- leadAssignmentMode on Business:
--   manual       — никого не назначаем автоматически (текущее поведение)
--   round_robin  — по очереди следующему сотруднику с acceptsLeads=true
--   by_load      — кому меньше открытых задач + клиентов в активных стадиях
--
-- lastAssignedStaffId — указатель для round-robin, чтобы помнить очередь
-- между запусками (без него после рестарта мы бы зацикливались на первом).
--
-- Staff.acceptsLeads — флаг "сотрудник в ротации". Default true: новый
-- сотрудник сразу получает лидов. Владелец может выключить для отпуска /
-- стажёра / админа.

ALTER TABLE "Business"
  ADD COLUMN "leadAssignmentMode"  TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "lastAssignedStaffId" TEXT;

ALTER TABLE "Staff"
  ADD COLUMN "acceptsLeads" BOOLEAN NOT NULL DEFAULT true;
