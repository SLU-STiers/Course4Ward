-- Data only: give existing activity logs the lower-cased copy of their summary
-- that the free-text search matches on (see SEARCH_TEXT_KEY in
-- audit-log.service.ts). New logs get it when they are recorded.
UPDATE "audit_logs"
SET "details" = jsonb_set("details", '{searchText}', to_jsonb(lower("details"->>'summary')))
WHERE "details" IS NOT NULL
  AND jsonb_typeof("details") = 'object'
  AND "details"->>'summary' IS NOT NULL;
