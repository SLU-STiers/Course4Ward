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

-- At most one ward holds patients without a room (Emergency).
CREATE UNIQUE INDEX "wards_one_holds_unroomed" ON "wards"("holdsUnroomed") WHERE "holdsUnroomed";

-- Starter wards. Emergency holds every patient without a room; the starter
-- rooms (101-110, 201-210) are split across the others until an admin re-maps them.
INSERT INTO "wards" ("id", "name", "holdsUnroomed") VALUES
    ('ward-emergency', 'Emergency', true),
    ('ward-coronary', 'Coronary', false),
    ('ward-obdr', 'OBDR', false),
    ('ward-nicu', 'Neonatal ICU', false),
    ('ward-picu', 'Pedia ICU', false),
    ('ward-micu', 'Medical ICU', false),
    ('ward-surgery', 'Surgery', false)
ON CONFLICT ("name") DO NOTHING;

UPDATE "rooms" r SET "wardId" = w."wardId"
FROM (VALUES
    ('101', 'ward-coronary'), ('102', 'ward-coronary'), ('103', 'ward-coronary'),
    ('104', 'ward-obdr'), ('105', 'ward-obdr'), ('106', 'ward-obdr'),
    ('107', 'ward-nicu'), ('108', 'ward-nicu'),
    ('109', 'ward-picu'), ('110', 'ward-picu'),
    ('201', 'ward-micu'), ('202', 'ward-micu'), ('203', 'ward-micu'), ('204', 'ward-micu'), ('205', 'ward-micu'),
    ('206', 'ward-surgery'), ('207', 'ward-surgery'), ('208', 'ward-surgery'), ('209', 'ward-surgery'), ('210', 'ward-surgery')
) AS w("number", "wardId")
WHERE r."number" = w."number" AND r."wardId" IS NULL;
