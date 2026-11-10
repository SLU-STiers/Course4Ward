-- Data only: discharges and ended outpatient visits were logged as
-- REGISTER_PATIENT. Kept apart from the enum change above, because PostgreSQL
-- cannot use a newly added enum value in the transaction that added it.
UPDATE "audit_logs"
SET "action" = 'PATIENT_DISCHARGED'
WHERE "action" = 'REGISTER_PATIENT'
  AND jsonb_typeof("details") = 'object'
  AND (
    "details"->>'summary' LIKE 'Discharged %'
    OR "details"->>'summary' LIKE 'Ended %''s outpatient visit'
  );
