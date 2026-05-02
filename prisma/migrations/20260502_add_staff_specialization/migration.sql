-- Add specialization column to Staff. Free-text label like "Барбер-стилист" / "Терапевт"
-- shown next to the canonical role from dropdown (admin/manager/master/doctor/operator/custom).
-- Splitting these prevents the bug where free-text specialization was overwriting the
-- enum role and falling out of `role: { in: [...] }` notification filters.

ALTER TABLE "Staff"
  ADD COLUMN "specialization" TEXT;
