-- =============================================================================
-- Release 2.2.A — Client IO Assignment Composer foundation (Development-first)
-- - under_client_review status
-- - client_io_assignments junction
-- - assignment_snapshot on client_ios (issued document freeze)
-- - client_io_billing_milestones (2.3-ready schema; UI in 2.2.C)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Status: under_client_review
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'client_io_status'
      AND e.enumlabel = 'under_client_review'
  ) THEN
    ALTER TYPE public.client_io_status ADD VALUE IF NOT EXISTS 'under_client_review';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Assignment snapshot (frozen commercial + schedule state at generate)
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_ios
  ADD COLUMN IF NOT EXISTS assignment_snapshot jsonb;

COMMENT ON COLUMN public.client_ios.assignment_snapshot IS
  'Release 2.2: frozen Assignment commercial + deliverable state at document issue. Historical CIO docs must not silently follow later schedule edits.';

-- -----------------------------------------------------------------------------
-- Junction: Client IO ↔ selected Assignments (campaign_lines)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_io_assignments (
  client_io_id uuid NOT NULL
    REFERENCES public.client_ios (id) ON DELETE CASCADE,
  campaign_line_id uuid NOT NULL
    REFERENCES public.campaign_lines (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (client_io_id, campaign_line_id)
);

CREATE INDEX IF NOT EXISTS client_io_assignments_line_idx
  ON public.client_io_assignments (campaign_line_id);

COMMENT ON TABLE public.client_io_assignments IS
  'Release 2.2: Assignments included in a Client IO composition (many-to-many).';

ALTER TABLE public.client_io_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_io_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_io_assignments_select ON public.client_io_assignments;
CREATE POLICY client_io_assignments_select ON public.client_io_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_ios cio
      WHERE cio.id = client_io_id
        AND (
          public.has_permission('client_ios.read')
          OR public.has_permission('campaigns.read')
        )
        AND public.can_access_campaign_header(cio.campaign_header_id)
    )
  );

DROP POLICY IF EXISTS client_io_assignments_write ON public.client_io_assignments;
CREATE POLICY client_io_assignments_write ON public.client_io_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_ios cio
      WHERE cio.id = client_io_id
        AND (
          public.has_permission('client_ios.write')
          OR public.has_permission('campaigns.write')
        )
        AND public.can_access_campaign_header(cio.campaign_header_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_ios cio
      WHERE cio.id = client_io_id
        AND (
          public.has_permission('client_ios.write')
          OR public.has_permission('campaigns.write')
        )
        AND public.can_access_campaign_header(cio.campaign_header_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_io_assignments TO authenticated;

-- -----------------------------------------------------------------------------
-- Billing milestones (schedule ownership in 2.2; invoice execution in 2.3)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_io_billing_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_io_id uuid NOT NULL
    REFERENCES public.client_ios (id) ON DELETE CASCADE,
  label text NOT NULL,
  milestone_kind text NOT NULL DEFAULT 'custom',
  percent numeric(7, 4),
  amount numeric(14, 2),
  currency_code char(3),
  due_date date,
  sort_order integer NOT NULL DEFAULT 0,
  -- 2.3 consumption fields (unused in 2.2 execution paths)
  billing_status text NOT NULL DEFAULT 'scheduled',
  invoice_id uuid NULL
    REFERENCES public.invoices (id) ON DELETE SET NULL,
  eligible_at timestamptz,
  invoiced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT client_io_billing_milestones_percent_range
    CHECK (percent IS NULL OR (percent >= 0 AND percent <= 100)),
  CONSTRAINT client_io_billing_milestones_amount_non_negative
    CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT client_io_billing_milestones_kind_check
    CHECK (
      milestone_kind IN (
        'upfront',
        'kickoff',
        'completion',
        'monthly',
        'custom'
      )
    ),
  CONSTRAINT client_io_billing_milestones_status_check
    CHECK (
      billing_status IN (
        'scheduled',
        'eligible',
        'invoiced',
        'paid',
        'cancelled'
      )
    )
);

CREATE INDEX IF NOT EXISTS client_io_billing_milestones_cio_idx
  ON public.client_io_billing_milestones (client_io_id, sort_order);

CREATE INDEX IF NOT EXISTS client_io_billing_milestones_invoice_idx
  ON public.client_io_billing_milestones (invoice_id)
  WHERE invoice_id IS NOT NULL;

COMMENT ON TABLE public.client_io_billing_milestones IS
  'Release 2.2: Client IO billing milestone schedule. Invoice eligibility execution is Release 2.3.';

ALTER TABLE public.client_io_billing_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_io_billing_milestones FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_io_billing_milestones_select ON public.client_io_billing_milestones;
CREATE POLICY client_io_billing_milestones_select ON public.client_io_billing_milestones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_ios cio
      WHERE cio.id = client_io_id
        AND (
          public.has_permission('client_ios.read')
          OR public.has_permission('campaigns.read')
        )
        AND public.can_access_campaign_header(cio.campaign_header_id)
    )
  );

DROP POLICY IF EXISTS client_io_billing_milestones_write ON public.client_io_billing_milestones;
CREATE POLICY client_io_billing_milestones_write ON public.client_io_billing_milestones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_ios cio
      WHERE cio.id = client_io_id
        AND (
          public.has_permission('client_ios.write')
          OR public.has_permission('campaigns.write')
        )
        AND public.can_access_campaign_header(cio.campaign_header_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.client_ios cio
      WHERE cio.id = client_io_id
        AND (
          public.has_permission('client_ios.write')
          OR public.has_permission('campaigns.write')
        )
        AND public.can_access_campaign_header(cio.campaign_header_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_io_billing_milestones TO authenticated;
