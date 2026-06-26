SELECT id, document_number, name, currency_code,
  po_amount_original, po_amount_campaign_currency, po_consumed_amount,
  po_status, po_currency, created_at, updated_at, metadata
FROM campaign_headers
WHERE name ILIKE '%pizza%hut%' OR name ILIKE '%pizza hut%'
ORDER BY created_at DESC
LIMIT 5;