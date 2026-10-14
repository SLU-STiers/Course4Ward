-- Physicians can be assigned to one or more wards; ward names serve as their
-- specialties in the clinical physician selectors.
CREATE TABLE "physician_wards" (
    "physicianId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,

    CONSTRAINT "physician_wards_pkey" PRIMARY KEY ("physicianId", "wardId")
);

CREATE INDEX "physician_wards_wardId_idx" ON "physician_wards"("wardId");

ALTER TABLE "physician_wards"
ADD CONSTRAINT "physician_wards_physicianId_fkey"
FOREIGN KEY ("physicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "physician_wards"
ADD CONSTRAINT "physician_wards_wardId_fkey"
FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
