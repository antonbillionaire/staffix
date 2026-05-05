-- Add FK constraints to Task.clientId and Task.assignedStaffId
-- (the columns existed but had no FK — orphan references were possible
--  if a client/staff got deleted, leaving Task with a dangling ID).
--
-- Strategy:
-- 1. Clean up any orphan references first (defensive — set them to NULL
--    if the referenced row doesn't exist). Without this step, ADD CONSTRAINT
--    fails with FK violation if there are dangling pointers in production.
-- 2. Add the FK with ON DELETE SET NULL. This means: if the referenced
--    Client/Staff is deleted, the Task survives with NULL for that field
--    (better than losing the task or breaking with a hard constraint).

-- Step 1: clean up orphan references
UPDATE "Task"
   SET "clientId" = NULL
 WHERE "clientId" IS NOT NULL
   AND "clientId" NOT IN (SELECT "id" FROM "Client");

UPDATE "Task"
   SET "assignedStaffId" = NULL
 WHERE "assignedStaffId" IS NOT NULL
   AND "assignedStaffId" NOT IN (SELECT "id" FROM "Staff");

-- Step 2: add the FK constraints
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_assignedStaffId_fkey"
  FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
