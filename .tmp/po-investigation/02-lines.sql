SELECT id, document_number, name, po_amount, remaining_po, po_consumed, revenue, cost, created_at, updated_at
FROM campaign_lines
WHERE campaign_header_id = '184d8432-3fa5-4908-8688-e2369f0d2052'
ORDER BY document_number;

SELECT COUNT(*) AS line_count,
  COALESCE(SUM(po_amount), 0) AS sum_po_amount,
  COALESCE(SUM(remaining_po), 0) AS sum_remaining_po
FROM campaign_lines
WHERE campaign_header_id = '184d8432-3fa5-4908-8688-e2369f0d2052';