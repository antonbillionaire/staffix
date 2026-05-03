-- Email-channel for client broadcasts. Telegram-only рассылки уже работают;
-- эта миграция добавляет вторую дорожку для бизнесов с email-базой
-- (онлайн-школы, B2B). Resend уже подключён — логика отправки в коде.
--
-- channel на ClientBroadcast: telegram | email | both.
-- channel на ClientBroadcastDelivery: telegram | email — конкретный канал
-- этой доставки (нужен когда broadcast=both, каждой подписке свой канал).
-- email — snapshot адреса на момент отправки (если клиент потом сменит — в
-- логе остаётся куда реально ушло).
--
-- Client.marketingUnsubscribed + unsubscribeToken — обработка одной из
-- обязательных требований email-рассылок: ссылка "Отписаться" в каждом
-- письме. isBlocked продолжает блокировать всё, а unsub флаг — только email.

ALTER TABLE "ClientBroadcast"
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'telegram';

ALTER TABLE "ClientBroadcastDelivery"
  ADD COLUMN "email"   TEXT,
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'telegram';

ALTER TABLE "Client"
  ADD COLUMN "marketingUnsubscribed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "unsubscribeToken"      TEXT;

CREATE UNIQUE INDEX "Client_unsubscribeToken_key" ON "Client"("unsubscribeToken");
