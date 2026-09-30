-- CreateTable
CREATE TABLE "triage_assessments" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "triageTime" TEXT,
    "heartRate" INTEGER,
    "respRate" INTEGER,
    "spo2" INTEGER,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "temperature" DECIMAL(4,1),
    "painScore" INTEGER,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triage_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "triage_assessments_admissionId_key" ON "triage_assessments"("admissionId");

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "patient_admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_assessments" ADD CONSTRAINT "triage_assessments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
