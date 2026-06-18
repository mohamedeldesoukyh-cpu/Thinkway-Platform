-- Client credit limit enforcement: CL Active + Accept risk toggles.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS credit_limit_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_credit_risk boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.credit_limit_active IS
  'When true and credit_limit is set, campaign creation is blocked when exposure exceeds the limit.';
COMMENT ON COLUMN public.clients.accept_credit_risk IS
  'When true, users may acknowledge and proceed past credit limit exceedance.';
