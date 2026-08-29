-- Campaign Script Phase 5.1: one active script per documentation unit.
-- qty=1 → assignment_deliverable_id, post null (d:{id})
-- qty>1 → assignment_post_schedule_id (p:{id})
-- Legacy campaign-level rows stay unattached (both FKs null). Do not fan out.
-- Development first. Do not apply to Production without approval.
-- campaign_script_assignments is unused by this model; table is left in place.

ALTER TABLE public.campaign_scripts
  ADD COLUMN IF NOT EXISTS assignment_deliverable_id uuid
    REFERENCES public.assignment_deliverables (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assignment_post_schedule_id uuid
    REFERENCES public.assignment_post_schedule (id) ON DELETE CASCADE;

ALTER TABLE public.campaign_scripts
  DROP CONSTRAINT IF EXISTS campaign_scripts_campaign_header_id_key;

DROP INDEX IF EXISTS public.campaign_scripts_header_idx;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_scripts_unit_shape_check'
  ) THEN
    ALTER TABLE public.campaign_scripts
      ADD CONSTRAINT campaign_scripts_unit_shape_check
      CHECK (
        (
          assignment_deliverable_id IS NULL
          AND assignment_post_schedule_id IS NULL
        )
        OR (
          assignment_deliverable_id IS NOT NULL
          AND assignment_post_schedule_id IS NULL
        )
        OR (
          assignment_deliverable_id IS NOT NULL
          AND assignment_post_schedule_id IS NOT NULL
        )
      );
  END IF;
END
$$;

-- One leftover campaign-level script per campaign (unattached / legacy).
CREATE UNIQUE INDEX IF NOT EXISTS campaign_scripts_legacy_unattached_idx
  ON public.campaign_scripts (campaign_header_id)
  WHERE assignment_deliverable_id IS NULL
    AND assignment_post_schedule_id IS NULL;

-- qty=1 documentation unit (d:{deliverableId})
CREATE UNIQUE INDEX IF NOT EXISTS campaign_scripts_qty1_unit_idx
  ON public.campaign_scripts (assignment_deliverable_id)
  WHERE assignment_deliverable_id IS NOT NULL
    AND assignment_post_schedule_id IS NULL;

-- qty>1 documentation unit (p:{postId})
CREATE UNIQUE INDEX IF NOT EXISTS campaign_scripts_qty_n_unit_idx
  ON public.campaign_scripts (assignment_post_schedule_id)
  WHERE assignment_post_schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_scripts_header_list_idx
  ON public.campaign_scripts (campaign_header_id);

CREATE OR REPLACE FUNCTION public.campaign_script_unit_belongs_to_campaign()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  deliverable_quantity integer;
BEGIN
  IF NEW.assignment_deliverable_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.quantity
    INTO deliverable_quantity
  FROM public.assignment_deliverables d
  WHERE d.id = NEW.assignment_deliverable_id
    AND d.campaign_header_id = NEW.campaign_header_id;

  IF deliverable_quantity IS NULL THEN
    RAISE EXCEPTION 'campaign script deliverable does not belong to this campaign';
  END IF;

  IF deliverable_quantity = 1 AND NEW.assignment_post_schedule_id IS NOT NULL THEN
    RAISE EXCEPTION 'A quantity-1 deliverable script attaches to the deliverable, not a post';
  END IF;

  IF deliverable_quantity > 1 AND NEW.assignment_post_schedule_id IS NULL THEN
    RAISE EXCEPTION 'This deliverable has multiple posts. Attach the script to a specific post';
  END IF;

  IF NEW.assignment_post_schedule_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.assignment_post_schedule p
    WHERE p.id = NEW.assignment_post_schedule_id
      AND p.assignment_deliverable_id = NEW.assignment_deliverable_id
  ) THEN
    RAISE EXCEPTION 'campaign script post does not belong to this deliverable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_scripts_unit_belongs_to_campaign ON public.campaign_scripts;
CREATE TRIGGER campaign_scripts_unit_belongs_to_campaign
  BEFORE INSERT OR UPDATE OF campaign_header_id, assignment_deliverable_id, assignment_post_schedule_id
  ON public.campaign_scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.campaign_script_unit_belongs_to_campaign();

COMMENT ON COLUMN public.campaign_scripts.assignment_deliverable_id IS
  'Documentation unit parent. Null = legacy campaign-level script (unattached). Set with post null = qty=1 unit (d:{id}).';
COMMENT ON COLUMN public.campaign_scripts.assignment_post_schedule_id IS
  'qty>1 documentation unit (p:{id}). Null when qty=1 or legacy unattached. Never set without assignment_deliverable_id.';
COMMENT ON TABLE public.campaign_scripts IS
  'Campaign Script pointer. One active script per documentation unit when attached. Legacy rows remain unattached (both unit FKs null). Sparse: no row until a script is saved on a unit. Not a deliverable_assets row.';
