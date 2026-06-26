SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND (table_name ILIKE '%audit%' OR table_name ILIKE '%activity%' OR table_name ILIKE '%event%')
ORDER BY table_name;