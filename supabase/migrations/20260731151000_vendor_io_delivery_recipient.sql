-- Store the delivery recipient address (or "Manual") separately from workflow status.

ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS delivery_recipient text;

COMMENT ON COLUMN public.vendor_ios.delivery_recipient IS
  'Actual vendor email used for delivery, or the literal value Manual for manual delivery.';
