SELECT column_name FROM information_schema.columns
WHERE table_name = 'po_governance_logs' ORDER BY ordinal_position;

SELECT * FROM po_governance_logs
WHERE campaign_header_id = '184d8432-3fa5-4908-8688-e2369f0d2052'
ORDER BY created_at DESC;

SELECT COUNT(*) AS governance_log_count FROM po_governance_logs
WHERE campaign_header_id = '184d8432-3fa5-4908-8688-e2369f0d2052';