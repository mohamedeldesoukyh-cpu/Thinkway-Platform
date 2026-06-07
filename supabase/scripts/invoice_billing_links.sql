SELECT 'campaign_lines_by_invoice' AS section, invoice_id, count(*) AS line_count
FROM campaign_lines
WHERE invoice_id IS NOT NULL
GROUP BY invoice_id;

SELECT 'assignment_deliverables_by_invoice' AS section, ili.invoice_id, count(*) AS ad_count
FROM assignment_deliverables ad
JOIN invoice_line_items ili ON ili.id = ad.invoice_line_item_id
GROUP BY ili.invoice_id;

SELECT 'assignment_post_schedule_by_invoice' AS section, ili.invoice_id, count(*) AS ps_count
FROM assignment_post_schedule ps
JOIN invoice_line_items ili ON ili.id = ps.invoice_line_item_id
GROUP BY ili.invoice_id;

SELECT 'payments_by_invoice' AS section, invoice_id, count(*) AS payment_count, sum(amount) AS total_paid
FROM payments
WHERE invoice_id IS NOT NULL
GROUP BY invoice_id;
