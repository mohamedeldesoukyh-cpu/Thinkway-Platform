-- Caller begins transaction, supplies correction_map, and chooses COMMIT/ROLLBACK.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.invoices, public.finance_documents, public.document_sequences IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE invoice_before ON COMMIT DROP AS SELECT * FROM public.invoices;
CREATE TEMP TABLE finance_before ON COMMIT DROP AS SELECT * FROM public.finance_documents;
CREATE TEMP TABLE sequence_before ON COMMIT DROP AS SELECT * FROM public.document_sequences;
DO $$ BEGIN
 IF (SELECT count(*) FROM correction_map) <> 3 OR
    (SELECT count(*) FROM correction_map m JOIN public.invoices i ON i.id=m.id AND i.document_number=m.old_number AND i.total=m.expected_total AND i.amount_paid=0) <> 3 THEN
   RAISE EXCEPTION 'Expected three exact unpaid invoices; aborting';
 END IF;
 IF (SELECT count(*) FROM public.finance_documents f JOIN correction_map m ON f.source_id=m.id AND f.source_table='invoices' AND f.document_number=m.old_number) <> 3 THEN
   RAISE EXCEPTION 'Finance document mapping differs; aborting';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.invoices'::regclass AND tgname='protect_issued_invoice_amounts' AND tgenabled='O') THEN
   RAISE EXCEPTION 'Unexpected protection trigger state';
 END IF;
END $$;
-- Exclusive lock prevents other sessions writing while this protection is suspended.
-- Audit and all other triggers stay enabled. Any error rolls back the suspension.
ALTER TABLE public.invoices DISABLE TRIGGER protect_issued_invoice_amounts;
UPDATE public.invoices i SET document_number='serial-correction-'||i.id FROM correction_map m WHERE i.id=m.id;
UPDATE public.finance_documents f SET document_number='serial-correction-'||m.id FROM correction_map m WHERE f.source_table='invoices' AND f.source_id=m.id;
UPDATE public.invoices i SET document_number=m.new_number FROM correction_map m WHERE i.id=m.id;
UPDATE public.finance_documents f SET document_number=m.new_number FROM correction_map m WHERE f.source_table='invoices' AND f.source_id=m.id;
ALTER TABLE public.invoices ENABLE TRIGGER protect_issued_invoice_amounts;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.invoices) <> (SELECT count(*) FROM invoice_before) OR EXISTS (
   SELECT 1 FROM invoice_before b FULL JOIN public.invoices i USING(id)
   LEFT JOIN correction_map m ON m.id=b.id
   WHERE i.id IS NULL OR b.id IS NULL OR
   (to_jsonb(i)-'document_number'-'updated_at') IS DISTINCT FROM (to_jsonb(b)-'document_number'-'updated_at') OR
   i.document_number IS DISTINCT FROM coalesce(m.new_number,b.document_number)
 ) THEN RAISE EXCEPTION 'Invoice invariant failed'; END IF;
 IF (SELECT count(*) FROM public.finance_documents) <> (SELECT count(*) FROM finance_before) OR EXISTS (
   SELECT 1 FROM finance_before b FULL JOIN public.finance_documents f USING(id)
   LEFT JOIN correction_map m ON m.id=b.source_id AND b.source_table='invoices'
   WHERE f.id IS NULL OR b.id IS NULL OR
   (to_jsonb(f)-'document_number') IS DISTINCT FROM (to_jsonb(b)-'document_number') OR
   f.document_number IS DISTINCT FROM coalesce(m.new_number,b.document_number)
 ) THEN RAISE EXCEPTION 'Finance invariant failed'; END IF;
 IF EXISTS ((SELECT * FROM public.document_sequences EXCEPT SELECT * FROM sequence_before) UNION ALL (SELECT * FROM sequence_before EXCEPT SELECT * FROM public.document_sequences)) THEN
   RAISE EXCEPTION 'Sequence changed';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.invoices'::regclass AND tgname='protect_issued_invoice_amounts' AND tgenabled='O') THEN
   RAISE EXCEPTION 'Protection not restored';
 END IF;
END $$;
INSERT INTO public.audit_logs(action,entity_type,entity_id,old_data,new_data,metadata)
SELECT 'update','invoices',m.id,to_jsonb(b),to_jsonb(i),
 jsonb_build_object('reason','User-authorized invoice serial correction before submission: Fresh 13 to 11, previous 11 to 12, previous 12 to 13','correction','20261108-invoice-serial-rotation')
FROM correction_map m JOIN invoice_before b ON b.id=m.id JOIN public.invoices i ON i.id=m.id;
SELECT m.old_number,i.document_number,i.id,i.total,i.amount_paid FROM correction_map m JOIN public.invoices i ON i.id=m.id ORDER BY i.document_number;
SELECT 'PASS: amounts, dates, IDs, other invoice fields, finance fields, sequence and protection verified' AS verification;
