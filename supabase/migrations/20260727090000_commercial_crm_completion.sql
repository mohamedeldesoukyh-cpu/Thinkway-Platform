-- Commercial CRM completion (additive): lifecycle statuses, CRM list RPC,
-- multi bank accounts, client/brand commercial requirements, safe backfill.

-- 1) Lifecycle statuses (map product lifecycle onto creator_crm_status)
DO $$
BEGIN
  ALTER TYPE public.creator_crm_status ADD VALUE IF NOT EXISTS 'draft';
  ALTER TYPE public.creator_crm_status ADD VALUE IF NOT EXISTS 'pending_legal';
  ALTER TYPE public.creator_crm_status ADD VALUE IF NOT EXISTS 'pending_finance';
  ALTER TYPE public.creator_crm_status ADD VALUE IF NOT EXISTS 'archived';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Vendor list count supports commercial-only filter
CREATE OR REPLACE FUNCTION public.vendor_list_total_count(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_crm_only boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(trim(p_search), '');
  v_status text := NULLIF(trim(p_status), '');
  v_platform text := NULLIF(trim(p_platform), '');
  v_pattern text;
  v_total bigint;
BEGIN
  IF NOT public.has_permission('influencers.read') THEN
    RETURN 0;
  END IF;

  v_pattern := CASE
    WHEN v_search IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    END;

  IF public.is_internal_user() THEN
    SELECT COUNT(*)::bigint
    INTO v_total
    FROM public.influencers i
    WHERE (NOT p_crm_only OR i.has_commercial_profile = true)
      AND (v_status IS NULL OR i.status::text = v_status)
      AND (
        v_pattern IS NULL
        OR i.display_name ILIKE v_pattern ESCAPE '\'
        OR i.legal_name ILIKE v_pattern ESCAPE '\'
        OR i.document_number ILIKE v_pattern ESCAPE '\'
        OR i.email ILIKE v_pattern ESCAPE '\'
      )
      AND (
        v_platform IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.influencer_platform_accounts a
          WHERE a.influencer_id = i.id
            AND a.platform = v_platform
        )
      );
    RETURN COALESCE(v_total, 0);
  END IF;

  SELECT COUNT(*)::bigint
  INTO v_total
  FROM public.influencers i
  WHERE public.can_access_influencer(i.id)
    AND (NOT p_crm_only OR i.has_commercial_profile = true)
    AND (v_status IS NULL OR i.status::text = v_status)
    AND (
      v_pattern IS NULL
      OR i.display_name ILIKE v_pattern ESCAPE '\'
      OR i.legal_name ILIKE v_pattern ESCAPE '\'
      OR i.document_number ILIKE v_pattern ESCAPE '\'
      OR i.email ILIKE v_pattern ESCAPE '\'
    )
    AND (
      v_platform IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.influencer_platform_accounts a
        WHERE a.influencer_id = i.id
          AND a.platform = v_platform
      )
    );

  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_list_total_count(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_list_total_count(text, text, text, boolean) TO authenticated;

-- Do not keep a 3-arg overload: PostgREST cannot disambiguate it from the
-- 4-arg signature when callers omit optional named args. See
-- 20260727130000_drop_vendor_list_total_count_3arg_overload.sql.

-- 3) Multi bank accounts
CREATE TABLE IF NOT EXISTS public.influencer_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  bank_name text,
  account_holder text,
  iban text,
  account_number text,
  swift text,
  country_code char(2),
  currency char(3),
  is_default boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS influencer_bank_accounts_influencer_idx
  ON public.influencer_bank_accounts (influencer_id);

CREATE UNIQUE INDEX IF NOT EXISTS influencer_bank_accounts_one_default_uidx
  ON public.influencer_bank_accounts (influencer_id)
  WHERE is_default = true;

DROP TRIGGER IF EXISTS set_influencer_bank_accounts_updated_at ON public.influencer_bank_accounts;
CREATE TRIGGER set_influencer_bank_accounts_updated_at
  BEFORE UPDATE ON public.influencer_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.influencer_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS influencer_bank_accounts_select ON public.influencer_bank_accounts;
CREATE POLICY influencer_bank_accounts_select
  ON public.influencer_bank_accounts FOR SELECT TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(influencer_id)
  );

