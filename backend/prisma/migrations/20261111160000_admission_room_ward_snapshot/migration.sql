-- Persist last ward/room on the admission so CF4 still has them after discharge
-- frees the live room assignment.
ALTER TABLE "patient_admissions" ADD COLUMN IF NOT EXISTS "roomNumber" TEXT;
ALTER TABLE "patient_admissions" ADD COLUMN IF NOT EXISTS "wardName" TEXT;

UPDATE "patient_admissions" AS a
SET
  "roomNumber" = COALESCE(a."roomNumber", r."number"),
  "wardName" = COALESCE(a."wardName", w."name")
FROM "rooms" AS r
LEFT JOIN "wards" AS w ON w."id" = r."wardId"
WHERE a."roomId" = r."id"
  AND (a."roomNumber" IS NULL OR a."wardName" IS NULL);
