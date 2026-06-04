-- Assignment multi-currency cost: received amount + currency; cost_before_vat remains LC.

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS cost_received numeric,
  ADD COLUMN IF NOT EXISTS cost_received_currency char(3) REFERENCES public.md_currencies (code);

UPDATE public.campaign_lines
SET
  cost_received = COALESCE(cost_received, cost_before_vat, cost, 0),
  cost_received_currency = COALESCE(cost_received_currency, fx_from_currency, currency_code)
WHERE cost_received IS NULL OR cost_received_currency IS NULL;

COMMENT ON COLUMN public.campaign_lines.cost_received IS 'Original creator/vendor cost in cost_received_currency';
COMMENT ON COLUMN public.campaign_lines.cost_received_currency IS 'Currency of cost_received; converted to currency_code via fx_rate';
