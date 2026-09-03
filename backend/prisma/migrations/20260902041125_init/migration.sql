-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PHYSICIAN', 'NURSE', 'CLAIMS_PROCESSOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MEDICATION', 'ADMISSION', 'DISCHARGE', 'DIAGNOSTIC', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderEnteredBy" AS ENUM ('PHYSICIAN', 'NURSE_ON_BEHALF');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('DRAFT_AI', 'DRAFT_EDITED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING_REVIEW', 'NEEDS_PHYSICIAN_VALIDATION', 'VALIDATED', 'CF4_GENERATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
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
    "gender" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "admissionDate" TIMESTAMP(3),
    "dischargeDate" TIMESTAMP(3),
    "initialAssessment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_assignments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physician_orders" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderingPhysicianId" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "enteredByRole" "OrderEnteredBy" NOT NULL DEFAULT 'PHYSICIAN',
    "type" "OrderType" NOT NULL,
    "description" TEXT NOT NULL,
    "frequency" TEXT,
    "dosage" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "physician_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physician_notes" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physician_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses_in_ward" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "summaryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiGeneratedText" TEXT,
    "currentText" TEXT NOT NULL,
    "status" "SummaryStatus" NOT NULL DEFAULT 'DRAFT_AI',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "courses_in_ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "courseInWardId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "cf4Generated" BOOLEAN NOT NULL DEFAULT false,
    "cf4GeneratedAt" TIMESTAMP(3),
    "physicianNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_userId_key" ON "users"("userId");

-- CreateIndex
CREATE INDEX "patient_assignments_patientId_active_idx" ON "patient_assignments"("patientId", "active");

-- CreateIndex
CREATE INDEX "physician_orders_patientId_orderDate_idx" ON "physician_orders"("patientId", "orderDate");

-- CreateIndex
CREATE INDEX "courses_in_ward_patientId_summaryDate_idx" ON "courses_in_ward"("patientId", "summaryDate");

-- CreateIndex
CREATE UNIQUE INDEX "claims_courseInWardId_key" ON "claims"("courseInWardId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "patient_assignments" ADD CONSTRAINT "patient_assignments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_assignments" ADD CONSTRAINT "patient_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_orderingPhysicianId_fkey" FOREIGN KEY ("orderingPhysicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_notes" ADD CONSTRAINT "physician_notes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_notes" ADD CONSTRAINT "physician_notes_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses_in_ward" ADD CONSTRAINT "courses_in_ward_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses_in_ward" ADD CONSTRAINT "courses_in_ward_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_courseInWardId_fkey" FOREIGN KEY ("courseInWardId") REFERENCES "courses_in_ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
