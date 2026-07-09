-- Fix ai_messages INSERT failures after Sprint 6.2 RLS patch (Sprint 6.3)
--
-- Root causes addressed:
-- 1) appendMessage() uses INSERT ... RETURNING (.select().single()) which also
--    evaluates ai_messages_select (can_read). Users with ai.write but without
--    ai.read, or admins who pass requirePermission() bypass but lack DB grants,
--    could pass INSERT WITH CHECK (can_write + user_owns) yet fail RETURNING.
-- 2) can_write_ai_conversations() omitted is_admin(), unlike requirePermission()
--    and other module helpers (e.g. can_write_invoice_line_items).
-- 3) touch_ai_conversation_on_message() ran as INVOKER and re-evaluated
--    ai_conversations UPDATE RLS after every message insert.

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

CREATE OR REPLACE FUNCTION public.touch_ai_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET updated_at = timezone('utc', now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
