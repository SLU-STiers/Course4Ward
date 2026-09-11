-- DropForeignKey
ALTER TABLE "patient_admissions" DROP CONSTRAINT "patient_admissions_physicianId_fkey";

-- AlterTable
ALTER TABLE "patient_admissions" ALTER COLUMN "physicianId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "patient_admissions" ADD CONSTRAINT "patient_admissions_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
