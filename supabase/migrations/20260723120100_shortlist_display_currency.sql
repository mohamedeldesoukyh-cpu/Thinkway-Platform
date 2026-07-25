-- Shortlist display currency (propagates to quotation header currency).
-- Totals remain stored in EGP; this is the document display / commercial currency.

ALTER TABLE public.discovery_shortlists
  ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'EGP'
    REFERENCES public.md_currencies (code);

COMMENT ON COLUMN public.discovery_shortlists.currency IS
  'Shortlist commercial display currency. Copied to quotations.currency when a quotation is generated; line costs may still use any entry currency converted via md_exchange_rates.';
