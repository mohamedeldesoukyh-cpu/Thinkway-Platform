BEGIN;
UPDATE tw_accounting_accounts SET name='Banks',version=version+1 WHERE code='112001' AND name='Main Operating Bank' AND kind='Posting' AND account_type='Asset';
COMMIT;
