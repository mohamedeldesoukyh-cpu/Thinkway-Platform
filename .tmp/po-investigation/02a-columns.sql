SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaign_lines'
ORDER BY ordinal_position;