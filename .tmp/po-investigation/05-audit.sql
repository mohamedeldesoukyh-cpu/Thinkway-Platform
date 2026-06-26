SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position;

SELECT *
FROM audit_logs
WHERE entity_id = '184d8432-3fa5-4908-8688-e2369f0d2052'
ORDER BY created_at DESC
LIMIT 10;