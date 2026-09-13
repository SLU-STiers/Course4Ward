-- CreateEnum
CREATE TYPE "philhealth_cf4_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "courses_in_ward" ADD COLUMN     "philhealthCf4DecidedAt" TIMESTAMP(3),
ADD COLUMN     "philhealthCf4Status" "philhealth_cf4_status" NOT NULL DEFAULT 'PENDING';
