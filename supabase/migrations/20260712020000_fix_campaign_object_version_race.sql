-- Fix concurrent version assignment race on campaign_object_versions insert.
-- Root cause: MAX(version)+1 in BEFORE INSERT trigger is not serialized under
-- concurrent saves (task autosave + workflow_complete). Both transactions read
-- the same MAX and attempt the same version number.
--
-- Fix: atomically increment campaign_objects.current_version under row lock.

CREATE OR REPLACE FUNCTION public.campaign_object_versions_assign_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
BEGIN
  UPDATE public.campaign_objects
  SET current_version = current_version + 1
  WHERE id = NEW.campaign_object_id
  RETURNING current_version INTO next_version;

  IF next_version IS NULL THEN
    RAISE EXCEPTION 'campaign_object % not found for version assignment', NEW.campaign_object_id;
  END IF;

  NEW.version := next_version;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.campaign_object_versions_assign_version() IS
  'Reserves monotonic version via locked increment on campaign_objects.current_version.';
