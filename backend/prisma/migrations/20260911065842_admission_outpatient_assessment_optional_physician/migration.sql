-- AlterTable
ALTER TABLE "patient_admissions" ADD COLUMN     "initialAssessment" TEXT,
ADD COLUMN     "isOutpatient" BOOLEAN NOT NULL DEFAULT false;
