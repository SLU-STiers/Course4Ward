/*
  Warnings:

  - The primary key for the `patients` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `admissionDate` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `dischargeDate` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `initialAssessment` on the `patients` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `patients` table. All the data in the column will be lost.
  - The primary key for the `physician_notes` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `content` on the `physician_notes` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `physician_notes` table. All the data in the column will be lost.
  - You are about to drop the column `patientId` on the `physician_notes` table. All the data in the column will be lost.
  - You are about to drop the column `physicianId` on the `physician_notes` table. All the data in the column will be lost.
  - You are about to drop the column `reminderAt` on the `physician_notes` table. All the data in the column will be lost.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `firstName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `mustResetPassword` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `claims` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `courses_in_ward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `patient_assignments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `physician_orders` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `first_name` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `patients` table without a default value. This is not possible if the table is not empty.
  - The required column `patientID` was added to the `patients` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `notesID` was added to the `physician_notes` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `physicianID` to the `physician_notes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `physician_notes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.
  - The required column `userID` was added to the `users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Changed the type of `role` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "role" AS ENUM ('ADMIN', 'PHYSICIAN', 'NURSE', 'CLAIMS_PROCESSOR');

-- CreateEnum
CREATE TYPE "action" AS ENUM ('LOGIN', 'LOGOUT', 'ADD_NOTE', 'CREATE_ORDER_NURSE', 'CREATE_ORDER', 'APPROVE_SUMMARIZATION', 'EDIT_SUMMARIZATION', 'REGENERATE_SUMMARIZATION', 'REQUEST_SUMMARIZATION_APPROVAL', 'ADD_ACCOUNT', 'DELETE_ACCOUNT', 'REGISTER_PATIENT');

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
ALTER TABLE "courses_in_ward" DROP CONSTRAINT "courses_in_ward_patientId_fkey";

-- DropForeignKey
ALTER TABLE "patient_assignments" DROP CONSTRAINT "patient_assignments_patientId_fkey";

-- DropForeignKey
ALTER TABLE "patient_assignments" DROP CONSTRAINT "patient_assignments_userId_fkey";

-- DropForeignKey
ALTER TABLE "physician_notes" DROP CONSTRAINT "physician_notes_patientId_fkey";

-- DropForeignKey
ALTER TABLE "physician_notes" DROP CONSTRAINT "physician_notes_physicianId_fkey";

-- DropForeignKey
ALTER TABLE "physician_orders" DROP CONSTRAINT "physician_orders_enteredById_fkey";

-- DropForeignKey
ALTER TABLE "physician_orders" DROP CONSTRAINT "physician_orders_orderingPhysicianId_fkey";

-- DropForeignKey
ALTER TABLE "physician_orders" DROP CONSTRAINT "physician_orders_patientId_fkey";

-- DropIndex
DROP INDEX "users_userId_key";

-- AlterTable
ALTER TABLE "patients" DROP CONSTRAINT "patients_pkey",
DROP COLUMN "admissionDate",
DROP COLUMN "dateOfBirth",
DROP COLUMN "dischargeDate",
DROP COLUMN "firstName",
DROP COLUMN "gender",
DROP COLUMN "id",
DROP COLUMN "initialAssessment",
DROP COLUMN "lastName",
ADD COLUMN     "first_name" VARCHAR(40) NOT NULL,
ADD COLUMN     "last_name" VARCHAR(40) NOT NULL,
ADD COLUMN     "patientID" TEXT NOT NULL,
ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("patientID");

-- AlterTable
ALTER TABLE "physician_notes" DROP CONSTRAINT "physician_notes_pkey",
DROP COLUMN "content",
DROP COLUMN "id",
DROP COLUMN "patientId",
DROP COLUMN "physicianId",
DROP COLUMN "reminderAt",
ADD COLUMN     "admissionID" TEXT,
ADD COLUMN     "notesID" TEXT NOT NULL,
ADD COLUMN     "notes_array" TEXT[],
ADD COLUMN     "physicianID" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "physician_notes_pkey" PRIMARY KEY ("notesID");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "firstName",
DROP COLUMN "id",
DROP COLUMN "lastName",
DROP COLUMN "mustResetPassword",
DROP COLUMN "passwordHash",
DROP COLUMN "userId",
ADD COLUMN     "first_name" VARCHAR(40) NOT NULL,
ADD COLUMN     "last_name" VARCHAR(40) NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "userID" TEXT NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "role" NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("userID");

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "claims";

-- DropTable
DROP TABLE "courses_in_ward";

-- DropTable
DROP TABLE "patient_assignments";

-- DropTable
DROP TABLE "physician_orders";

-- DropEnum
DROP TYPE "ClaimStatus";

-- DropEnum
DROP TYPE "OrderEnteredBy";

-- DropEnum
DROP TYPE "OrderType";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "SummaryStatus";

-- CreateTable
CREATE TABLE "patient_admissions" (
    "admissionID" TEXT NOT NULL,
    "discharge_date" TIMESTAMP(3),
    "admission_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientID" TEXT NOT NULL,
    "physicianID" TEXT NOT NULL,

    CONSTRAINT "patient_admissions_pkey" PRIMARY KEY ("admissionID")
);

-- CreateTable
CREATE TABLE "orders" (
    "orderID" TEXT NOT NULL,
    "order_content" TEXT NOT NULL,
    "date_created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_updated" TIMESTAMP(3) NOT NULL,
    "order_embedding" vector(768),
    "admissionID" TEXT NOT NULL,
    "ordered_by" TEXT NOT NULL,
    "encoded_by" TEXT NOT NULL,
    "summarizationID" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("orderID")
);

-- CreateTable
CREATE TABLE "summarized_courses_in_ward" (
    "summarizationID" TEXT NOT NULL,
    "summary_content" TEXT NOT NULL,
    "summary_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approve_status" BOOLEAN NOT NULL DEFAULT false,
    "validator_id" TEXT,
    "admissionID" TEXT NOT NULL,

    CONSTRAINT "summarized_courses_in_ward_pkey" PRIMARY KEY ("summarizationID")
);

-- CreateTable
CREATE TABLE "summary_approval_requests" (
    "approvalID" TEXT NOT NULL,
    "physicianID" TEXT NOT NULL,
    "processorID" TEXT NOT NULL,
    "summaryID" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "summary_approval_requests_pkey" PRIMARY KEY ("approvalID")
);

-- CreateTable
CREATE TABLE "logs" (
    "logID" TEXT NOT NULL,
    "time_stamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "action" NOT NULL,
    "userID" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("logID")
);

-- CreateTable
CREATE TABLE "password_reset_requests" (
    "passresetID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("passresetID")
);

-- CreateIndex
CREATE INDEX "patient_admissions_patientID_idx" ON "patient_admissions"("patientID");

-- CreateIndex
CREATE INDEX "patient_admissions_physicianID_idx" ON "patient_admissions"("physicianID");

-- CreateIndex
CREATE INDEX "patient_admissions_admission_date_idx" ON "patient_admissions"("admission_date");

-- CreateIndex
CREATE INDEX "orders_admissionID_idx" ON "orders"("admissionID");

-- CreateIndex
CREATE INDEX "orders_ordered_by_idx" ON "orders"("ordered_by");

-- CreateIndex
CREATE INDEX "orders_encoded_by_idx" ON "orders"("encoded_by");

-- CreateIndex
CREATE INDEX "orders_summarizationID_idx" ON "orders"("summarizationID");

-- CreateIndex
CREATE INDEX "orders_date_created_idx" ON "orders"("date_created");

-- CreateIndex
CREATE INDEX "orders_admissionID_date_created_idx" ON "orders"("admissionID", "date_created");

-- CreateIndex
CREATE INDEX "summarized_courses_in_ward_admissionID_idx" ON "summarized_courses_in_ward"("admissionID");

-- CreateIndex
CREATE INDEX "summarized_courses_in_ward_validator_id_idx" ON "summarized_courses_in_ward"("validator_id");

-- CreateIndex
CREATE INDEX "summarized_courses_in_ward_summary_date_idx" ON "summarized_courses_in_ward"("summary_date");

-- CreateIndex
CREATE INDEX "summary_approval_requests_physicianID_idx" ON "summary_approval_requests"("physicianID");

-- CreateIndex
CREATE INDEX "summary_approval_requests_processorID_idx" ON "summary_approval_requests"("processorID");

-- CreateIndex
CREATE INDEX "summary_approval_requests_summaryID_idx" ON "summary_approval_requests"("summaryID");

-- CreateIndex
CREATE INDEX "logs_userID_idx" ON "logs"("userID");

-- CreateIndex
CREATE INDEX "logs_time_stamp_idx" ON "logs"("time_stamp");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_requests_tokenHash_key" ON "password_reset_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_requests_userID_idx" ON "password_reset_requests"("userID");

-- CreateIndex
CREATE INDEX "physician_notes_physicianID_idx" ON "physician_notes"("physicianID");

-- CreateIndex
CREATE INDEX "physician_notes_admissionID_idx" ON "physician_notes"("admissionID");

-- AddForeignKey
ALTER TABLE "patient_admissions" ADD CONSTRAINT "patient_admissions_patientID_fkey" FOREIGN KEY ("patientID") REFERENCES "patients"("patientID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_admissions" ADD CONSTRAINT "patient_admissions_physicianID_fkey" FOREIGN KEY ("physicianID") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_admissionID_fkey" FOREIGN KEY ("admissionID") REFERENCES "patient_admissions"("admissionID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_ordered_by_fkey" FOREIGN KEY ("ordered_by") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_encoded_by_fkey" FOREIGN KEY ("encoded_by") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_summarizationID_fkey" FOREIGN KEY ("summarizationID") REFERENCES "summarized_courses_in_ward"("summarizationID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_notes" ADD CONSTRAINT "physician_notes_physicianID_fkey" FOREIGN KEY ("physicianID") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_notes" ADD CONSTRAINT "physician_notes_admissionID_fkey" FOREIGN KEY ("admissionID") REFERENCES "patient_admissions"("admissionID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summarized_courses_in_ward" ADD CONSTRAINT "summarized_courses_in_ward_admissionID_fkey" FOREIGN KEY ("admissionID") REFERENCES "patient_admissions"("admissionID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summarized_courses_in_ward" ADD CONSTRAINT "summarized_courses_in_ward_validator_id_fkey" FOREIGN KEY ("validator_id") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_approval_requests" ADD CONSTRAINT "summary_approval_requests_physicianID_fkey" FOREIGN KEY ("physicianID") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_approval_requests" ADD CONSTRAINT "summary_approval_requests_processorID_fkey" FOREIGN KEY ("processorID") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summary_approval_requests" ADD CONSTRAINT "summary_approval_requests_summaryID_fkey" FOREIGN KEY ("summaryID") REFERENCES "summarized_courses_in_ward"("summarizationID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_userID_fkey" FOREIGN KEY ("userID") REFERENCES "users"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
