-- =============================================================================
-- Thinkway Discovery Shortlist Architecture V2
-- -----------------------------------------------------------------------------
-- Extends (does NOT duplicate) discovery_shortlists with:
--   * Permanent SL-YYYY-NNNN serial numbers (mirrors campaign TW-YYYY-NNNN)
--   * Workflow statuses + valid-transition enforcement
--   * Visibility (private / team / client_shared — client portal schema-ready)
--   * Client / brand linkage, approval + cancellation + soft-delete columns
--   * creator_movements audit trail
--   * campaign_influencers shortlist-assignment lifecycle (suggested..removed)
--   * Hard-delete prohibition (soft delete via is_archived only)
--   * Minimal notification fan-out table
-- Additive + idempotent. Safe to run via `npx supabase db push --include-all`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'discovery_shortlist_status'
  ) THEN
    CREATE TYPE public.discovery_shortlist_status AS ENUM (
      'draft',
      'under_review',
      'approved',
      'cancelled',
      'archived'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'discovery_shortlist_visibility'
  ) THEN
    CREATE TYPE public.discovery_shortlist_visibility AS ENUM (
      'private',
      'team',
      'client_shared'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'creator_movement_action'
  ) THEN
    CREATE TYPE public.creator_movement_action AS ENUM (
      'discovery_to_shortlist',
      'shortlist_to_campaign',
      'campaign_to_shortlist',
      'campaign_to_removed',
      'creator_added',
      'creator_removed',
      'shortlist_submitted',
      'shortlist_approved',
      'shortlist_rejected',
      'shortlist_cancelled',
      'shortlist_reopened',
      'shortlist_archived'
    );
  END IF;
END $$;