DROP POLICY IF EXISTS influencer_bank_accounts_write ON public.influencer_bank_accounts;
CREATE POLICY influencer_bank_accounts_write
  ON public.influencer_bank_accounts FOR ALL TO authenticated
  USING (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
    AND public.can_access_influencer(influencer_id)
  )
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
    AND public.can_access_influencer(influencer_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_bank_accounts TO service_role;

-- Seed one bank row from legacy payment_details when empty
INSERT INTO public.influencer_bank_accounts (
  influencer_id, bank_name, account_holder, iban, account_number, swift,
  country_code, currency, is_default, is_verified
)
SELECT
  i.id,
  NULLIF(trim(COALESCE(i.payment_details->>'bank_name', i.payment_details->>'bankName', '')), ''),
  NULLIF(trim(COALESCE(i.payment_details->>'account_holder', i.payment_details->>'accountHolder', i.payment_details->>'beneficiary_name', '')), ''),
  NULLIF(trim(COALESCE(i.payment_details->>'iban', i.payment_details->>'IBAN', '')), ''),
  NULLIF(trim(COALESCE(i.payment_details->>'account_number', i.payment_details->>'accountNumber', '')), ''),
  NULLIF(trim(COALESCE(i.payment_details->>'swift', i.payment_details->>'SWIFT', i.payment_details->>'bic', '')), ''),
  NULLIF(upper(trim(COALESCE(i.payment_details->>'country_code', i.country_code, ''))), '')::char(2),
  NULLIF(upper(trim(COALESCE(i.payment_details->>'currency', i.rate_card->>'currency', ''))), '')::char(3),
  true,
  false
FROM public.influencers i
WHERE NOT EXISTS (
  SELECT 1 FROM public.influencer_bank_accounts b WHERE b.influencer_id = i.id
)
AND (
  COALESCE(i.payment_details->>'iban', i.payment_details->>'IBAN', '') <> ''
  OR COALESCE(i.payment_details->>'account_number', i.payment_details->>'accountNumber', '') <> ''
  OR COALESCE(i.payment_details->>'bank_name', i.payment_details->>'bankName', '') <> ''
);

-- 4) Client / Brand commercial requirements
CREATE TABLE IF NOT EXISTS public.client_commercial_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  required_document_types text[] NOT NULL DEFAULT '{}',
  payment_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage_rights text,
  approval_workflow text,
  legal_clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  mandatory_deliverables text[] NOT NULL DEFAULT '{}',
  exclusivity_notes text,
  confidentiality_notes text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (client_id)
);

CREATE TABLE IF NOT EXISTS public.brand_commercial_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  extra_document_types text[] NOT NULL DEFAULT '{}',
  extra_legal_clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_deliverables text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (brand_id)
);

ALTER TABLE public.client_commercial_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_commercial_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_commercial_requirements_all ON public.client_commercial_requirements;
CREATE POLICY client_commercial_requirements_all
  ON public.client_commercial_requirements FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS brand_commercial_requirements_all ON public.brand_commercial_requirements;
CREATE POLICY brand_commercial_requirements_all
  ON public.brand_commercial_requirements FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_commercial_requirements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_commercial_requirements TO authenticated, service_role;

-- 5) Creator+Client+Brand agreement defaults (smart reuse)
CREATE TABLE IF NOT EXISTS public.creator_agreement_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands (id) ON DELETE CASCADE,
  terms_text text NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_agreement_templates_combo_uidx
  ON public.creator_agreement_templates (
    influencer_id,
    client_id,
    (COALESCE(brand_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

ALTER TABLE public.creator_agreement_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creator_agreement_templates_all ON public.creator_agreement_templates;
CREATE POLICY creator_agreement_templates_all
  ON public.creator_agreement_templates FOR ALL TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_agreement_templates TO authenticated, service_role;

-- 6) Backfill commercial CRM for genuine commercial activity
INSERT INTO public.creator_crm_profiles (
  influencer_id,
  crm_status,
  activated_reason,
  onboarding_source,
  activated_by
)
SELECT DISTINCT
  i.id,
  'incomplete'::public.creator_crm_status,
  'backfill'::public.creator_crm_activation_reason,
  'commercial_activity_backfill',
  NULL::uuid
FROM public.influencers i
WHERE i.has_commercial_profile = false
  AND (
    EXISTS (SELECT 1 FROM public.campaign_influencers ci WHERE ci.influencer_id = i.id)
    OR EXISTS (SELECT 1 FROM public.vendor_ios vio WHERE vio.influencer_id = i.id)
    OR EXISTS (
      SELECT 1 FROM public.quotation_items qi
      WHERE qi.influencer_id = i.id
    )
  )
ON CONFLICT (influencer_id) DO NOTHING;

INSERT INTO public.creator_crm_activation_events (
  influencer_id,
  reason,
  source_entity_type,
  metadata
)
SELECT
  p.influencer_id,
  'backfill'::public.creator_crm_activation_reason,
  'backfill',
  jsonb_build_object('source', 'commercial_crm_completion_migration')
FROM public.creator_crm_profiles p
WHERE p.activated_reason = 'backfill'
  AND NOT EXISTS (
    SELECT 1
    FROM public.creator_crm_activation_events e
    WHERE e.influencer_id = p.influencer_id
      AND e.reason = 'backfill'
  );
