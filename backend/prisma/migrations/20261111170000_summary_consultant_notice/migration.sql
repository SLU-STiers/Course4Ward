-- Consulting physicians may notify the attending once per summary per day
-- after discharge; attending remains the final claims / summary approver.
CREATE TABLE "summary_consultant_notices" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,

    CONSTRAINT "summary_consultant_notices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "summary_consultant_notices_summaryId_physicianId_dayKey_key"
  ON "summary_consultant_notices"("summaryId", "physicianId", "dayKey");

CREATE INDEX "summary_consultant_notices_physicianId_notifiedAt_idx"
  ON "summary_consultant_notices"("physicianId", "notifiedAt");

ALTER TABLE "summary_consultant_notices"
  ADD CONSTRAINT "summary_consultant_notices_summaryId_fkey"
  FOREIGN KEY ("summaryId") REFERENCES "courses_in_ward"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "summary_consultant_notices"
  ADD CONSTRAINT "summary_consultant_notices_physicianId_fkey"
  FOREIGN KEY ("physicianId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
