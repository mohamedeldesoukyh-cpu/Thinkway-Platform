-- Read-only preflight: find campaign and count operational rows before reset.
-- Edit the WHERE clause, then run in SQL Editor.

SELECT
  ch.id AS campaign_header_id,
  ch.document_number,
  ch.name,
  ch.created_at,
  (SELECT count(*) FROM public.campaign_lines cl WHERE cl.campaign_header_id = ch.id) AS lines,
  (SELECT count(*) FROM public.assignment_deliverables ad WHERE ad.campaign_header_id = ch.id) AS deliverables,
  (SELECT count(*) FROM public.vendor_ios v WHERE v.campaign_header_id = ch.id) AS vendor_ios,
  (SELECT count(*) FROM public.vendor_ios v WHERE v.campaign_header_id = ch.id AND v.is_superseded) AS vendor_ios_superseded,
  (SELECT count(*) FROM public.invoices i WHERE i.campaign_header_id = ch.id OR i.campaign_id = ch.id) AS invoices,
  (SELECT count(*) FROM public.client_ios cio WHERE cio.campaign_header_id = ch.id) AS client_ios
FROM public.campaign_headers ch
WHERE ch.document_number = 'TW-2026-0003'
   OR ch.name ILIKE '%Arab bank%event%'
ORDER BY ch.created_at DESC;
