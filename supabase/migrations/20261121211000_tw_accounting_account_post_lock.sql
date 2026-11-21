BEGIN;
CREATE OR REPLACE FUNCTION public.tw_accounting_protect_used_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM tw_accounting_companies WHERE id=OLD.company_id FOR UPDATE;
 IF (NEW.kind,NEW.account_type,NEW.normal_balance,NEW.parent_code) IS DISTINCT FROM (OLD.kind,OLD.account_type,OLD.normal_balance,OLD.parent_code)
 AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id WHERE l.company_id=OLD.company_id AND l.account_code=OLD.code AND j.status='posted')
 THEN RAISE EXCEPTION 'An account with posted activity cannot change its classification, balance side or parent'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tw_accounting_ledger(p_company uuid,p_account text,p_from date,p_to date,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE opening numeric; debit numeric; credit numeric; n bigint; rows jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid report parameters'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account AND kind<>'Group') THEN RAISE EXCEPTION 'Select a detail account'; END IF;
 SELECT coalesce(sum(l.debit-l.credit) FILTER(WHERE j.entry_date<p_from),0),coalesce(sum(l.debit) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to),0),coalesce(sum(l.credit) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to),0),count(*) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to)
 INTO opening,debit,credit,n FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
 WHERE l.company_id=p_company AND l.account_code=p_account AND j.status='posted' AND j.entry_date<=p_to;
 WITH entries AS (
 SELECT j.id,j.entry_date,j.voucher_number,j.memo,j.reference,j.reversal_of,l.line_number,l.description,l.debit,l.credit,
 opening+sum(l.debit-l.credit) OVER(ORDER BY j.entry_date,j.voucher_number,j.id,l.line_number ROWS UNBOUNDED PRECEDING) balance
 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
 WHERE l.company_id=p_company AND l.account_code=p_account AND j.status='posted' AND j.entry_date BETWEEN p_from AND p_to
 ORDER BY j.entry_date,j.voucher_number,j.id,l.line_number LIMIT 100 OFFSET p_offset)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'date',entry_date,'number',voucher_number,'memo',memo,'reference',reference,'reversalOf',reversal_of,'line',line_number,'description',description,'debit',e.debit::text,'credit',e.credit::text,'balance',balance::text) ORDER BY entry_date,voucher_number,id,line_number),'[]'::jsonb) INTO rows FROM entries e;
 RETURN jsonb_build_object('opening',opening::text,'debit',debit::text,'credit',credit::text,'closing',(opening+debit-credit)::text,'count',n,'rows',rows);
END $$;


COMMIT;
