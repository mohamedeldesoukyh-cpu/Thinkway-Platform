BEGIN;
CREATE TABLE public.tw_accounting_favorites (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 views text[] NOT NULL CHECK(cardinality(views)<=12),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tw_accounting_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_accounting_favorites ON public.tw_accounting_favorites TO authenticated
 USING(profile_id=auth.uid() AND coalesce((public.tw_module_access()->>'accounting')::boolean,false))
 WITH CHECK(profile_id=auth.uid() AND coalesce((public.tw_module_access()->>'accounting')::boolean,false));
REVOKE ALL ON public.tw_accounting_favorites FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.tw_accounting_favorites TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
