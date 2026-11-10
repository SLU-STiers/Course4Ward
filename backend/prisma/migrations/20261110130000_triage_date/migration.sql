-- Triage date is now kept apart from the HH:mm triage time.
ALTER TABLE "triage_assessments" ADD COLUMN "triageDate" DATE;

-- Some older rows stored a full timestamp in triageTime: split it into the
-- hospital's (Manila) calendar date and clock time.
UPDATE "triage_assessments"
SET "triageDate" = ("triageTime"::timestamptz AT TIME ZONE 'Asia/Manila')::date,
    "triageTime" = to_char("triageTime"::timestamptz AT TIME ZONE 'Asia/Manila', 'HH24:MI')
WHERE "triageTime" ~ '^\d{4}-\d{2}-\d{2}T';

-- The rest were recorded at registration, so they take the day the row was created.
UPDATE "triage_assessments"
SET "triageDate" = ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date
WHERE "triageDate" IS NULL;
