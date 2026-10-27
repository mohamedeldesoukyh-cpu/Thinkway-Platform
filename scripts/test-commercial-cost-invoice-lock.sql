BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
-- Exercise the deployed billing guard without changing any business records.
CREATE TEMP TABLE revision_lock_test (LIKE public.campaign_lines INCLUDING DEFAULTS);
CREATE TRIGGER guard BEFORE UPDATE ON revision_lock_test FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_line_billing_lock();
INSERT INTO revision_lock_test(id,campaign_header_id,name,document_number,cost,cost_before_vat,revenue,revenue_before_vat,revenue_vat_percent,revenue_vat_exempt,cost_vat_percent,cost_vat_exempt,revenue_locked,vat_locked,cost_locked,metadata)
VALUES(gen_random_uuid(),gen_random_uuid(),'QA','QA-COST-REVISION',100000,100000,200000,200000,14,false,0,true,true,true,false,'{}');
DO $$
DECLARE before_row jsonb; after_row jsonb; blocked boolean;
BEGIN
 SELECT to_jsonb(t)-ARRAY['cost','cost_before_vat','cost_vat_percent','cost_vat_exempt'] INTO before_row FROM revision_lock_test t;
 UPDATE revision_lock_test SET cost=70000,cost_before_vat=70000;
 UPDATE revision_lock_test SET cost_vat_percent=14,cost_vat_exempt=false;
 SELECT to_jsonb(t)-ARRAY['cost','cost_before_vat','cost_vat_percent','cost_vat_exempt'] INTO after_row FROM revision_lock_test t;
 IF before_row IS DISTINCT FROM after_row THEN RAISE EXCEPTION 'Client fields changed'; END IF;
 blocked:=false;
 BEGIN UPDATE revision_lock_test SET revenue_vat_percent=0;
 EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Client VAT lock bypassed'; END IF;
 blocked:=false;
 BEGIN UPDATE revision_lock_test SET revenue_before_vat=190000;
 EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Client revenue lock bypassed'; END IF;
 UPDATE revision_lock_test SET cost_locked=true;
 blocked:=false;
 BEGIN UPDATE revision_lock_test SET cost_before_vat=60000;
 EXCEPTION WHEN check_violation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Vendor cost lock bypassed'; END IF;
 UPDATE revision_lock_test SET cost_locked=false;
 -- All fixture changes are rolled back; no payment or business state persists.
 UPDATE public.campaign_influencers SET vendor_payment_status='paid'
 WHERE id=(SELECT id FROM public.campaign_influencers WHERE campaign_line_id IS NOT NULL LIMIT 1);
 -- Use a paid assignment ID only in the temporary guard table.
 IF EXISTS(SELECT 1 FROM public.campaign_influencers WHERE vendor_payment_status='paid' AND campaign_line_id IS NOT NULL) THEN
   UPDATE revision_lock_test SET id=(SELECT campaign_line_id FROM public.campaign_influencers WHERE vendor_payment_status='paid' AND campaign_line_id IS NOT NULL LIMIT 1);
   blocked:=false;
   BEGIN UPDATE revision_lock_test SET cost_before_vat=50000;
   EXCEPTION WHEN check_violation THEN blocked:=true; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Paid vendor cost changed'; END IF;
 ELSE
   RAISE EXCEPTION 'Paid assignment fixture required';
 END IF;
 RAISE NOTICE 'PASS: unpaid cost and cost VAT editable; client revenue/VAT unchanged and locked; vendor lock retained';
END $$;
ROLLBACK;
