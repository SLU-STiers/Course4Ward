-- AlterTable
ALTER TABLE "patient_admissions" ADD COLUMN     "roomId" TEXT;

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_number_key" ON "rooms"("number");

-- CreateIndex
CREATE INDEX "patient_admissions_roomId_idx" ON "patient_admissions"("roomId");

-- AddForeignKey
ALTER TABLE "patient_admissions" ADD CONSTRAINT "patient_admissions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starter ward rooms: 101-110 and 201-210
INSERT INTO "rooms" ("id", "number")
SELECT gen_random_uuid()::text, n::text
FROM (SELECT generate_series(101, 110) AS n UNION ALL SELECT generate_series(201, 210)) AS numbers
ON CONFLICT ("number") DO NOTHING;
