-- Enterprise assignment commercial planning: normalized deliverable rows + post schedules.

DO $$ BEGIN
  CREATE TYPE public.assignment_pricing_mode AS ENUM ('package', 'per_deliverable');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.assignment_post_status AS ENUM (
    'draft',
    'scheduled',
    'awaiting_approval',
    'approved',
    'posted',
    'verified',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.assignment_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  campaign_line_id uuid NOT NULL REFERENCES public.campaign_lines (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  platform text NOT NULL,
  deliverable_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_cost numeric(14, 2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  revenue_before_vat numeric(14, 2) NOT NULL DEFAULT 0 CHECK (revenue_before_vat >= 0),
  revenue_vat_percent numeric(6, 3) NOT NULL DEFAULT 0,
  revenue_vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  revenue_after_vat numeric(14, 2) NOT NULL DEFAULT 0,
  cost_before_vat numeric(14, 2) NOT NULL DEFAULT 0 CHECK (cost_before_vat >= 0),
  cost_vat_percent numeric(6, 3) NOT NULL DEFAULT 0,
  cost_vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  cost_after_vat numeric(14, 2) NOT NULL DEFAULT 0,
  live_date date,
  schedule_mode text NOT NULL DEFAULT 'single' CHECK (schedule_mode IN ('single', 'expanded')),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS assignment_deliverables_line_idx
  ON public.assignment_deliverables (campaign_line_id, sort_order);

CREATE INDEX IF NOT EXISTS assignment_deliverables_header_idx
  ON public.assignment_deliverables (campaign_header_id);

CREATE TABLE IF NOT EXISTS public.assignment_post_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_deliverable_id uuid NOT NULL REFERENCES public.assignment_deliverables (id) ON DELETE CASCADE,
  campaign_line_id uuid NOT NULL REFERENCES public.campaign_lines (id) ON DELETE CASCADE,
  sequence_number integer NOT NULL DEFAULT 1 CHECK (sequence_number >= 1),
  live_date date,
  status public.assignment_post_status NOT NULL DEFAULT 'draft',
  notes text,
  proof_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT assignment_post_schedule_unique
    UNIQUE (assignment_deliverable_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS assignment_post_schedule_line_idx
  ON public.assignment_post_schedule (campaign_line_id, live_date);

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS pricing_mode public.assignment_pricing_mode NOT NULL DEFAULT 'package';

DROP TRIGGER IF EXISTS set_assignment_deliverables_updated_at ON public.assignment_deliverables;
CREATE TRIGGER set_assignment_deliverables_updated_at
  BEFORE UPDATE ON public.assignment_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_assignment_post_schedule_updated_at ON public.assignment_post_schedule;
CREATE TRIGGER set_assignment_post_schedule_updated_at
  BEFORE UPDATE ON public.assignment_post_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.assignment_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_post_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignment_deliverables_select ON public.assignment_deliverables;
CREATE POLICY assignment_deliverables_select
  ON public.assignment_deliverables FOR SELECT
  USING (public.can_access_campaign_header(campaign_header_id));

DROP POLICY IF EXISTS assignment_deliverables_write ON public.assignment_deliverables;
CREATE POLICY assignment_deliverables_write
  ON public.assignment_deliverables FOR ALL
  USING (public.can_access_campaign_header(campaign_header_id))
  WITH CHECK (public.can_access_campaign_header(campaign_header_id));

DROP POLICY IF EXISTS assignment_post_schedule_select ON public.assignment_post_schedule;
CREATE POLICY assignment_post_schedule_select
  ON public.assignment_post_schedule FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignment_deliverables ad
      WHERE ad.id = assignment_deliverable_id
        AND public.can_access_campaign_header(ad.campaign_header_id)
    )
  );

DROP POLICY IF EXISTS assignment_post_schedule_write ON public.assignment_post_schedule;
CREATE POLICY assignment_post_schedule_write
  ON public.assignment_post_schedule FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignment_deliverables ad
      WHERE ad.id = assignment_deliverable_id
        AND public.can_access_campaign_header(ad.campaign_header_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignment_deliverables ad
      WHERE ad.id = assignment_deliverable_id
        AND public.can_access_campaign_header(ad.campaign_header_id)
    )
  );
