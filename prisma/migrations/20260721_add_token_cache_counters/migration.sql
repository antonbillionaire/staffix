-- Шаг 1 плана оптимизации себестоимости (21 июля 2026):
-- добавляем счётчики токенов кэша чтобы client-cost-report.mjs считал
-- полную цену без вилки. Раньше эти токены были "невидимыми".
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "tokensCacheRead" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "tokensCacheCreate" INTEGER NOT NULL DEFAULT 0;
