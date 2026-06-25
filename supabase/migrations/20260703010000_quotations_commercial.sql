-- =============================================================================
-- Phase 2.5 — Discovery, Shortlist & Client Quotation Workspace
-- Foundation: commercial fields, quotations + items, saved filters / recent
-- searches, QT-YYYY-NNNN serial, RLS. Additive + idempotent. NOT auto-applied.
--
-- Reuses existing platform infra (do NOT duplicate):
--   * FX:     public.md_currencies, public.md_exchange_rates,
--             public.resolve_effective_exchange_rate(from,to,as_of)
--   * Serial: public.next_document_number(prefix, padding) + document_sequences
--   * Timestamps: public.set_updated_at()
--   * Permissions: public.has_permission('discovery.read'|'write'|'admin')
--
-- Platform default reporting currency = EGP.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'commercial_input_mode'
  ) THEN
    -- A) cost + gp_pct → revenue, gp_value
    -- B) cost + revenue → gp_pct, gp_value
    -- C) cost + gp_value → revenue, gp_pct
    CREATE TYPE public.commercial_input_mode AS ENUM (
      'cost_gp_pct',
      'cost_revenue',
      'cost_gp_value'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'quotation_status'
  ) THEN
    CREATE TYPE public.quotation_status AS ENUM (
      'draft',
      'under_review',
      'approved',
      'sent',
      'accepted',
      'rejected',
      'cancelled',
      'archived'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Commercial fields on discovery_shortlist_items (Commercial tab, spec §5/§6)
--    Store original cost + currency; snapshot the FX rate to EGP and persist the
--    converted EGP values so totals/reporting never re-query historical rates.
-- -----------------------------------------------------------------------------
ALTER TABLE public.discovery_shortlist_items
  ADD COLUMN IF NOT EXISTS commercial_input_mode public.commercial_input_mode NOT NULL DEFAULT 'cost_gp_pct',
  ADD COLUMN IF NOT EXISTS cost numeric(14, 2),
  ADD COLUMN IF NOT EXISTS cost_currency char(3) REFERENCES public.md_currencies (code),
  ADD COLUMN IF NOT EXISTS gp_pct numeric(7, 4),
  ADD COLUMN IF NOT EXISTS gp_value numeric(14, 2),
  ADD COLUMN IF NOT EXISTS revenue numeric(14, 2),
  ADD COLUMN IF NOT EXISTS fx_rate_to_egp numeric(18, 8),
  ADD COLUMN IF NOT EXISTS cost_egp numeric(14, 2),
  ADD COLUMN IF NOT EXISTS revenue_egp numeric(14, 2),
  ADD COLUMN IF NOT EXISTS gp_value_egp numeric(14, 2),
  ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS commercial_updated_at timestamptz;

COMMENT ON COLUMN public.discovery_shortlist_items.cost_currency IS
  'Original cost currency (default EGP). All *_egp columns are converted via md_exchange_rates at edit time.';

-- -----------------------------------------------------------------------------
-- 2. quotations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text,
  name text NOT NULL,
  status public.quotation_status NOT NULL DEFAULT 'draft',
  -- Optional links — quotations can be ad-hoc (no shortlist) per spec §10.
  shortlist_id uuid REFERENCES public.discovery_shortlists (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  -- Reporting currency is always EGP; cost entry currency is per-item.
  currency char(3) NOT NULL DEFAULT 'EGP' REFERENCES public.md_currencies (code),
  -- Totals are stored in EGP (platform reporting currency).
  total_cost_egp numeric(14, 2) NOT NULL DEFAULT 0,
  total_revenue_egp numeric(14, 2) NOT NULL DEFAULT 0,
  total_gp_value_egp numeric(14, 2) NOT NULL DEFAULT 0,
  total_gp_pct numeric(7, 4) NOT NULL DEFAULT 0,
  notes text,
  terms text,
  -- Approval / signature block (rendered on exports).
  prepared_by_name text,
  prepared_by_signature text,
  client_signature_name text,
  client_signed_at timestamptz,
  -- Client portal readiness (spec §12) — schema only, mirrors shortlist pattern.
  client_visible boolean NOT NULL DEFAULT false,
  client_shared_at timestamptz,
  client_shared_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  client_approval_status text,
  client_comment text,
  is_archived boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS quotations_serial_number_key
  ON public.quotations (serial_number)
  WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotations_status_idx ON public.quotations (status);
CREATE INDEX IF NOT EXISTS quotations_shortlist_idx
  ON public.quotations (shortlist_id) WHERE shortlist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotations_client_idx
  ON public.quotations (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotations_owner_idx ON public.quotations (owner_id);
CREATE INDEX IF NOT EXISTS quotations_archived_idx ON public.quotations (is_archived);

-- -----------------------------------------------------------------------------
-- 3. quotation_items — per-creator commercial lines with quote-time snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations (id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.discovered_profiles (id) ON DELETE SET NULL,
  unified_id text,
  source_shortlist_item_id uuid REFERENCES public.discovery_shortlist_items (id) ON DELETE SET NULL,
  -- Snapshot fields (frozen at quote time so the document is stable).
  creator_name text,
  platform text,
  handle text,
  followers bigint,
  engagement_rate numeric(7, 4),
  country_code char(2),
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Commercials (original currency + EGP-converted).
  commercial_input_mode public.commercial_input_mode NOT NULL DEFAULT 'cost_gp_pct',
  cost numeric(14, 2) NOT NULL DEFAULT 0,
  cost_currency char(3) NOT NULL DEFAULT 'EGP' REFERENCES public.md_currencies (code),
  revenue numeric(14, 2) NOT NULL DEFAULT 0,
  gp_pct numeric(7, 4) NOT NULL DEFAULT 0,
  gp_value numeric(14, 2) NOT NULL DEFAULT 0,
  fx_rate_to_egp numeric(18, 8) NOT NULL DEFAULT 1,
  cost_egp numeric(14, 2) NOT NULL DEFAULT 0,
  revenue_egp numeric(14, 2) NOT NULL DEFAULT 0,
  gp_value_egp numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS quotation_items_quotation_idx
  ON public.quotation_items (quotation_id, sort_order);
CREATE INDEX IF NOT EXISTS quotation_items_influencer_idx
  ON public.quotation_items (influencer_id) WHERE influencer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotation_items_profile_idx
  ON public.quotation_items (profile_id) WHERE profile_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. QT-YYYY-NNNN serial (Postgres-only, never client-side; spec §8)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_quotation_serial(
  p_at timestamptz DEFAULT timezone('utc', now())
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.next_document_number(
    'QT-' || to_char(timezone('utc', p_at), 'YYYY'),
    4
  );
END;
$$;

COMMENT ON FUNCTION public.generate_quotation_serial(timestamptz) IS
  'Generates the next QT-YYYY-NNNN quotation serial. Single source of truth — never generate serials client-side.';

CREATE OR REPLACE FUNCTION public.assign_quotation_serial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.serial_number IS NULL OR btrim(NEW.serial_number) = '' THEN
    NEW.serial_number := public.generate_quotation_serial(timezone('utc', now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_quotations_serial ON public.quotations;
CREATE TRIGGER assign_quotations_serial
  BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.assign_quotation_serial();

DROP TRIGGER IF EXISTS set_quotations_updated_at ON public.quotations;
CREATE TRIGGER set_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_quotation_items_updated_at ON public.quotation_items;
CREATE TRIGGER set_quotation_items_updated_at
  BEFORE UPDATE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Saved filters + recent searches (spec §3) — user-scoped, reusable across
--    Discovery pages. Stored as JSONB filter payloads.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovery_saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'search',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT discovery_saved_filters_owner_name_unique UNIQUE (owner_id, scope, name)
);

CREATE INDEX IF NOT EXISTS discovery_saved_filters_owner_idx
  ON public.discovery_saved_filters (owner_id, scope);

CREATE TABLE IF NOT EXISTS public.discovery_recent_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  query text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  searched_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS discovery_recent_searches_owner_idx
  ON public.discovery_recent_searches (owner_id, searched_at DESC);

DROP TRIGGER IF EXISTS set_discovery_saved_filters_updated_at ON public.discovery_saved_filters;
CREATE TRIGGER set_discovery_saved_filters_updated_at
  BEFORE UPDATE ON public.discovery_saved_filters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. RLS (mirrors discovery_shortlists patterns + service_role bypass)
-- -----------------------------------------------------------------------------
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_recent_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotations_select ON public.quotations;
CREATE POLICY quotations_select ON public.quotations
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR created_by = auth.uid()
    OR public.has_permission('discovery.admin')
    OR public.has_permission('discovery.read')
  );

DROP POLICY IF EXISTS quotations_write ON public.quotations;
CREATE POLICY quotations_write ON public.quotations
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

DROP POLICY IF EXISTS quotation_items_access ON public.quotation_items;
CREATE POLICY quotation_items_access ON public.quotation_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          q.owner_id = auth.uid()
          OR public.has_permission('discovery.write')
          OR public.has_permission('discovery.admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          q.owner_id = auth.uid()
          OR public.has_permission('discovery.write')
          OR public.has_permission('discovery.admin')
        )
    )
  );

DROP POLICY IF EXISTS quotation_items_select ON public.quotation_items;
CREATE POLICY quotation_items_select ON public.quotation_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          q.owner_id = auth.uid()
          OR public.has_permission('discovery.read')
          OR public.has_permission('discovery.admin')
        )
    )
  );

DROP POLICY IF EXISTS discovery_saved_filters_owner ON public.discovery_saved_filters;
CREATE POLICY discovery_saved_filters_owner ON public.discovery_saved_filters
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_permission('discovery.admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_permission('discovery.admin'));

DROP POLICY IF EXISTS discovery_recent_searches_owner ON public.discovery_recent_searches;
CREATE POLICY discovery_recent_searches_owner ON public.discovery_recent_searches
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_permission('discovery.admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_permission('discovery.admin'));

-- -----------------------------------------------------------------------------
-- 7. Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_saved_filters TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_recent_searches TO authenticated, service_role;

COMMENT ON TABLE public.quotations IS
  'Client quotations (QT-YYYY-NNNN). Reporting totals stored in EGP; per-item costs in entry currency converted via md_exchange_rates.';
COMMENT ON TABLE public.quotation_items IS
  'Per-creator quotation lines with quote-time snapshots (followers/ER/country) and EGP-converted commercials.';
