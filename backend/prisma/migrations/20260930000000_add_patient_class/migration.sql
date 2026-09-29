-- Replace the isOutpatient flag with an explicit patient class
-- (EMERGENCY | OUTPATIENT | OBSERVATION | INPATIENT).

-- CreateEnum
CREATE TYPE "patient_class" AS ENUM ('EMERGENCY', 'OUTPATIENT', 'OBSERVATION', 'INPATIENT');

-- AlterEnum
ALTER TYPE "order_type" ADD VALUE 'OBSERVATION';

-- AlterTable: add the new columns first so they can be backfilled.
ALTER TABLE "patient_admissions"
ADD COLUMN     "classSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "patientClass" "patient_class" NOT NULL DEFAULT 'EMERGENCY';

-- Backfill: the old flag only told outpatients from ward patients. Flagged
-- rows become OUTPATIENT (the seeded ones are clinic visits); everything else
-- was on the ward. The class began when the flag was set, else on admission.
UPDATE "patient_admissions"
SET "patientClass" = CASE WHEN "isOutpatient" THEN 'OUTPATIENT'::"patient_class" ELSE 'INPATIENT'::"patient_class" END,
    "classSince"   = COALESCE("outpatientSetAt", "admissionDate");

-- AlterTable: drop the replaced columns.
ALTER TABLE "patient_admissions" DROP COLUMN "isOutpatient",
DROP COLUMN "outpatientSetAt";
