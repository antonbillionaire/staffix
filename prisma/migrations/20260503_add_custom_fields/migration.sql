-- Custom fields on Client — собственные поля бизнеса (например, у салона
-- "Дата рождения", у автосервиса "Госномер машины", у юриста "Номер договора").
-- Конфигурация полей хранится на Business, значения — на Client.

ALTER TABLE "Business"
  ADD COLUMN "clientFieldsConfig" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Client"
  ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';
