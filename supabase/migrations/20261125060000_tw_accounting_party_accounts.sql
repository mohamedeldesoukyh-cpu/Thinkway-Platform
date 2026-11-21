BEGIN;
ALTER TABLE tw_accounting_accounts ADD COLUMN client_id uuid REFERENCES clients(id),ADD COLUMN vendor_id uuid REFERENCES influencers(id),ADD CONSTRAINT accounting_account_one_party CHECK(client_id IS NULL OR vendor_id IS NULL);
CREATE OR REPLACE FUNCTION tw_accounting_auxiliary_account_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM tw_accounting_companies WHERE id=NEW.company_id FOR UPDATE;
 IF NEW.kind='Control' AND NEW.subledger IN('Customer','Supplier / creator') AND NEW.has_auxiliary THEN RAISE EXCEPTION 'Client and vendor accounts cannot have auxiliaries'; END IF;
 IF NEW.kind='Control' AND NEW.subledger='Employee' THEN NEW.has_auxiliary:=true; END IF;
 IF NEW.client_id IS NOT NULL AND (NEW.kind<>'Control' OR NEW.subledger<>'Customer') OR NEW.vendor_id IS NOT NULL AND (NEW.kind<>'Control' OR NEW.subledger<>'Supplier / creator') THEN RAISE EXCEPTION 'Choose the matching client or vendor account type'; END IF;
 IF TG_OP='UPDATE' AND (NEW.client_id,NEW.vendor_id) IS DISTINCT FROM (OLD.client_id,OLD.vendor_id) AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Move all transactions out before changing the linked client or vendor'; END IF;
 IF NEW.kind NOT IN('Posting','Control') AND NEW.has_auxiliary THEN RAISE EXCEPTION 'Only detail accounts can have auxiliaries'; END IF;
 IF TG_OP='UPDATE' AND (NEW.has_auxiliary,NEW.subledger) IS DISTINCT FROM(OLD.has_auxiliary,OLD.subledger) THEN
 PERFORM 1 FROM tw_accounting_companies WHERE id=OLD.company_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Move all transactions out of this account before changing auxiliary settings'; END IF;
 IF NEW.subledger IS DISTINCT FROM OLD.subledger AND EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Existing auxiliaries keep their client/vendor directory type; use a new account for a different directory'; END IF;
 END IF;RETURN NEW;
END $$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code WHERE a.kind='Control' AND a.subledger IN('Customer','Supplier / creator') AND a.has_auxiliary) THEN RAISE EXCEPTION 'Existing client/vendor journals need a reviewed migration before changing their account hierarchy'; END IF;
END $$;
UPDATE tw_accounting_accounts SET has_auxiliary=false WHERE kind='Control' AND subledger IN('Customer','Supplier / creator');
CREATE OR REPLACE FUNCTION tw_accounting_auxiliary_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE;x tw_accounting_auxiliaries%ROWTYPE;reversing boolean;BEGIN
 SELECT reversal_of IS NOT NULL INTO reversing FROM tw_accounting_journals WHERE id=NEW.journal_id;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.account_code;
 IF a.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM a.client_id THEN RAISE EXCEPTION 'This account belongs to a different client'; END IF;
 IF a.vendor_id IS NOT NULL AND NEW.vendor_id IS DISTINCT FROM a.vendor_id THEN RAISE EXCEPTION 'This account belongs to a different vendor'; END IF;
 IF NOT a.has_auxiliary THEN IF NEW.auxiliary_id IS NOT NULL THEN RAISE EXCEPTION 'This account has no auxiliaries'; END IF;RETURN NEW;END IF;
 IF a.kind='Control' AND a.subledger IN('Customer','Supplier / creator') AND NOT(coalesce(reversing,false) AND NEW.auxiliary_id IS NOT NULL) THEN
 NEW.auxiliary_id:=tw_accounting_auxiliary_link(NEW.company_id,NEW.account_code,NEW.client_id,NEW.vendor_id);
 END IF;
 IF NEW.auxiliary_id IS NULL AND a.kind='Posting' THEN NEW.auxiliary_id:=nullif(coalesce(nullif(current_setting('tw.accounting_auxiliaries',true),''),'{}')::jsonb->>NEW.account_code,'')::uuid; END IF;
 SELECT * INTO x FROM tw_accounting_auxiliaries WHERE id=NEW.auxiliary_id AND company_id=NEW.company_id AND account_code=NEW.account_code;
 IF NOT FOUND OR (NOT x.active AND NOT coalesce(reversing,false)) THEN RAISE EXCEPTION 'Select an active auxiliary under this account'; END IF;
 RETURN NEW;
END $$;

COMMIT;
