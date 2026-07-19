-- Kaspi Pay was removed from the product on 2026-07-20.
-- Drop the now-unused column. All code paths writing/reading it have been removed
-- in the same commit; existing values are discarded (Kaspi was not launched to
-- paying customers as a payment channel).
ALTER TABLE "Business" DROP COLUMN IF EXISTS "kaspiPayLink";
