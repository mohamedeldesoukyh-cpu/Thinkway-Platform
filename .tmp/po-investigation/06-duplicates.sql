SELECT id, document_number, name, po_amount_original, created_at
FROM campaign_headers
WHERE brand_id = '4845b683-c52b-400d-b8a9-8c09a50a761e'
ORDER BY created_at DESC;

SELECT COUNT(*) AS total_pizza FROM campaign_headers
WHERE name ILIKE '%pizza%hut%';