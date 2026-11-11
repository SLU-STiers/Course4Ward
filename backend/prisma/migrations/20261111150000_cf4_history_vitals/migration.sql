-- AlterTable
ALTER TABLE "patient_admissions" ADD COLUMN "medicalSurgicalHistory" TEXT;

-- AlterTable
ALTER TABLE "triage_assessments" ADD COLUMN "heightCm" DECIMAL(5,1),
ADD COLUMN "weightKg" DECIMAL(5,1);
