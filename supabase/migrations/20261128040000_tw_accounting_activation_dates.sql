BEGIN;
-- Nullable for legacy records: existing journal dates and balances are not rewritten.
ALTER TABLE public.tw_accounting_journals ADD COLUMN activation_date date;
CREATE FUNCTION public.tw_accounting_default_activation_date() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.activation_date:=coalesce(NEW.activation_date,NEW.entry_date);RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_default_activation_date() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tw_activation_date BEFORE INSERT ON public.tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_default_activation_date();
CREATE INDEX tw_journals_activation ON public.tw_accounting_journals(company_id,(coalesce(activation_date,entry_date)),id);
DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_save_workflow';
 IF position('SET workflow=w WHERE' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_save_workflow';END IF;
 b:=replace(b,'SET workflow=w WHERE','SET workflow=w,activation_date=coalesce(nullif(p_value->>''activationDate'','''')::date,(p_value->>''date'')::date) WHERE');
 EXECUTE b;
END $patch$;

DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_post_invoice';
 IF position('IF s.status=''posted'' THEN RETURN s.journal_id; END IF;' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_invoice';END IF;
 b:=replace(b,'IF s.status=''posted'' THEN RETURN s.journal_id; END IF;','IF s.status=''posted'' THEN RETURN s.journal_id; END IF; p_date:=(now() AT TIME ZONE ''Africa/Cairo'')::date;');
 IF position('SET entry_date=p_date,' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_invoice';END IF;
 b:=replace(b,'SET entry_date=p_date,','SET entry_date=p_date,activation_date=i.issue_date,');
 IF position('company_id,entry_date,reference,memo,created_by,source_invoice_id' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_invoice';END IF;
 b:=replace(b,'company_id,entry_date,reference,memo,created_by,source_invoice_id','company_id,entry_date,activation_date,reference,memo,created_by,source_invoice_id');
 IF position('VALUES(jid,p_company,p_date,left(i.document_number' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_invoice';END IF;
 b:=replace(b,'VALUES(jid,p_company,p_date,left(i.document_number','VALUES(jid,p_company,p_date,i.issue_date,left(i.document_number');
 EXECUTE b;
END $patch$;
DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_post_mapped_invoice';
 IF position('IF s.status=''posted'' THEN RETURN s.journal_id; END IF;' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_mapped_invoice';END IF;
 b:=replace(b,'IF s.status=''posted'' THEN RETURN s.journal_id; END IF;','IF s.status=''posted'' THEN RETURN s.journal_id; END IF; p_date:=(now() AT TIME ZONE ''Africa/Cairo'')::date;');
 IF position('SET entry_date=p_date,' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_mapped_invoice';END IF;
 b:=replace(b,'SET entry_date=p_date,','SET entry_date=p_date,activation_date=i.issue_date,');
 IF position('company_id,entry_date,reference,memo,created_by,source_invoice_id' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_mapped_invoice';END IF;
 b:=replace(b,'company_id,entry_date,reference,memo,created_by,source_invoice_id','company_id,entry_date,activation_date,reference,memo,created_by,source_invoice_id');
 IF position('VALUES(jid,p_company,p_date,left(i.document_number' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_post_mapped_invoice';END IF;
 b:=replace(b,'VALUES(jid,p_company,p_date,left(i.document_number','VALUES(jid,p_company,p_date,i.issue_date,left(i.document_number');
 EXECUTE b;
END $patch$;


DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_cost_post';
 IF position('c.document_date BETWEEN p.start_date' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_cost_post';END IF;
 b:=replace(b,'c.document_date BETWEEN p.start_date','(now() AT TIME ZONE ''Africa/Cairo'')::date BETWEEN p.start_date');
 IF position('SET entry_date=c.document_date,' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_cost_post';END IF;
 b:=replace(b,'SET entry_date=c.document_date,','SET entry_date=(now() AT TIME ZONE ''Africa/Cairo'')::date,activation_date=coalesce(c.supplier_date,c.document_date),');
 IF position('company_id,entry_date,reference,memo,created_by,automatic_source' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_cost_post';END IF;
 b:=replace(b,'company_id,entry_date,reference,memo,created_by,automatic_source','company_id,entry_date,activation_date,reference,memo,created_by,automatic_source');
 IF position('VALUES(j,p_company,c.document_date,c.number' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_cost_post';END IF;
 b:=replace(b,'VALUES(j,p_company,c.document_date,c.number','VALUES(j,p_company,(now() AT TIME ZONE ''Africa/Cairo'')::date,coalesce(c.supplier_date,c.document_date),c.number');
 EXECUTE b;
END $patch$;

DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_media_post';
 IF position('(s->>''date'')::date BETWEEN p.start_date' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_media_post';END IF;
 b:=replace(b,'(s->>''date'')::date BETWEEN p.start_date','(now() AT TIME ZONE ''Africa/Cairo'')::date BETWEEN p.start_date');
 IF position('SET entry_date=(s->>''date'')::date,' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_media_post';END IF;
 b:=replace(b,'SET entry_date=(s->>''date'')::date,','SET entry_date=(now() AT TIME ZONE ''Africa/Cairo'')::date,activation_date=(s->>''date'')::date,');
 IF position('company_id,entry_date,reference,memo,created_by,automatic_source' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_media_post';END IF;
 b:=replace(b,'company_id,entry_date,reference,memo,created_by,automatic_source','company_id,entry_date,activation_date,reference,memo,created_by,automatic_source');
 IF position('VALUES(j,p_company,(s->>''date'')::date,s->>''number''' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_media_post';END IF;
 b:=replace(b,'VALUES(j,p_company,(s->>''date'')::date,s->>''number''','VALUES(j,p_company,(now() AT TIME ZONE ''Africa/Cairo'')::date,(s->>''date'')::date,s->>''number''');
 EXECUTE b;
END $patch$;

DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_statement_filtered';
 IF position('p_kind NOT IN(''all'',''client'',''vendor'')' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_statement_filtered';END IF;
 b:=replace(b,'p_kind NOT IN(''all'',''client'',''vendor'')','coalesce(p_options->>''dateBasis'',''journal'') NOT IN(''journal'',''activation'') OR p_kind NOT IN(''all'',''client'',''vendor'')');
 IF position('j.entry_date,j.voucher_number' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_statement_filtered';END IF;
 b:=replace(b,'j.entry_date,j.voucher_number','CASE WHEN coalesce(p_options->>''dateBasis'',''journal'')=''activation'' THEN coalesce(j.activation_date,j.entry_date) ELSE j.entry_date END entry_date,j.voucher_number');
 IF position('AND j.entry_date<=p_to' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_statement_filtered';END IF;
 b:=replace(b,'AND j.entry_date<=p_to','AND (CASE WHEN coalesce(p_options->>''dateBasis'',''journal'')=''activation'' THEN coalesce(j.activation_date,j.entry_date) ELSE j.entry_date END)<=p_to');
 EXECUTE b;
END $patch$;

DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_open_items';
 IF position('i.issue_date date,i.due_date due' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_open_items';END IF;
 b:=replace(b,'i.issue_date date,i.due_date due','coalesce((SELECT activation_date FROM tw_accounting_journals WHERE id=s.journal_id),i.issue_date) date,(SELECT entry_date FROM tw_accounting_journals WHERE id=s.journal_id) "journalDate",i.due_date due');
 IF position('c.document_date date,c.due_date due' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_open_items';END IF;
 b:=replace(b,'c.document_date date,c.due_date due','coalesce(c.supplier_date,(SELECT activation_date FROM tw_accounting_journals WHERE id=c.journal_id),c.document_date) date,(SELECT entry_date FROM tw_accounting_journals WHERE id=c.journal_id) "journalDate",c.due_date due');
 EXECUTE b;
END $patch$;

DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_aging';
 IF position('''date'',b.snapshot->>''date'',''due'',NULL' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_aging';END IF;
 b:=replace(b,'''date'',b.snapshot->>''date'',''due'',NULL','''date'',coalesce(j.activation_date::text,b.snapshot->>''date''),''journalDate'',j.entry_date,''due'',NULL');
 EXECUTE b;
END $patch$;
DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_cost_reconcile';
 IF position('IF p_date IS NULL OR p_number IS NULL' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_cost_reconcile';END IF;
 b:=replace(b,'IF p_date IS NULL OR p_number IS NULL','p_date:=(now() AT TIME ZONE ''Africa/Cairo'')::date; IF p_date IS NULL OR p_number IS NULL');
 IF position('company_id,entry_date,reference,memo' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_cost_reconcile';END IF;
 b:=replace(b,'company_id,entry_date,reference,memo','company_id,entry_date,activation_date,reference,memo');
 IF position('VALUES(j,p_company,p_date,c.number' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_cost_reconcile';END IF;
 b:=replace(b,'VALUES(j,p_company,p_date,c.number','VALUES(j,p_company,p_date,p_supplier_date,c.number');
 EXECUTE b;
END $patch$;
DO $patch$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT b FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='tw_accounting_invoice_accrual_plan';
 IF position('item->>''currency'',j.entry_date)' IN b)=0 THEN RAISE EXCEPTION 'Unexpected definition: tw_accounting_invoice_accrual_plan';END IF;
 b:=replace(b,'item->>''currency'',j.entry_date)','item->>''currency'',coalesce(j.exchange_rate_date,j.activation_date,j.entry_date))');
 EXECUTE b;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
