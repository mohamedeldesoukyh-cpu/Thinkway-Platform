BEGIN;
-- Portal membership checks in the module helper use SECURITY DEFINER, so these
-- directory tables can enforce the same module boundary as other Media tables.
CREATE POLICY tw_media_module_boundary ON public.client_users AS RESTRICTIVE FOR ALL TO authenticated
 USING ((SELECT public.tw_media_data_access())) WITH CHECK ((SELECT public.tw_media_data_access()));
CREATE POLICY tw_media_module_boundary ON public.influencers AS RESTRICTIVE FOR ALL TO authenticated
 USING ((SELECT public.tw_media_data_access())) WITH CHECK ((SELECT public.tw_media_data_access()));
COMMIT;
