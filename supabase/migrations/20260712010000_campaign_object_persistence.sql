-- =============================================================================
-- Release 1.0 — Phase 0.3 Campaign Object Persistence
-- Durable, versioned CampaignObject storage linked to AI conversations.
-- Apply with: supabase db push (requires explicit operator approval)
-- =============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'campaign_object_lifecycle_status'
  ) THEN
    CREATE TYPE public.campaign_object_lifecycle_status AS ENUM (
      'draft',
      'in_review',
      'approved',
      'archived',
      'published'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campaign_objects (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL
    REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  campaign_header_id uuid
    REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  workflow_id text,
  lifecycle_status public.campaign_object_lifecycle_status NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT campaign_objects_conversation_key UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS campaign_objects_conversation_idx
  ON public.campaign_objects (conversation_id);
CREATE INDEX IF NOT EXISTS campaign_objects_campaign_header_idx
  ON public.campaign_objects (campaign_header_id)
  WHERE campaign_header_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS campaign_objects_lifecycle_idx
  ON public.campaign_objects (lifecycle_status, updated_at DESC);

COMMENT ON TABLE public.campaign_objects IS
  'Head record for durable CampaignObject state. One active object per AI conversation.';
COMMENT ON COLUMN public.campaign_objects.current_version IS
  'Monotonic version counter; incremented on each campaign_object_versions insert.';

CREATE TABLE IF NOT EXISTS public.campaign_object_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_object_id uuid NOT NULL
    REFERENCES public.campaign_objects (id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  workflow_id text,
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT campaign_object_versions_object_version_key
    UNIQUE (campaign_object_id, version)
);

CREATE INDEX IF NOT EXISTS campaign_object_versions_object_idx
  ON public.campaign_object_versions (campaign_object_id, version DESC);

COMMENT ON TABLE public.campaign_object_versions IS
  'Immutable version history. snapshot stores full serialized CampaignObject JSON.';

CREATE OR REPLACE FUNCTION public.campaign_object_versions_assign_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1
  INTO next_version
  FROM public.campaign_object_versions
  WHERE campaign_object_id = NEW.campaign_object_id;

  NEW.version := next_version;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_object_versions_assign_version_trg
  ON public.campaign_object_versions;
CREATE TRIGGER campaign_object_versions_assign_version_trg
  BEFORE INSERT ON public.campaign_object_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.campaign_object_versions_assign_version();

CREATE OR REPLACE FUNCTION public.campaign_objects_bump_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.campaign_objects
  SET
    current_version = NEW.version,
    workflow_id = COALESCE(NEW.workflow_id, workflow_id),
    updated_by = NEW.updated_by,
    updated_at = timezone('utc', now())
  WHERE id = NEW.campaign_object_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_objects_bump_version_trg ON public.campaign_object_versions;
CREATE TRIGGER campaign_objects_bump_version_trg
  AFTER INSERT ON public.campaign_object_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.campaign_objects_bump_version();

CREATE OR REPLACE FUNCTION public.set_campaign_objects_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_objects_updated_at_trg ON public.campaign_objects;
CREATE TRIGGER campaign_objects_updated_at_trg
  BEFORE UPDATE ON public.campaign_objects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_campaign_objects_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — scoped via conversation ownership (ai workspace)
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_object_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_owns_campaign_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_conversations c
    WHERE c.id = p_conversation_id
      AND c.created_by = auth.uid()
  );
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_objects'
      AND policyname = 'campaign_objects_select'
  ) THEN
    CREATE POLICY campaign_objects_select ON public.campaign_objects
      FOR SELECT TO authenticated
      USING (
        public.can_read_ai_conversations()
        AND public.user_owns_campaign_conversation(conversation_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_objects'
      AND policyname = 'campaign_objects_insert'
  ) THEN
    CREATE POLICY campaign_objects_insert ON public.campaign_objects
      FOR INSERT TO authenticated
      WITH CHECK (
        public.can_write_ai_conversations()
        AND public.user_owns_campaign_conversation(conversation_id)
        AND created_by = auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_objects'
      AND policyname = 'campaign_objects_update'
  ) THEN
    CREATE POLICY campaign_objects_update ON public.campaign_objects
      FOR UPDATE TO authenticated
      USING (
        public.can_write_ai_conversations()
        AND public.user_owns_campaign_conversation(conversation_id)
      )
      WITH CHECK (
        public.can_write_ai_conversations()
        AND public.user_owns_campaign_conversation(conversation_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_object_versions'
      AND policyname = 'campaign_object_versions_select'
  ) THEN
    CREATE POLICY campaign_object_versions_select ON public.campaign_object_versions
      FOR SELECT TO authenticated
      USING (
        public.can_read_ai_conversations()
        AND EXISTS (
          SELECT 1
          FROM public.campaign_objects co
          WHERE co.id = campaign_object_id
            AND public.user_owns_campaign_conversation(co.conversation_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaign_object_versions'
      AND policyname = 'campaign_object_versions_insert'
  ) THEN
    CREATE POLICY campaign_object_versions_insert ON public.campaign_object_versions
      FOR INSERT TO authenticated
      WITH CHECK (
        public.can_write_ai_conversations()
        AND created_by = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.campaign_objects co
          WHERE co.id = campaign_object_id
            AND public.user_owns_campaign_conversation(co.conversation_id)
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.campaign_objects TO authenticated, service_role;
GRANT SELECT, INSERT ON public.campaign_object_versions TO authenticated, service_role;
