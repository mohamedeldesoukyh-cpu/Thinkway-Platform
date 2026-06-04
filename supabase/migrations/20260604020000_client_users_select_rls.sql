-- Allow client access workspace to read portal assignments (admin + client_access + users.read)

DROP POLICY IF EXISTS client_users_select ON public.client_users;
CREATE POLICY client_users_select
  ON public.client_users
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_admin()
    OR public.has_permission('client_access.read')
    OR public.has_permission('client_access.write')
    OR public.can_access_client(client_id)
    OR public.has_permission('users.read')
  );
