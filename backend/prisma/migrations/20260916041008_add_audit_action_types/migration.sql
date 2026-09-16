-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'PATIENT_UPDATED';
ALTER TYPE "ActionType" ADD VALUE 'PASSWORD_RESET';
ALTER TYPE "ActionType" ADD VALUE 'CLAIM_CREATED';
ALTER TYPE "ActionType" ADD VALUE 'CLAIM_PHYSICIAN_NOTIFIED';
ALTER TYPE "ActionType" ADD VALUE 'CF4_GENERATED';
