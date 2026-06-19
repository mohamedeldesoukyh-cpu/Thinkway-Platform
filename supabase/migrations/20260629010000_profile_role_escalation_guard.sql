-- Block self-service escalation of role_id, is_active, or status on profiles.
-- RLS policy profiles_update_self_or_admin allows id = auth.uid() without column checks (ESC-01).

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      public.is_admin()
      OR public.has_permission('users.write')
      OR public.has_permission('settings.write')
    ) THEN
      RAISE EXCEPTION 'Insufficient privileges to modify role or account status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

COMMENT ON FUNCTION public.guard_profile_privileged_columns() IS
  'Prevents non-admin users from changing their own role_id, is_active, or status (ESC-01).';
