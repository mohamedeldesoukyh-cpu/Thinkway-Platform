-- Re-apply AI conversation RLS read/write alignment (Sprint 6.3 semantics).
--
-- Symptom in drifted environments: chat streaming works (conversation + message
-- INSERT policies pass) but GET /api/ai/conversations/{id} returns 404 — the
-- ai_conversations SELECT policy evaluates an OLD can_read_ai_conversations()
-- that admins / ai.write-only users fail. 20260702120000 fixed this by making
-- read a superset of write; this migration re-issues those definitions and the
-- dependent policies idempotently so `supabase db push` heals environments where
-- the earlier fix never landed. No-op on healthy databases.

CREATE OR REPLACE FUNCTION public.can_read_ai_conversations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR public.has_permission('ai.read')
      OR public.has_permission('ai.write')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_ai_conversations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR public.has_permission('ai.write')
    );
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

-- PostgREST table grants (idempotent)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated, service_role;

-- Conversation policies (verbatim intent of 20260702100000 with 6.3 functions)
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

-- Message policies (verbatim intent of 20260702110000 with 6.3 functions)
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