-- If the enum already exists (V2 partially applied previously), add any missing
-- lifecycle values. ALTER TYPE ... ADD VALUE IF NOT EXISTS is transaction-safe in
-- PG12+ as long as the value is not used as data in this same migration.
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'creator_added', 'creator_removed', 'shortlist_submitted',
    'shortlist_approved', 'shortlist_rejected', 'shortlist_cancelled',
    'shortlist_reopened', 'shortlist_archived'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'creator_movement_action'
        AND e.enumlabel = v
    ) THEN
      EXECUTE format('ALTER TYPE public.creator_movement_action ADD VALUE %L', v);
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'campaign_shortlist_assignment_status'
  ) THEN
    -- Discovery → Campaign assignment lifecycle (spec §6). Kept SEPARATE from the
    -- legacy public.campaign_influencer_status enum so existing vendor flows are
    -- untouched; this column is only populated for shortlist-originated moves.
    CREATE TYPE public.campaign_shortlist_assignment_status AS ENUM (
      'suggested',
      'invited',
      'approved',
      'contracted',
      'published',
      'rejected',
      'removed'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Extend discovery_shortlists
-- -----------------------------------------------------------------------------
ALTER TABLE public.discovery_shortlists
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS status public.discovery_shortlist_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS visibility public.discovery_shortlist_visibility NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  -- Client portal readiness (spec §12) — schema only, no portal UI yet.
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_shared_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

-- Owner deletion must NOT cascade-delete shortlists nor block deleting a departed
-- employee. Switch owner_id FK CASCADE → SET NULL and make the column nullable so
-- history is retained when an owner profile is removed (review item 1).
ALTER TABLE public.discovery_shortlists ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.discovery_shortlists
  DROP CONSTRAINT IF EXISTS discovery_shortlists_owner_id_fkey;
ALTER TABLE public.discovery_shortlists
  ADD CONSTRAINT discovery_shortlists_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

-- Back-compat: created_by defaults to original owner
UPDATE public.discovery_shortlists
SET created_by = owner_id
WHERE created_by IS NULL;

-- Migrate legacy metadata.visibility ('private' | 'shared') → enum ('private' | 'team')
UPDATE public.discovery_shortlists
SET visibility = 'team'
WHERE visibility = 'private'
  AND lower(coalesce(metadata->>'visibility', '')) = 'shared';

-- Unique serial (permanent, never reused)
CREATE UNIQUE INDEX IF NOT EXISTS discovery_shortlists_serial_number_key
  ON public.discovery_shortlists (serial_number)
  WHERE serial_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS discovery_shortlists_status_idx
  ON public.discovery_shortlists (status);
CREATE INDEX IF NOT EXISTS discovery_shortlists_visibility_idx
  ON public.discovery_shortlists (visibility);
CREATE INDEX IF NOT EXISTS discovery_shortlists_client_idx
  ON public.discovery_shortlists (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_shortlists_brand_idx
  ON public.discovery_shortlists (brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_shortlists_archived_idx
  ON public.discovery_shortlists (is_archived);

-- -----------------------------------------------------------------------------
-- 3. Serial generation — SL-YYYY-NNNN (mirrors TW campaign numbering, distinct prefix)
--    Serials are generated ENTIRELY in PostgreSQL; the app never computes them.
-- -----------------------------------------------------------------------------
-- Named, reusable serial generator. Thin wrapper over next_document_number so the
-- shortlist serial space (SL-) stays isolated from campaign serials (TW-).
CREATE OR REPLACE FUNCTION public.generate_shortlist_serial(
  p_at timestamptz DEFAULT timezone('utc', now())
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.next_document_number(
    'SL-' || to_char(timezone('utc', p_at), 'YYYY'),
    4
  );
END;
$$;

COMMENT ON FUNCTION public.generate_shortlist_serial(timestamptz) IS
  'Generates the next SL-YYYY-NNNN shortlist serial. Single source of truth — never generate serials client-side.';

CREATE OR REPLACE FUNCTION public.assign_discovery_shortlist_serial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.serial_number IS NULL OR btrim(NEW.serial_number) = '' THEN
    NEW.serial_number := public.generate_shortlist_serial(timezone('utc', now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_discovery_shortlists_serial ON public.discovery_shortlists;
CREATE TRIGGER assign_discovery_shortlists_serial
  BEFORE INSERT ON public.discovery_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.assign_discovery_shortlist_serial();

DROP TRIGGER IF EXISTS set_discovery_shortlists_updated_at ON public.discovery_shortlists;
CREATE TRIGGER set_discovery_shortlists_updated_at
  BEFORE UPDATE ON public.discovery_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill serials for pre-existing rows, oldest first, so numbering is chronological.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM public.discovery_shortlists
    WHERE serial_number IS NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE public.discovery_shortlists
    SET serial_number = public.generate_shortlist_serial(coalesce(r.created_at, now()))
    WHERE id = r.id;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Status transition enforcement (spec §3, §13)
--    draft         → under_review | cancelled | archived
--    under_review  → approved | draft | cancelled | archived
--    approved      → cancelled | archived
--    cancelled     → draft (reopen)
--    archived      → (terminal)
--    same-status updates always allowed (field edits)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_discovery_shortlist_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'        AND NEW.status IN ('under_review', 'cancelled', 'archived')) OR
    (OLD.status = 'under_review' AND NEW.status IN ('approved', 'draft', 'cancelled', 'archived')) OR
    (OLD.status = 'approved'     AND NEW.status IN ('cancelled', 'archived')) OR
    (OLD.status = 'cancelled'    AND NEW.status IN ('draft'))
  ) THEN
    RAISE EXCEPTION 'Invalid shortlist status transition: % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_discovery_shortlist_transition_trg ON public.discovery_shortlists;
CREATE TRIGGER enforce_discovery_shortlist_transition_trg
  BEFORE UPDATE OF status ON public.discovery_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.enforce_discovery_shortlist_transition();

-- -----------------------------------------------------------------------------
-- 5. Hard-delete prohibition (spec §14) — soft delete via is_archived only.
--    Service role (workers / admin scripts) bypasses for data ops.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_discovery_shortlist_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Shortlists cannot be hard-deleted. Archive instead (is_archived = true).'
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS prevent_discovery_shortlist_hard_delete_trg ON public.discovery_shortlists;
CREATE TRIGGER prevent_discovery_shortlist_hard_delete_trg
  BEFORE DELETE ON public.discovery_shortlists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_discovery_shortlist_hard_delete();

-- -----------------------------------------------------------------------------
-- 6. creator_movements — audit trail (spec §11)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Primary creator reference: influencer id when promoted, else discovered profile id.
  creator_id uuid,
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  discovered_profile_id uuid REFERENCES public.discovered_profiles (id) ON DELETE SET NULL,
  unified_id text,
  source_type text NOT NULL,
  source_id uuid,
  destination_type text NOT NULL,
  destination_id uuid,
  action public.creator_movement_action NOT NULL,
  performed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS creator_movements_creator_idx
  ON public.creator_movements (creator_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS creator_movements_source_idx
  ON public.creator_movements (source_type, source_id);
CREATE INDEX IF NOT EXISTS creator_movements_destination_idx
  ON public.creator_movements (destination_type, destination_id);
CREATE INDEX IF NOT EXISTS creator_movements_action_idx
  ON public.creator_movements (action, performed_at DESC);

-- -----------------------------------------------------------------------------
-- 7. campaign_influencers — shortlist assignment lifecycle (spec §6, §7, §10)
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS shortlist_assignment_status public.campaign_shortlist_assignment_status,
  ADD COLUMN IF NOT EXISTS source_shortlist_id uuid REFERENCES public.discovery_shortlists (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_shortlist_item_id uuid REFERENCES public.discovery_shortlist_items (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_to_shortlist_at timestamptz;

CREATE INDEX IF NOT EXISTS campaign_influencers_shortlist_status_idx
  ON public.campaign_influencers (shortlist_assignment_status)
  WHERE shortlist_assignment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_influencers_source_shortlist_idx
  ON public.campaign_influencers (source_shortlist_id)
  WHERE source_shortlist_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 8. Notifications (spec §15) — minimal fan-out table (no general notifications
--    system exists in the schema; finance/io/portal notifications are scoped).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shortlist_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES public.discovery_shortlists (id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  event text NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS shortlist_notifications_recipient_idx
  ON public.shortlist_notifications (recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS shortlist_notifications_shortlist_idx
  ON public.shortlist_notifications (shortlist_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 9. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.creator_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlist_notifications ENABLE ROW LEVEL SECURITY;

-- Refine shortlist SELECT to respect visibility (spec §4, §16). Owners always see
-- their lists; team/client_shared lists are visible to discovery readers; admins all.
DROP POLICY IF EXISTS discovery_shortlists_select ON public.discovery_shortlists;
CREATE POLICY discovery_shortlists_select ON public.discovery_shortlists
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_permission('discovery.admin')
    OR (
      public.has_permission('discovery.read')
      AND visibility IN ('team', 'client_shared')
    )
  );

-- Writes: owner (Discovery User) OR discovery.admin (Team Leader / Admin approver).
DROP POLICY IF EXISTS discovery_shortlists_owner ON public.discovery_shortlists;
CREATE POLICY discovery_shortlists_owner ON public.discovery_shortlists
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_permission('discovery.admin')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.has_permission('discovery.admin')
  );

-- Shortlist items follow parent visibility for reads; writes by owner/admin.
DROP POLICY IF EXISTS discovery_shortlist_items_access ON public.discovery_shortlist_items;
CREATE POLICY discovery_shortlist_items_access ON public.discovery_shortlist_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.discovery_shortlists s
      WHERE s.id = shortlist_id
        AND (s.owner_id = auth.uid() OR public.has_permission('discovery.admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.discovery_shortlists s
      WHERE s.id = shortlist_id
        AND (s.owner_id = auth.uid() OR public.has_permission('discovery.admin'))
    )
  );

DROP POLICY IF EXISTS discovery_shortlist_items_select ON public.discovery_shortlist_items;
CREATE POLICY discovery_shortlist_items_select ON public.discovery_shortlist_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.discovery_shortlists s
      WHERE s.id = shortlist_id
        AND (
          s.owner_id = auth.uid()
          OR public.has_permission('discovery.admin')
          OR (public.has_permission('discovery.read') AND s.visibility IN ('team', 'client_shared'))
        )
    )
  );

DROP POLICY IF EXISTS creator_movements_select ON public.creator_movements;
CREATE POLICY creator_movements_select ON public.creator_movements
  FOR SELECT TO authenticated
  USING (public.has_permission('discovery.read') OR public.has_permission('discovery.admin'));

DROP POLICY IF EXISTS creator_movements_write ON public.creator_movements;
CREATE POLICY creator_movements_write ON public.creator_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('discovery.write') OR public.has_permission('discovery.admin'));

DROP POLICY IF EXISTS shortlist_notifications_select ON public.shortlist_notifications;
CREATE POLICY shortlist_notifications_select ON public.shortlist_notifications
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.has_permission('discovery.admin')
  );

DROP POLICY IF EXISTS shortlist_notifications_write ON public.shortlist_notifications;
CREATE POLICY shortlist_notifications_write ON public.shortlist_notifications
  FOR ALL TO authenticated
  USING (
    recipient_id = auth.uid()
    OR public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

-- -----------------------------------------------------------------------------
-- 10. Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_movements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shortlist_notifications TO authenticated, service_role;

COMMENT ON COLUMN public.discovery_shortlists.serial_number IS
  'Permanent SL-YYYY-NNNN serial. Sequential, resets yearly, never reused, retained on cancel.';
COMMENT ON COLUMN public.campaign_influencers.shortlist_assignment_status IS
  'Discovery→campaign assignment lifecycle. NULL for legacy/non-shortlist vendor rows.';
COMMENT ON TABLE public.creator_movements IS
  'Immutable audit trail of creator movements across discovery, shortlists, and campaigns.';
