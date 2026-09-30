-- CreateEnum
CREATE TYPE "insurance_type" AS ENUM ('PHILHEALTH', 'HMO', 'PRIVATE', 'NONE', 'OTHER');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "address" TEXT,
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "contactPersonAddress" TEXT,
ADD COLUMN     "contactPersonName" TEXT,
ADD COLUMN     "contactPersonNumber" TEXT,
ADD COLUMN     "insurance" "insurance_type",
ADD COLUMN     "religion" TEXT;
