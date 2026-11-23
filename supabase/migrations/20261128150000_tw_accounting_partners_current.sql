BEGIN;
-- Add the requested account only under the existing standard Capital group.
-- Stop on a conflicting code rather than overwrite an existing business account.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM tw_accounting_accounts a JOIN tw_accounting_accounts g ON g.company_id=a.company_id AND g.code='310000' AND g.kind='Group' AND g.account_type='Equity' WHERE a.code='313001' AND a.name NOT IN('Partners’ Current Account','Partners Current Account')) THEN RAISE EXCEPTION '313001 already belongs to another account; review the company chart';END IF;
END $$;
INSERT INTO tw_accounting_accounts(company_id,code,name,parent_code,account_type,normal_balance,kind,has_auxiliary)
SELECT company_id,'313001','Partners’ Current Account','310000','Equity','Credit','Posting',true FROM tw_accounting_accounts g WHERE code='310000' AND kind='Group' AND account_type='Equity' AND NOT EXISTS(SELECT 1 FROM tw_accounting_accounts a WHERE a.company_id=g.company_id AND a.code='313001');
COMMIT;
