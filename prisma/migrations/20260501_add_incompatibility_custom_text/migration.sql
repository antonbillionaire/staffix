-- Allow free-form B side on ServiceIncompatibility: external restrictions
-- like "солнце", "баня", "алкоголь", "интенсивный спорт" that aren't
-- listed services in the business catalog.

ALTER TABLE "ServiceIncompatibility" ALTER COLUMN "serviceBId" DROP NOT NULL;
ALTER TABLE "ServiceIncompatibility" ADD COLUMN "serviceBText" TEXT;
