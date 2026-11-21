BEGIN;
CREATE OR REPLACE FUNCTION public.tw_module_access() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce((SELECT CASE
    WHEN NOT p.is_active OR r.slug IN ('client_user','influencer') OR EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id)
      OR EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) THEN '{"media":false,"accounting":false,"manage":false,"admin":false}'::jsonb
    WHEN r.slug IN ('admin','super_admin') THEN '{"media":true,"accounting":true,"manage":true,"admin":true}'::jsonb
    ELSE jsonb_build_object('media',coalesce(m.media,true),
      'accounting',coalesce(m.accounting_role,CASE WHEN r.slug='finance' THEN 'manage' ELSE 'none' END)<>'none',
      'manage',coalesce(m.accounting_role,CASE WHEN r.slug='finance' THEN 'manage' ELSE 'none' END)='manage','admin',false)
    END FROM profiles p JOIN roles r ON r.id=p.role_id LEFT JOIN tw_module_assignments m ON m.profile_id=p.id WHERE p.id=auth.uid()),
    '{"media":false,"accounting":false,"manage":false,"admin":false}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.tw_module_validate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (tw_module_access()->>'admin')::boolean OR NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  IF NEW.profile_id=auth.uid() OR EXISTS(SELECT 1 FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.id=NEW.profile_id AND r.slug IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Administrator access cannot be removed here'; END IF;
  IF EXISTS(SELECT 1 FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.id=NEW.profile_id AND r.slug IN ('client_user','influencer')) OR EXISTS(SELECT 1 FROM client_users WHERE profile_id=NEW.profile_id) OR EXISTS(SELECT 1 FROM influencers WHERE profile_id=NEW.profile_id) THEN RAISE EXCEPTION 'Portal users cannot be assigned internal modules'; END IF;
  NEW.updated_by:=auth.uid(); NEW.updated_at:=now();
  IF TG_OP='UPDATE' THEN
    IF NEW.profile_id<>OLD.profile_id THEN RAISE EXCEPTION 'Assignment user cannot be changed'; END IF;
    NEW.version:=OLD.version+1;
  END IF;
  RETURN NEW;
END; $$;

COMMIT;
