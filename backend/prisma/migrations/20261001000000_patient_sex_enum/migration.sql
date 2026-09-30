-- Store patient sex as a fixed list instead of free text.

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable: convert the recorded values. Anything not recognised fails the
-- cast on purpose, so a bad value is fixed by hand rather than silently lost.
ALTER TABLE "patients" ALTER COLUMN "gender" TYPE "sex" USING (
  CASE
    WHEN "gender" IS NULL OR btrim("gender") = '' THEN NULL
    WHEN lower(btrim("gender")) IN ('male', 'm') THEN 'MALE'::"sex"
    WHEN lower(btrim("gender")) IN ('female', 'f') THEN 'FEMALE'::"sex"
    WHEN lower(btrim("gender")) = 'other' THEN 'OTHER'::"sex"
    ELSE "gender"::"sex"
  END
);
