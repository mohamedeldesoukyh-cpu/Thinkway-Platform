\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE io uuid:='40000000-0000-4000-8000-000000000001'; actor uuid:='10000000-0000-4000-8000-000000000001';
 source text; digest text; result jsonb;
BEGIN
 IF current_database()<>'signing_review' THEN RAISE EXCEPTION 'Local signing_review database required'; END IF;
 SELECT terms_html INTO source FROM vendor_ios WHERE id=io;
 digest:=encode(sha256(convert_to(source,'UTF8')),'hex');
 BEGIN PERFORM get_vendor_io_signing_session(NULL,io,'10000000-0000-4000-8000-000000000002'); RAISE EXCEPTION 'Foreign creator access allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%APPROVAL_INVALID%' THEN RAISE; END IF; END;
 result:=get_vendor_io_signing_session(NULL,io,actor);
 IF result->'io'->>'id'<>io::text THEN RAISE EXCEPTION 'Creator ownership lookup failed'; END IF;
 BEGIN PERFORM sign_vendor_io(io,NULL,'10000000-0000-4000-8000-000000000002','Wrong creator','[[[0.1,0.1],[0.8,0.5]]]',digest,source||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now()); RAISE EXCEPTION 'Foreign creator signed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%APPROVAL_INVALID%' THEN RAISE; END IF; END;
 PERFORM sign_vendor_io(io,NULL,actor,'Synthetic Creator','[[[0.1,0.1],[0.8,0.5]]]',digest,source||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now());
 PERFORM sign_vendor_io(io,NULL,actor,'Changed Name','[[[0.1,0.1],[0.8,0.5]]]',digest,source||'<div data-io-signature="signed">Signed</div>',io||'/signed/duplicate.pdf',now());
 IF (SELECT count(*) FROM io_notifications WHERE io_id=io AND payload->>'signed'='true')<>1 THEN RAISE EXCEPTION 'Audit missing or duplicated'; END IF;
 BEGIN UPDATE vendor_ios SET terms_html='altered' WHERE id=io; RAISE EXCEPTION 'Signed source HTML altered';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Create a revision%' THEN RAISE; END IF; END;
 BEGIN UPDATE vendor_ios SET generated_pdf_url=io||'/replacement.pdf' WHERE id=io; RAISE EXCEPTION 'Signed PDF reference altered';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Create a revision%' THEN RAISE; END IF; END;
 UPDATE vendor_ios SET is_superseded=true WHERE id=io;
 BEGIN PERFORM get_vendor_io_signing_session(NULL,io,actor); RAISE EXCEPTION 'Superseded signed IO accessible';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%SUPERSEDED%' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: owned creator access, foreign creator denial, idempotent audit, frozen HTML/PDF, supersession';
END $$;
INSERT INTO storage.objects VALUES('50000000-0000-4000-8000-000000000001','vendor-io-documents','40000000-0000-4000-8000-000000000001/signed/test.pdf','{}'),
 ('50000000-0000-4000-8000-000000000002','vendor-io-documents','40000000-0000-4000-8000-000000000001/document.pdf','{}');
SET LOCAL ROLE authenticated;
DO $$ DECLARE affected integer; BEGIN
 UPDATE storage.objects SET metadata='{"tampered":true}' WHERE name LIKE '%/signed/%'; GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Signed storage overwrite allowed'; END IF;
 DELETE FROM storage.objects WHERE name LIKE '%/signed/%'; GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Signed storage deletion allowed'; END IF;
 BEGIN INSERT INTO storage.objects VALUES('50000000-0000-4000-8000-000000000003','vendor-io-documents','40000000-0000-4000-8000-000000000001/signed/forged.pdf','{}'); RAISE EXCEPTION 'Signed storage forgery allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE storage.objects SET name='40000000-0000-4000-8000-000000000001/signed/moved.pdf' WHERE name LIKE '%/document.pdf'; RAISE EXCEPTION 'Move into signed namespace allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE storage.objects SET metadata='{"unsigned":true}' WHERE name LIKE '%/document.pdf'; GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Unsigned document workflow broken'; END IF;
 IF has_table_privilege('authenticated','public.vendor_io_signatures','UPDATE') OR has_table_privilege('authenticated','public.vendor_io_signatures','DELETE') OR has_table_privilege('service_role','public.vendor_io_signatures','UPDATE') THEN RAISE EXCEPTION 'Evidence mutation grant'; END IF;
 RAISE NOTICE 'PASS: signed storage insert/update/delete/move denied; unsigned storage still editable; evidence grants read-only';
END $$;
ROLLBACK;
