-- Per-VIO agreed payment terms override (falls back to vendor bank details payment_terms)

ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS special_payment_terms text;

COMMENT ON COLUMN public.vendor_ios.special_payment_terms IS
  'Campaign-specific payment terms agreed with influencer; when set, overrides vendor influencers.payment_terms on Vendor IO documents.';
