-- AlterTable: Add channel tracking fields to Order
ALTER TABLE "Order" ADD COLUMN "clientChannel" TEXT;
ALTER TABLE "Order" ADD COLUMN "clientChannelId" TEXT;
