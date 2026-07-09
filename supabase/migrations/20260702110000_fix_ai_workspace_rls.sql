-- Fix AI workspace RLS: align with ai.read / ai.write role grants (Sprint 6.2)
-- Root cause: can_*_ai_conversations() required is_internal_user(), which excludes
-- director, manager, and data_entry even though they receive ai.read / ai.write.

-- PostgREST table grants (new tables do not inherit authenticated access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_ai_conversations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
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
    AND public.has_permission('ai.write');
$$;

-- Ownership check bypasses conversation SELECT RLS (used by message policies)
CREATE OR REPLACE FUNCTION public.user_owns_ai_conversation(p_conversation_id uuid)
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

DROP POLICY IF EXISTS ai_messages_select ON public.ai_messages;
CREATE POLICY ai_messages_select ON public.ai_messages
  FOR SELECT
  USING (
    public.can_read_ai_conversations()
    AND public.user_owns_ai_conversation(conversation_id)
  );

DROP POLICY IF EXISTS ai_messages_insert ON public.ai_messages;
CREATE POLICY ai_messages_insert ON public.ai_messages
  FOR INSERT
  WITH CHECK (
    public.can_write_ai_conversations()
    AND public.user_owns_ai_conversation(conversation_id)
  );

DROP POLICY IF EXISTS ai_messages_update ON public.ai_messages;
CREATE POLICY ai_messages_update ON public.ai_messages
  FOR UPDATE
  USING (
    public.can_write_ai_conversations()
    AND public.user_owns_ai_conversation(conversation_id)
  );

DROP POLICY IF EXISTS ai_messages_delete ON public.ai_messages;
CREATE POLICY ai_messages_delete ON public.ai_messages
  FOR DELETE
  USING (
    public.can_write_ai_conversations()
    AND public.user_owns_ai_conversation(conversation_id)
  );
