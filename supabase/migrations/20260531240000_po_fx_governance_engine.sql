-- Enterprise PO governance, FX master data, and budget consumption engine.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'po_status'
  ) THEN
    CREATE TYPE public.po_status AS ENUM (
      'draft',
      'active',
      'near_limit',
      'exceeded',
      'expired',
      'closed'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Currency master enhancements
-- ---------------------------------------------------------------------------
ALTER TABLE public.md_currencies
  ADD COLUMN IF NOT EXISTS country_code char(2);

INSERT INTO public.md_currencies (code, name, symbol, decimal_places, is_active)
VALUES
  ('GBP', 'British Pound', '£', 2, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    is_active = true;

-- ---------------------------------------------------------------------------
-- Exchange rates (effective-dated, historical preservation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency char(3) NOT NULL REFERENCES public.md_currencies (code),
  to_currency char(3) NOT NULL REFERENCES public.md_currencies (code),
  exchange_rate numeric(18, 8) NOT NULL CHECK (exchange_rate > 0),
  effective_start_date date NOT NULL,
  effective_end_date date,
  is_active boolean NOT NULL DEFAULT true,
  source text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT md_exchange_rates_date_range CHECK (
    effective_end_date IS NULL OR effective_end_date >= effective_start_date
  ),
  CONSTRAINT md_exchange_rates_pair_distinct CHECK (from_currency <> to_currency)
);

CREATE INDEX IF NOT EXISTS md_exchange_rates_pair_dates_idx
  ON public.md_exchange_rates (from_currency, to_currency, effective_start_date DESC);

CREATE INDEX IF NOT EXISTS md_exchange_rates_active_idx
  ON public.md_exchange_rates (is_active)
  WHERE is_active = true;

-- Seed common cross rates (skip if pair+start already exists)
INSERT INTO public.md_exchange_rates (
  from_currency, to_currency, exchange_rate, effective_start_date, source, notes
)
SELECT v.from_currency, v.to_currency, v.exchange_rate, v.effective_start_date, v.source, v.notes
FROM (
  VALUES
    ('USD'::char(3), 'EGP'::char(3), 50.00000000::numeric, '2026-01-01'::date, 'seed', 'Initial USD→EGP rate'),
    ('USD'::char(3), 'EGP'::char(3), 52.00000000::numeric, '2026-03-01'::date, 'seed', 'Updated USD→EGP rate'),
    ('USD'::char(3), 'AED'::char(3), 3.67250000::numeric, '2026-01-01'::date, 'seed', 'USD→AED peg'),
    ('USD'::char(3), 'SAR'::char(3), 3.75000000::numeric, '2026-01-01'::date, 'seed', 'USD→SAR peg'),
    ('USD'::char(3), 'EUR'::char(3), 0.92000000::numeric, '2026-01-01'::date, 'seed', 'USD→EUR'),
    ('USD'::char(3), 'GBP'::char(3), 0.79000000::numeric, '2026-01-01'::date, 'seed', 'USD→GBP')
) AS v(from_currency, to_currency, exchange_rate, effective_start_date, source, notes)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.md_exchange_rates r
  WHERE r.from_currency = v.from_currency
    AND r.to_currency = v.to_currency
    AND r.effective_start_date = v.effective_start_date
);

-- ---------------------------------------------------------------------------
-- FX & PO audit logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fx_rate_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_rate_id uuid REFERENCES public.md_exchange_rates (id) ON DELETE SET NULL,
  action text NOT NULL,
  old_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  override_reason text,
  recalculation_scope text,
  impacted_record_count integer NOT NULL DEFAULT 0,
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.po_governance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  action text NOT NULL,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  override_reason text,
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS po_governance_logs_header_idx
  ON public.po_governance_logs (campaign_header_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.finance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Future-ready: multiple POs per campaign
CREATE TABLE IF NOT EXISTS public.campaign_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  po_number text NOT NULL,
  po_currency char(3) NOT NULL REFERENCES public.md_currencies (code),
  po_exchange_rate numeric(18, 8) NOT NULL DEFAULT 1 CHECK (po_exchange_rate > 0),
  po_amount_original numeric(14, 2) NOT NULL DEFAULT 0 CHECK (po_amount_original >= 0),
  po_amount_campaign_currency numeric(14, 2) NOT NULL DEFAULT 0 CHECK (po_amount_campaign_currency >= 0),
  po_consumed_amount numeric(14, 2) NOT NULL DEFAULT 0,
  po_remaining_amount numeric(14, 2) NOT NULL DEFAULT 0,
  po_remaining_percent numeric(8, 4),
  po_status public.po_status NOT NULL DEFAULT 'draft',
  po_expiry_date date,
  is_primary boolean NOT NULL DEFAULT false,
  po_override_approved boolean NOT NULL DEFAULT false,
  po_override_reason text,
  fx_snapshot_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS campaign_purchase_orders_header_idx
  ON public.campaign_purchase_orders (campaign_header_id);

-- ---------------------------------------------------------------------------
-- Campaign header PO fields (primary PO summary + FX snapshot)
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_number text;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_currency char(3) REFERENCES public.md_currencies (code);

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_exchange_rate numeric(18, 8);

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_amount_original numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_amount_campaign_currency numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_consumed_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_remaining_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_remaining_percent numeric(8, 4);

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_status public.po_status NOT NULL DEFAULT 'draft';

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_expiry_date date;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_override_approved boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS po_override_reason text;

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS fx_snapshot_at timestamptz;

-- FX snapshot on lines/invoices (preserve historical conversion)
ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS fx_from_currency char(3) REFERENCES public.md_currencies (code);

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS fx_to_currency char(3) REFERENCES public.md_currencies (code);

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS fx_snapshot_at timestamptz;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS po_override_flag boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- PO status computation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_po_status(
  p_po_amount numeric,
  p_consumed numeric,
  p_remaining_percent numeric,
  p_expiry date,
  p_current_status public.po_status DEFAULT 'draft'
)
RETURNS public.po_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_current_status = 'closed' THEN
    RETURN 'closed';
  END IF;

  IF p_po_amount IS NULL OR p_po_amount <= 0 THEN
    RETURN 'draft';
  END IF;

  IF p_expiry IS NOT NULL AND p_expiry < CURRENT_DATE THEN
    RETURN 'expired';
  END IF;

  IF COALESCE(p_consumed, 0) > p_po_amount THEN
    RETURN 'exceeded';
  END IF;

  IF p_remaining_percent IS NOT NULL AND p_remaining_percent <= 15 THEN
    RETURN 'near_limit';
  END IF;

  RETURN 'active';
END;
$$;

-- ---------------------------------------------------------------------------
-- Effective FX lookup (as-of date, preserves history)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_effective_exchange_rate(
  p_from_currency char(3),
  p_to_currency char(3),
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rate numeric;
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN 1;
  END IF;

  SELECT r.exchange_rate
  INTO v_rate
  FROM public.md_exchange_rates r
  WHERE r.from_currency = p_from_currency
    AND r.to_currency = p_to_currency
    AND r.is_active = true
    AND r.effective_start_date <= p_as_of
    AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
  ORDER BY r.effective_start_date DESC
  LIMIT 1;

  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;

  -- Inverse pair fallback
  SELECT ROUND(1 / r.exchange_rate, 8)
  INTO v_rate
  FROM public.md_exchange_rates r
  WHERE r.from_currency = p_to_currency
    AND r.to_currency = p_from_currency
    AND r.is_active = true
    AND r.effective_start_date <= p_as_of
    AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
  ORDER BY r.effective_start_date DESC
  LIMIT 1;

  RETURN COALESCE(v_rate, 1);
END;
$$;

-- ---------------------------------------------------------------------------
-- PO consumption from assignment revenue_before_vat (VAT excluded)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_campaign_header_po_consumption(p_header_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_consumed numeric;
  v_po_amount numeric;
  v_remaining numeric;
  v_remaining_pct numeric;
  v_expiry date;
  v_status public.po_status;
  v_current_status public.po_status;
BEGIN
  SELECT COALESCE(SUM(COALESCE(revenue_before_vat, revenue, 0)), 0)
  INTO v_consumed
  FROM public.campaign_lines
  WHERE campaign_header_id = p_header_id;

  SELECT
    po_amount_campaign_currency,
    po_expiry_date,
    po_status
  INTO v_po_amount, v_expiry, v_current_status
  FROM public.campaign_headers
  WHERE id = p_header_id;

  v_remaining := ROUND(COALESCE(v_po_amount, 0) - COALESCE(v_consumed, 0), 2);

  IF COALESCE(v_po_amount, 0) > 0 THEN
    v_remaining_pct := ROUND((v_remaining / v_po_amount) * 100, 4);
  ELSE
    v_remaining_pct := NULL;
  END IF;

  v_status := public.compute_po_status(
    v_po_amount,
    v_consumed,
    v_remaining_pct,
    v_expiry,
    v_current_status
  );

  UPDATE public.campaign_headers
  SET
    po_consumed_amount = ROUND(v_consumed, 2),
    po_remaining_amount = v_remaining,
    po_remaining_percent = v_remaining_pct,
    po_status = v_status
  WHERE id = p_header_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_campaign_header_po_consumption()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_header_id uuid;
BEGIN
  v_header_id := COALESCE(NEW.campaign_header_id, OLD.campaign_header_id);
  IF v_header_id IS NOT NULL THEN
    PERFORM public.sync_campaign_header_po_consumption(v_header_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_header_po_on_line_change ON public.campaign_lines;
CREATE TRIGGER sync_header_po_on_line_change
  AFTER INSERT OR UPDATE OF revenue_before_vat, revenue, campaign_header_id OR DELETE
  ON public.campaign_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_campaign_header_po_consumption();

-- Backfill header PO from line PO totals where header PO not set
UPDATE public.campaign_headers h
SET
  po_amount_campaign_currency = COALESCE(sub.po_total, 0),
  po_amount_original = COALESCE(sub.po_total, 0),
  po_currency = h.currency_code,
  po_exchange_rate = 1,
  po_status = CASE
    WHEN COALESCE(sub.po_total, 0) > 0 THEN 'active'::public.po_status
    ELSE 'draft'::public.po_status
  END
FROM (
  SELECT campaign_header_id, SUM(po_amount) AS po_total
  FROM public.campaign_lines
  GROUP BY campaign_header_id
) sub
WHERE h.id = sub.campaign_header_id
  AND COALESCE(h.po_amount_campaign_currency, 0) = 0
  AND COALESCE(sub.po_total, 0) > 0;

-- Sync consumption for all headers
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.campaign_headers LOOP
    PERFORM public.sync_campaign_header_po_consumption(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Generic audit writer (referenced by billing/governance migrations)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.audit_action;
BEGIN
  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'create'::public.audit_action
    WHEN 'UPDATE' THEN 'update'::public.audit_action
    WHEN 'DELETE' THEN 'delete'::public.audit_action
  END;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  VALUES (
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_campaign_headers_changes ON public.campaign_headers;
CREATE TRIGGER audit_campaign_headers_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_headers
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

ALTER TABLE public.md_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rate_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_governance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS md_exchange_rates_select ON public.md_exchange_rates;
CREATE POLICY md_exchange_rates_select ON public.md_exchange_rates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS md_exchange_rates_write ON public.md_exchange_rates;
CREATE POLICY md_exchange_rates_write ON public.md_exchange_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS fx_rate_audit_logs_select ON public.fx_rate_audit_logs;
CREATE POLICY fx_rate_audit_logs_select ON public.fx_rate_audit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS po_governance_logs_select ON public.po_governance_logs;
CREATE POLICY po_governance_logs_select ON public.po_governance_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS finance_notifications_select ON public.finance_notifications;
CREATE POLICY finance_notifications_select ON public.finance_notifications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS campaign_purchase_orders_select ON public.campaign_purchase_orders;
CREATE POLICY campaign_purchase_orders_select ON public.campaign_purchase_orders
  FOR SELECT TO authenticated USING (true);
