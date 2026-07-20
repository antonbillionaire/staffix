-- botLogo was a URL field intended to be applied as the bot's avatar, but
-- Telegram Bot API has no method to set the bot's own profile photo — that
-- can only be done via @BotFather manually. The field never had any effect.
-- Owners who set up a Telegram bot can also set the avatar via @BotFather.
ALTER TABLE "Business" DROP COLUMN IF EXISTS "botLogo";
