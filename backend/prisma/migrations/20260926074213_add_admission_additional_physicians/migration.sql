-- CreateTable
CREATE TABLE "admission_physicians" (
    "admissionId" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_physicians_pkey" PRIMARY KEY ("admissionId","physicianId")
);

-- CreateIndex
CREATE INDEX "admission_physicians_physicianId_idx" ON "admission_physicians"("physicianId");

-- AddForeignKey
ALTER TABLE "admission_physicians" ADD CONSTRAINT "admission_physicians_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "patient_admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_physicians" ADD CONSTRAINT "admission_physicians_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
