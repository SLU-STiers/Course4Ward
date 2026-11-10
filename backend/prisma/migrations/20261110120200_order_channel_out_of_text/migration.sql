-- Data only: orders entered on a physician's behalf used to start with
-- "Received via SMS." (or Email / Verbal / Others) in the order text itself.
-- Moves that into communicationChannel so the text the AI summarises is the
-- order alone.
UPDATE "physician_orders"
SET
  "communicationChannel" = (
    CASE substring("orderContent" from '^Received via (SMS|Email|Verbal|Others)\.\n')
      WHEN 'SMS' THEN 'SMS'
      WHEN 'Email' THEN 'EMAIL'
      WHEN 'Verbal' THEN 'VERBAL'
      ELSE 'OTHER'
    END
  )::"CommunicationChannel",
  "orderContent" = regexp_replace("orderContent", '^Received via (SMS|Email|Verbal|Others)\.\n', '')
WHERE "enteredByRole" = 'NURSE_ON_BEHALF'
  AND "communicationChannel" IS NULL
  AND "orderContent" ~ '^Received via (SMS|Email|Verbal|Others)\.\n';
