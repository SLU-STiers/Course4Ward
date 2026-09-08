INSERT INTO "user_id_counters" ("role", "nextNumber")
SELECT roles."role", COALESCE(MAX(CAST(SUBSTRING(users."userId" FROM '[0-9]+$') AS INTEGER)), 0) + 1
FROM (VALUES
  ('ADMIN'::"role"),
  ('PHYSICIAN'::"role"),
  ('NURSE'::"role"),
  ('CLAIMS_PROCESSOR'::"role")
) AS roles("role")
LEFT JOIN "users" ON users."role" = roles."role"
GROUP BY roles."role";