-- Payment exports may choose installments, but cannot renegotiate agreed fees.
CREATE OR REPLACE FUNCTION public.enforce_creator_payment_agreed_fee()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE agreed numeric;
BEGIN
  SELECT coalesce(a.cost_before_vat, a.agreed_fee,
    (SELECT v.amount FROM vendor_ios v WHERE v.assignment_id=a.id
      AND v.document_generated_at IS NOT NULL ORDER BY v.created_at DESC LIMIT 1), 0)
  INTO agreed FROM campaign_influencers a WHERE a.id=NEW.assignment_id;
  IF agreed IS NULL OR NEW.fee IS DISTINCT FROM round(agreed, 2) THEN
    RAISE EXCEPTION 'Agreed creator fee is read-only. Refresh the campaign agreement.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS creator_payment_agreed_fee_guard ON public.creator_payment_terms;
CREATE TRIGGER creator_payment_agreed_fee_guard
BEFORE INSERT OR UPDATE OF fee ON public.creator_payment_terms
FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_payment_agreed_fee();
