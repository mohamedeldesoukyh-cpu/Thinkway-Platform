\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE io uuid; token text:='signature-regression-token-not-for-delivery'; h text; result jsonb; snapshot text:='<html><body>Test IO 3 UGC</body></html>';
BEGIN
 SELECT id INTO io FROM public.vendor_ios WHERE NOT is_superseded AND NOT EXISTS(SELECT FROM public.vendor_io_signatures s WHERE s.vendor_io_id=vendor_ios.id) LIMIT 1;
 IF io IS NULL THEN RAISE EXCEPTION 'No development IO fixture'; END IF;
 IF has_function_privilege('anon','public.sign_vendor_io(uuid,text,uuid,text,jsonb,text,text,text,timestamptz,inet,text)','execute') OR
    has_function_privilege('authenticated','public.sign_vendor_io(uuid,text,uuid,text,jsonb,text,text,text,timestamptz,inet,text)','execute') THEN RAISE EXCEPTION 'Public signing RPC bypass'; END IF;
 UPDATE public.vendor_ios SET status='sent',terms_html=snapshot,approval_token_hash=public.hash_io_approval_token(token),approval_token_consumed_hash=NULL,approval_token_expires_at=now()+interval '1 hour' WHERE id=io;
 h:=encode(sha256(convert_to(snapshot,'UTF8')),'hex');
 IF has_function_privilege('anon','public.get_vendor_io_signing_session(text,uuid,uuid)','execute') OR has_function_privilege('authenticated','public.get_vendor_io_signing_session(text,uuid,uuid)','execute') THEN RAISE EXCEPTION 'Public session RPC bypass'; END IF;
 result:=public.get_vendor_io_signing_session(token,NULL,NULL);
 IF result->'io'->>'id' IS DISTINCT FROM io::text THEN RAISE EXCEPTION 'Session not scoped to token'; END IF;
 BEGIN PERFORM public.get_vendor_io_signing_session(NULL,io,NULL); RAISE EXCEPTION 'Anonymous ID access succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%APPROVAL_INVALID%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.approve_vendor_io_by_token(token,'Test',NULL); RAISE EXCEPTION 'Legacy bypass succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%SIGNATURE_REQUIRED%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.approve_vendor_io_portal(io,'Test'); RAISE EXCEPTION 'Portal bypass succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%SIGNATURE_REQUIRED%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sign_vendor_io(io,'wrong-token',NULL,'Test Creator','[[[0.1,0.1],[0.8,0.5]]]',h,snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now()); RAISE EXCEPTION 'Wrong token succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%APPROVAL_INVALID%' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sign_vendor_io(io,token,NULL,'Test Creator','[[[0.1,0.1],[0.8,0.5]]]',repeat('a',64),snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now()); RAISE EXCEPTION 'Stale document succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%DOCUMENT_CHANGED%' THEN RAISE; END IF; END;
 UPDATE public.vendor_ios SET approval_token_expires_at=now()-interval '1 second' WHERE id=io;
 BEGIN PERFORM public.sign_vendor_io(io,token,NULL,'Test Creator','[[[0.1,0.1],[0.8,0.5]]]',h,snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now()); RAISE EXCEPTION 'Expired token succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%APPROVAL_EXPIRED%' THEN RAISE; END IF; END;
 UPDATE public.vendor_ios SET approval_token_expires_at=now()+interval '1 hour',is_superseded=true WHERE id=io;
 BEGIN PERFORM public.sign_vendor_io(io,token,NULL,'Test Creator','[[[0.1,0.1],[0.8,0.5]]]',h,snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now()); RAISE EXCEPTION 'Superseded IO succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%APPROVAL_SUPERSEDED%' THEN RAISE; END IF; END;
 UPDATE public.vendor_ios SET is_superseded=false,approval_token_hash=public.hash_io_approval_token(token),approval_token_expires_at=now()+interval '1 hour' WHERE id=io;
 result:=public.sign_vendor_io(io,token,NULL,'Test Creator','[[[0.1,0.1],[0.8,0.5]]]',h,snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now());
 IF (result->>'already_approved')::boolean OR NOT EXISTS(SELECT FROM public.vendor_ios WHERE id=io AND status='approved' AND approved_by_name='Test Creator') THEN RAISE EXCEPTION 'Signature did not approve atomically'; END IF;
 IF NOT EXISTS(SELECT FROM public.vendor_io_signatures WHERE vendor_io_id=io AND document_hash=h AND source_html=snapshot) THEN RAISE EXCEPTION 'Missing snapshot evidence'; END IF;
 result:=public.sign_vendor_io(io,token,NULL,'Another Name','[[[0.1,0.1],[0.8,0.5]]]',h,snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/other.pdf',now());
 IF NOT (result->>'already_approved')::boolean OR (SELECT signer_name FROM public.vendor_io_signatures WHERE vendor_io_id=io)<>'Test Creator' THEN RAISE EXCEPTION 'Duplicate signature replaced evidence'; END IF;
 BEGIN UPDATE public.vendor_ios SET usage_rights='changed' WHERE id=io; RAISE EXCEPTION 'Signed terms changed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Create a revision%' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: token validation, expiry, supersession, unsigned bypass prevention, snapshot hash, atomic approval, replay, immutable terms';
END $$;
ROLLBACK;
