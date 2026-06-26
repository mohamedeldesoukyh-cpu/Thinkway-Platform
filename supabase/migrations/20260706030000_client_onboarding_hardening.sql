-- Promote-to-master-data hardening: optional group on brands, client onboarding status tracking.

-- Brands may exist without a group (aligned with optional client.group_id).
ALTER TABLE public.brands
  ALTER COLUMN group_id DROP NOT NULL;

-- Onboarding lifecycle for legal entities promoted from quotations.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_onboarding_status') THEN
    CREATE TYPE public.client_onboarding_status AS ENUM (
      'draft',
      'legal_pending',
      'finance_pending',
      'ready',
      'active'
    );
  END IF;
END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS onboarding_status public.client_onboarding_status NOT NULL DEFAULT 'legal_pending',
  ADD COLUMN IF NOT EXISTS legal_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS finance_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS contracts_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_onboarding_status_idx ON public.clients (onboarding_status);

COMMENT ON COLUMN public.clients.onboarding_status IS 'Onboarding pipeline stage after promote-to-master-data (default legal_pending).';
COMMENT ON COLUMN public.clients.legal_completed_at IS 'When legal/trade-license onboarding section was completed.';
COMMENT ON COLUMN public.clients.finance_completed_at IS 'When finance approval / client code assignment completed.';
COMMENT ON COLUMN public.clients.contracts_completed_at IS 'When signed contract onboarding section was completed.';
COMMENT ON COLUMN public.clients.tax_completed_at IS 'When VAT/tax registration onboarding section was completed.';

-- Sync brand group from client only when client has a group; otherwise leave brand.group_id null.
CREATE OR REPLACE FUNCTION public.sync_brand_group_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_client_group_id uuid;
BEGIN
  SELECT group_id INTO v_client_group_id FROM public.clients WHERE id = NEW.client_id;

  IF NEW.group_id IS NULL OR TG_OP = 'INSERT' THEN
    NEW.group_id := v_client_group_id;
  END IF;

  RETURN NEW;
END;
$$;
