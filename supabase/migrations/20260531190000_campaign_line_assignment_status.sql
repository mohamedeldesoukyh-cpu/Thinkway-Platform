-- Campaign line operational assignment lifecycle
-- Single source of truth: campaign_lines.assignment_status

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'campaign_line_assignment_status'
  ) THEN
    CREATE TYPE public.campaign_line_assignment_status AS ENUM (
      'draft',
      'assigned',
      'awaiting_content',
      'submitted',
      'approved',
      'scheduled',
      'posted',
      'verified',
      'invoiced',
      'paid',
      'closed'
    );
  END IF;
END $$;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS assignment_status public.campaign_line_assignment_status NOT NULL DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS campaign_lines_assignment_status_idx
  ON public.campaign_lines (assignment_status);

-- Lines with creator metadata but no status yet → assigned
UPDATE public.campaign_lines
SET assignment_status = 'assigned'
WHERE assignment_status = 'draft'
  AND metadata ? 'influencer_assignment'
  AND (metadata->'influencer_assignment'->>'influencer_id') IS NOT NULL;

-- Billing-synced lines
UPDATE public.campaign_lines
SET assignment_status = 'invoiced'
WHERE assignment_status NOT IN ('invoiced', 'paid', 'closed')
  AND billing_status IN ('invoiced', 'partially_paid');

UPDATE public.campaign_lines
SET assignment_status = 'paid'
WHERE assignment_status NOT IN ('paid', 'closed')
  AND billing_status = 'paid';

UPDATE public.campaign_lines
SET assignment_status = 'closed'
WHERE billing_status = 'closed';
