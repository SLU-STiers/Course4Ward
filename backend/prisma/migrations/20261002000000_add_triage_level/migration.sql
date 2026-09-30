-- 5-level triage priority recorded with the triage assessment:
-- 1 Resuscitation, 2 Emergent, 3 Urgent, 4 Less Urgent, 5 Non-Urgent.

-- AlterTable
ALTER TABLE "triage_assessments" ADD COLUMN "triageLevel" INTEGER;

-- Prisma cannot express a range check, so the database enforces it here.
ALTER TABLE "triage_assessments"
  ADD CONSTRAINT "triage_assessments_triageLevel_check"
  CHECK ("triageLevel" IS NULL OR "triageLevel" BETWEEN 1 AND 5);
