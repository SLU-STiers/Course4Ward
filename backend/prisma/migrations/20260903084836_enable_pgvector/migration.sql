/*
  Warnings:

  - You are about to drop the column `createdAt` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `entityId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `aiGeneratedText` on the `courses_in_ward` table. All the data in the column will be lost.
  - You are about to drop the column `approvedAt` on the `courses_in_ward` table. All the data in the column will be lost.
  - You are about to drop the column `approvedById` on the `courses_in_ward` table. All the data in the column will be lost.
  - You are about to drop the column `currentText` on the `courses_in_ward` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `courses_in_ward` table. All the data in the column will be lost.
  - You are about to drop the column `admissionDate` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `dischargeDate` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `initialAssessment` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `physician_notes` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `physician_orders` table. All the data in the column will be lost.
  - You are about to drop the column `enteredById` on the `physician_orders` table. All the data in the column will be lost.
  - You are about to drop the column `orderDate` on the `physician_orders` table. All the data in the column will be lost.
  - You are about to drop the column `orderingPhysicianId` on the `physician_orders` table. All the data in the column will be lost.
  - You are about to drop the `claims` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `patient_assignments` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `userId` on table `audit_logs` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `action` on the `audit_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `summaryContent` to the `courses_in_ward` table without a default value. This is not possible if the table is not empty.
  - Added the required column `notesArray` to the `physician_notes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `admissionId` to the `physician_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encodedById` to the `physician_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderContent` to the `physician_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderedById` to the `physician_orders` table without a default value. This is not possible if the table is not empty.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ResetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'ADD_NOTE', 'CREATE_ORDER_NURSE', 'CREATE_ORDER', 'APPROVE_SUMMARY', 'EDIT_SUMMARY', 'REGENERATE_SUMMARY', 'REQUEST_SUMMARY', 'ADD_ACCOUNT', 'EDIT_ACCOUNT', 'DELETE_ACCOUNT', 'REGISTER_PATIENT');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_courseInWardId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_patientId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "courses_in_ward" DROP CONSTRAINT "courses_in_ward_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "patient_assignments" DROP CONSTRAINT "patient_assignments_patientId_fkey";

-- DropForeignKey
ALTER TABLE "patient_assignments" DROP CONSTRAINT "patient_assignments_userId_fkey";

-- DropForeignKey
ALTER TABLE "physician_orders" DROP CONSTRAINT "physician_orders_enteredById_fkey";

-- DropForeignKey
ALTER TABLE "physician_orders" DROP CONSTRAINT "physician_orders_orderingPhysicianId_fkey";

-- DropIndex
DROP INDEX "audit_logs_createdAt_idx";

-- DropIndex
DROP INDEX "audit_logs_entityType_entityId_idx";

-- DropIndex
DROP INDEX "courses_in_ward_patientId_summaryDate_idx";

-- DropIndex
DROP INDEX "physician_orders_patientId_orderDate_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "createdAt",
DROP COLUMN "entityId",
DROP COLUMN "entityType",
DROP COLUMN "ipAddress",
DROP COLUMN "metadata",
ADD COLUMN     "timeStamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "userId" SET NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "ActionType" NOT NULL;

-- AlterTable
ALTER TABLE "courses_in_ward" DROP COLUMN "aiGeneratedText",
DROP COLUMN "approvedAt",
DROP COLUMN "approvedById",
DROP COLUMN "currentText",
DROP COLUMN "version",
ADD COLUMN     "approvedStatus" BOOLEAN,
ADD COLUMN     "summaryContent" TEXT NOT NULL,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatorId" TEXT;

-- AlterTable
ALTER TABLE "patients" DROP COLUMN "admissionDate",
DROP COLUMN "dischargeDate",
DROP COLUMN "initialAssessment",
ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "dateOfBirth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "physician_notes" DROP COLUMN "content",
ADD COLUMN     "notesArray" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "physician_orders" DROP COLUMN "description",
DROP COLUMN "enteredById",
DROP COLUMN "orderDate",
DROP COLUMN "orderingPhysicianId",
ADD COLUMN     "admissionId" TEXT NOT NULL,
ADD COLUMN     "dateCreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateUpdated" TIMESTAMP(3),
ADD COLUMN     "encodedById" TEXT NOT NULL,
ADD COLUMN     "orderContent" TEXT NOT NULL,
ADD COLUMN     "orderEmbedding" vector(1536),
ADD COLUMN     "orderedById" TEXT NOT NULL,
ADD COLUMN     "summarizationId" TEXT;

-- DropTable
DROP TABLE "claims";

-- DropTable
DROP TABLE "patient_assignments";

-- DropEnum
DROP TYPE "ClaimStatus";

-- CreateTable
CREATE TABLE "patient_admissions" (
    "id" TEXT NOT NULL,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "dischargeDate" TIMESTAMP(3),
    "patientId" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,

    CONSTRAINT "patient_admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summary_approval_requests" (
    "id" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "processorId" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "summary_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "status" "ResetStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_requests_token_key" ON "password_reset_requests"("token");

-- CreateIndex
CREATE INDEX "password_reset_requests_userId_idx" ON "password_reset_requests"("userId");

-- CreateIndex
CREATE INDEX "physician_orders_admissionId_dateCreated_idx" ON "physician_orders"("admissionId", "dateCreated");

-- AddForeignKey
ALTER TABLE "patient_admissions" ADD CONSTRAINT "patient_admissions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_admissions" ADD CONSTRAINT "patient_admissions_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "patient_admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_encodedById_fkey" FOREIGN KEY ("encodedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_summarizationId_fkey" FOREIGN KEY ("summarizationId") REFERENCES "courses_in_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses_in_ward" ADD CONSTRAINT "courses_in_ward_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_approval_requests" ADD CONSTRAINT "summary_approval_requests_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_approval_requests" ADD CONSTRAINT "summary_approval_requests_processorId_fkey" FOREIGN KEY ("processorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_approval_requests" ADD CONSTRAINT "summary_approval_requests_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "courses_in_ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
