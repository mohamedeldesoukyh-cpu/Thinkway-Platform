\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE io uuid; assignment uuid; line uuid; legacy text; token text:='signature-regression-token-not-for-delivery'; h text; result jsonb; snapshot text:='<html><body>Test IO 3 UGC</body></html>';
BEGIN
 SELECT v.id,a.id,a.campaign_line_id,v.terms_html INTO io,assignment,line,legacy
 FROM public.vendor_ios v JOIN public.campaign_influencers a ON a.id=v.assignment_id
 WHERE NOT v.is_superseded AND a.campaign_line_id IS NOT NULL
 AND NOT EXISTS(SELECT FROM public.vendor_io_signatures s WHERE s.vendor_io_id=v.id)
 AND NOT EXISTS(SELECT FROM public.creator_payment_entries e WHERE e.assignment_id=a.id) LIMIT 1;
 IF io IS NULL THEN RAISE EXCEPTION 'No development IO fixture'; END IF;
 IF has_function_privilege('anon','public.sign_vendor_io(uuid,text,uuid,text,jsonb,text,text,text,timestamptz,inet,text)','execute') OR
    has_function_privilege('authenticated','public.sign_vendor_io(uuid,text,uuid,text,jsonb,text,text,text,timestamptz,inet,text)','execute') THEN RAISE EXCEPTION 'Public signing RPC bypass'; END IF;
 -- Every fixture mutation and notification is rolled back; no email is sent.
 UPDATE public.vendor_ios SET signing_document_html=snapshot WHERE id=io;
 UPDATE public.vendor_ios SET terms_html='<html>Regenerated unsigned document</html>' WHERE id=io;
 IF (SELECT signing_document_html FROM public.vendor_ios WHERE id=io) IS NOT NULL THEN RAISE EXCEPTION 'Stale snapshot survived regeneration'; END IF;
 UPDATE public.vendor_ios SET terms_html=legacy WHERE id=io;
 UPDATE public.campaign_influencers SET vendor_payment_status='paid' WHERE id=assignment;
 IF NOT public.assignment_vendor_payment_locked(line) THEN RAISE EXCEPTION 'Payment lock fixture failed'; END IF;
 BEGIN UPDATE public.vendor_ios SET terms_html=snapshot WHERE id=io; RAISE EXCEPTION 'Paid terms changed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Vendor payment is recorded%' THEN RAISE; END IF; END;
 BEGIN UPDATE public.vendor_ios SET amount=amount+1 WHERE id=io; RAISE EXCEPTION 'Paid amount changed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Vendor payment is recorded%' THEN RAISE; END IF; END;
 UPDATE public.vendor_ios SET status='sent',signing_document_html=snapshot,approval_token_hash=public.hash_io_approval_token(token),approval_token_consumed_hash=NULL,approval_token_expires_at=now()+interval '1 hour' WHERE id=io;
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 token:=public.send_vendor_io(io,(SELECT created_by FROM public.vendor_ios WHERE id=io));
 IF NOT EXISTS(SELECT FROM public.vendor_ios WHERE id=io AND status='sent') THEN RAISE EXCEPTION 'Paid IO send transition failed'; END IF;
 result:=public.get_vendor_io_signing_session(token,NULL,NULL);
 IF result->'io'->>'terms_html' IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'Signing session ignored delivery snapshot'; END IF;
 UPDATE public.vendor_ios SET signing_document_html=NULL WHERE id=io;
 result:=public.get_vendor_io_signing_session(token,NULL,NULL);
 IF result->'io'->>'terms_html' IS DISTINCT FROM legacy THEN RAISE EXCEPTION 'Legacy fallback failed'; END IF;
 UPDATE public.vendor_ios SET signing_document_html=snapshot WHERE id=io;
 IF (SELECT terms_html FROM public.vendor_ios WHERE id=io) IS DISTINCT FROM legacy THEN RAISE EXCEPTION 'Commercial HTML changed'; END IF;
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
 UPDATE public.vendor_ios SET approval_token_expires_at=now()+interval '1 hour' WHERE id=io;
 result:=public.sign_vendor_io(io,token,NULL,'Test Creator','[[[0.1,0.1],[0.8,0.5]]]',h,snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/test.pdf',now());
 IF (result->>'already_approved')::boolean OR NOT EXISTS(SELECT FROM public.vendor_ios WHERE id=io AND status='approved' AND approved_by_name='Test Creator') THEN RAISE EXCEPTION 'Signature did not approve atomically'; END IF;
 IF NOT EXISTS(SELECT FROM public.vendor_io_signatures WHERE vendor_io_id=io AND document_hash=h AND source_html=snapshot) THEN RAISE EXCEPTION 'Missing snapshot evidence'; END IF;
 result:=public.sign_vendor_io(io,token,NULL,'Another Name','[[[0.1,0.1],[0.8,0.5]]]',h,snapshot||'<div data-io-signature="signed">Signed</div>',io||'/signed/other.pdf',now());
 IF NOT (result->>'already_approved')::boolean OR (SELECT signer_name FROM public.vendor_io_signatures WHERE vendor_io_id=io)<>'Test Creator' THEN RAISE EXCEPTION 'Duplicate signature replaced evidence'; END IF;
 BEGIN UPDATE public.vendor_ios SET usage_rights='changed' WHERE id=io; RAISE EXCEPTION 'Signed terms changed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Create a revision%' THEN RAISE; END IF; END;
 BEGIN UPDATE public.vendor_ios SET signing_document_html='changed' WHERE id=io; RAISE EXCEPTION 'Signed snapshot changed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%Create a revision%' THEN RAISE; END IF; END;
 RAISE NOTICE 'PASS: paid IO delivery, paid commercial locks, legacy fallback, regeneration invalidation, immutable signed snapshot; token validation, expiry, unsigned bypass prevention, snapshot hash, atomic approval, replay, immutable terms';
END $$;
ROLLBACK;
