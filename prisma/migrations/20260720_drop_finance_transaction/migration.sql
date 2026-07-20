-- FinanceTransaction was defined in April 2026 but never wired up:
-- prisma.financeTransaction.* is never called anywhere in src/. Table is
-- empty in every environment. Dropping to remove the false promise and
-- reduce schema surface. FKs to Staff/Business are removed by DROP TABLE.
DROP TABLE IF EXISTS "FinanceTransaction";
