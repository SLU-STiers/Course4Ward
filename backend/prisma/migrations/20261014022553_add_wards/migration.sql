-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "wardId" TEXT;

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holdsUnroomed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurse_wards" (
    "nurseId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,

    CONSTRAINT "nurse_wards_pkey" PRIMARY KEY ("nurseId","wardId")
);

-- CreateIndex
CREATE UNIQUE INDEX "wards_name_key" ON "wards"("name");

-- CreateIndex
CREATE INDEX "nurse_wards_wardId_idx" ON "nurse_wards"("wardId");

-- CreateIndex
CREATE INDEX "rooms_wardId_idx" ON "rooms"("wardId");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurse_wards" ADD CONSTRAINT "nurse_wards_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nurse_wards" ADD CONSTRAINT "nurse_wards_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one ward holds patients without a room (ER / OPD).
CREATE UNIQUE INDEX "wards_one_holds_unroomed" ON "wards"("holdsUnroomed") WHERE "holdsUnroomed";

-- Starter wards: ER / OPD for patients without a room, and one ward per floor of starter rooms.
INSERT INTO "wards" ("id", "name", "holdsUnroomed") VALUES
    ('ward-er-opd', 'ER / OPD', true),
    ('ward-medical', 'Medical Ward', false),
    ('ward-surgical', 'Surgical Ward', false)
ON CONFLICT ("name") DO NOTHING;

UPDATE "rooms" SET "wardId" = 'ward-medical' WHERE "wardId" IS NULL AND "number" ~ '^1[0-9]{2}$';
UPDATE "rooms" SET "wardId" = 'ward-surgical' WHERE "wardId" IS NULL AND "number" ~ '^2[0-9]{2}$';
