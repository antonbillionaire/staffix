-- Sales-mode businesses (онлайн-школы, консалтинг, коучи) часто закрывают
-- сделку через бесплатную консультацию: AI должен уметь и принять заказ,
-- и записать клиента на встречу. Флаг разрешает в sales-режиме давать AI
-- booking-инструменты дополнительно к sales-tools. Default false — обычные
-- магазины ничего не теряют.

ALTER TABLE "Business"
  ADD COLUMN "consultationsEnabled" BOOLEAN NOT NULL DEFAULT false;
