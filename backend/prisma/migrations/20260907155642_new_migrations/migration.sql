-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "role" AS ENUM ('ADMIN', 'PHYSICIAN', 'NURSE', 'CLAIMS_PROCESSOR');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MEDICATION', 'ADMISSION', 'DISCHARGE', 'DIAGNOSTIC', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderEnteredBy" AS ENUM ('PHYSICIAN', 'NURSE_ON_BEHALF');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('DRAFT_AI', 'DRAFT_EDITED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ResetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LOGIN', 'LOGOUT', 'ADD_NOTE', 'CREATE_ORDER_NURSE', 'CREATE_ORDER', 'APPROVE_SUMMARY', 'EDIT_SUMMARY', 'REGENERATE_SUMMARY', 'REQUEST_SUMMARY', 'ADD_ACCOUNT', 'EDIT_ACCOUNT', 'DELETE_ACCOUNT', 'REGISTER_PATIENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustResetPassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "physician_orders" (
    "id" TEXT NOT NULL,
    "orderContent" TEXT NOT NULL,
    "dateCreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateUpdated" TIMESTAMP(3),
    "orderEmbedding" vector(768),
    "admissionId" TEXT NOT NULL,
    "orderedById" TEXT NOT NULL,
    "encodedById" TEXT NOT NULL,
    "enteredByRole" "OrderEnteredBy" NOT NULL DEFAULT 'PHYSICIAN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "summarizationId" TEXT,

    CONSTRAINT "physician_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physician_notes" (
    "id" TEXT NOT NULL,
    "notesArray" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminderAt" TIMESTAMP(3),

    CONSTRAINT "physician_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses_in_ward" (
    "id" TEXT NOT NULL,
    "summaryContent" TEXT NOT NULL,
    "summaryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedStatus" BOOLEAN,
    "status" "SummaryStatus" NOT NULL DEFAULT 'DRAFT_AI',
    "validatorId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "patientId" TEXT NOT NULL,

    CONSTRAINT "courses_in_ward_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timeStamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "ActionType" NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_userId_key" ON "users"("userId");

-- CreateIndex
CREATE INDEX "physician_orders_admissionId_dateCreated_idx" ON "physician_orders"("admissionId", "dateCreated");

-- CreateIndex
CREATE INDEX "physician_notes_physicianId_idx" ON "physician_notes"("physicianId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_requests_token_key" ON "password_reset_requests"("token");

-- CreateIndex
CREATE INDEX "password_reset_requests_userId_idx" ON "password_reset_requests"("userId");

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
ALTER TABLE "physician_notes" ADD CONSTRAINT "physician_notes_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_notes" ADD CONSTRAINT "physician_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses_in_ward" ADD CONSTRAINT "courses_in_ward_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
