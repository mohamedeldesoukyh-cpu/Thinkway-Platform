-- =============================================================================
-- Thinkway Intelligence — AI workspace conversations
-- Persistent conversations + messages for /ai workspace (Sprint 4)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('ai.read', 'ai', 'read', 'View AI workspace and conversations'),
  ('ai.write', 'ai', 'write', 'Create and manage AI conversations')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.slug IN ('ai.read', 'ai.write')
  AND r.slug IN (
    'super_admin',
    'admin',
    'director',
    'manager',
    'account_manager',
    'operations',
    'finance',
    'data_entry'
  )
ON CONFLICT DO NOTHING;

-- Viewer gets read-only
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.slug = 'ai.read'
WHERE r.slug = 'viewer'
ON CONFLICT DO NOTHING;

-- Extend approval entity type for AI action audit trail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'approval_entity_type'
      AND e.enumlabel = 'ai_action'
  ) THEN
    ALTER TYPE public.approval_entity_type ADD VALUE 'ai_action';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'New conversation',
  workspace_type text NOT NULL DEFAULT 'general'
    CHECK (workspace_type IN (
      'general', 'campaign', 'client', 'group', 'brand',
      'vendor', 'discovery', 'shortlist', 'report'
    )),
  workspace_id uuid,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS ai_conversations_created_by_idx
  ON public.ai_conversations (created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_conversations_status_idx
  ON public.ai_conversations (created_by, status, is_pinned DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL
    REFERENCES public.ai_conversations (id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_idx
  ON public.ai_messages (conversation_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_ai_conversations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ai_conversations_updated_at();

-- Bump conversation updated_at when messages are appended
CREATE OR REPLACE FUNCTION public.touch_ai_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET updated_at = timezone('utc', now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_messages_touch_conversation ON public.ai_messages;
CREATE TRIGGER ai_messages_touch_conversation
  AFTER INSERT ON public.ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_ai_conversation_on_message();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_ai_conversations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_internal_user()
    AND public.has_permission('ai.read');
$$;

CREATE OR REPLACE FUNCTION public.can_write_ai_conversations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_internal_user()
    AND public.has_permission('ai.write');
$$;

DROP POLICY IF EXISTS ai_conversations_select ON public.ai_conversations;
CREATE POLICY ai_conversations_select ON public.ai_conversations
  FOR SELECT
  USING (
    public.can_read_ai_conversations()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS ai_conversations_insert ON public.ai_conversations;
CREATE POLICY ai_conversations_insert ON public.ai_conversations
  FOR INSERT
  WITH CHECK (
    public.can_write_ai_conversations()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS ai_conversations_update ON public.ai_conversations;
CREATE POLICY ai_conversations_update ON public.ai_conversations
  FOR UPDATE
  USING (
    public.can_write_ai_conversations()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.can_write_ai_conversations()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS ai_conversations_delete ON public.ai_conversations;
CREATE POLICY ai_conversations_delete ON public.ai_conversations
  FOR DELETE
  USING (
    public.can_write_ai_conversations()
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS ai_messages_select ON public.ai_messages;
CREATE POLICY ai_messages_select ON public.ai_messages
  FOR SELECT
  USING (
    public.can_read_ai_conversations()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_insert ON public.ai_messages;
CREATE POLICY ai_messages_insert ON public.ai_messages
  FOR INSERT
  WITH CHECK (
    public.can_write_ai_conversations()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_update ON public.ai_messages;
CREATE POLICY ai_messages_update ON public.ai_messages
  FOR UPDATE
  USING (
    public.can_write_ai_conversations()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_delete ON public.ai_messages;
CREATE POLICY ai_messages_delete ON public.ai_messages
  FOR DELETE
  USING (
    public.can_write_ai_conversations()
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.created_by = auth.uid()
    )
  );
