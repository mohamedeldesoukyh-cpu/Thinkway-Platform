-- =============================================================================
-- Thinkway IO System (Operational scope)
-- Lightweight campaign-focused IO workflow (non-blocking)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'client_io_status'
  ) THEN
    CREATE TYPE public.client_io_status AS ENUM ('draft', 'sent', 'approved');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'vendor_io_status'
  ) THEN
    CREATE TYPE public.vendor_io_status AS ENUM ('draft', 'sent', 'approved', 'rejected');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Client IOs (one per campaign header)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_ios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL UNIQUE
    REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  client_id uuid NOT NULL
    REFERENCES public.clients (id) ON DELETE RESTRICT,
  status public.client_io_status NOT NULL DEFAULT 'draft',
  terms_html text,
  terms_text text,
  billing_terms text,
  attachment_url text,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  approval_ip inet,
  approval_token_hash text,
  approval_token_expires_at timestamptz,
  approval_accessed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS client_ios_client_id_idx ON public.client_ios (client_id);
CREATE INDEX IF NOT EXISTS client_ios_status_idx ON public.client_ios (status);
CREATE INDEX IF NOT EXISTS client_ios_sent_at_idx ON public.client_ios (sent_at DESC);
CREATE INDEX IF NOT EXISTS client_ios_approved_at_idx ON public.client_ios (approved_at DESC);

-- -----------------------------------------------------------------------------
-- Vendor IOs (one per campaign assignment row)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_ios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE
    REFERENCES public.campaign_influencers (id) ON DELETE CASCADE,
  campaign_header_id uuid NOT NULL
    REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL
    REFERENCES public.influencers (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  status public.vendor_io_status NOT NULL DEFAULT 'draft',
  terms_html text,
  terms_text text,
  usage_rights text,
  exclusivity text,
  attachment_url text,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  approval_ip inet,
  rejection_reason text,
  approval_token_hash text,
  approval_token_expires_at timestamptz,
  approval_accessed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vendor_ios_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT vendor_ios_currency_check CHECK (char_length(currency_code) = 3)
);

CREATE INDEX IF NOT EXISTS vendor_ios_campaign_header_id_idx
  ON public.vendor_ios (campaign_header_id);
CREATE INDEX IF NOT EXISTS vendor_ios_influencer_id_idx ON public.vendor_ios (influencer_id);
CREATE INDEX IF NOT EXISTS vendor_ios_status_idx ON public.vendor_ios (status);
CREATE INDEX IF NOT EXISTS vendor_ios_sent_at_idx ON public.vendor_ios (sent_at DESC);
CREATE INDEX IF NOT EXISTS vendor_ios_approved_at_idx ON public.vendor_ios (approved_at DESC);

-- -----------------------------------------------------------------------------
-- IO notifications (lightweight only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.io_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  io_type text NOT NULL CHECK (io_type IN ('client', 'vendor')),
  io_id uuid NOT NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'client_io_sent',
      'client_io_approved',
      'vendor_io_sent',
      'vendor_io_approved',
      'io_pending_approval'
    )
  ),
  recipient_email text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS io_notifications_event_idx
  ON public.io_notifications (event_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_io_approval_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT md5(
    random()::text || clock_timestamp()::text || gen_random_uuid()::text
  );
$$;

CREATE OR REPLACE FUNCTION public.hash_io_approval_token(p_token text)
RETURNS text
LANGUAGE sql
AS $$
  SELECT md5(COALESCE(p_token, ''));
$$;

CREATE OR REPLACE FUNCTION public.ensure_client_io_for_campaign(
  p_campaign_header_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_client_id uuid;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.client_ios
  WHERE campaign_header_id = p_campaign_header_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT client_id INTO v_client_id
  FROM public.campaign_headers
  WHERE id = p_campaign_header_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Campaign header not found for IO creation.';
  END IF;

  INSERT INTO public.client_ios (
    campaign_header_id,
    client_id,
    status,
    terms_text,
    created_by,
    updated_by
  )
  VALUES (
    p_campaign_header_id,
    v_client_id,
    'draft',
    'Operational IO generated from campaign details.',
    p_actor_id,
    p_actor_id
  )
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_vendor_io_from_assignment(
  p_assignment_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row record;
BEGIN
  SELECT
    ci.id,
    ci.campaign_header_id,
    ci.influencer_id,
    ci.agreed_fee,
    ci.currency,
    ci.deliverable_count,
    ci.status AS assignment_status
  INTO v_row
  FROM public.campaign_influencers ci
  WHERE ci.id = p_assignment_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found.';
  END IF;

  INSERT INTO public.vendor_ios (
    assignment_id,
    campaign_header_id,
    influencer_id,
    amount,
    currency_code,
    status,
    terms_text,
    created_by,
    updated_by
  )
  VALUES (
    v_row.id,
    v_row.campaign_header_id,
    v_row.influencer_id,
    COALESCE(v_row.agreed_fee, 0),
    COALESCE(v_row.currency, 'USD'),
    CASE WHEN v_row.assignment_status = 'confirmed' THEN 'draft'::public.vendor_io_status ELSE 'draft'::public.vendor_io_status END,
    'Operational vendor IO generated from assignment terms.',
    p_actor_id,
    p_actor_id
  )
  ON CONFLICT (assignment_id) DO UPDATE
    SET
      campaign_header_id = EXCLUDED.campaign_header_id,
      influencer_id = EXCLUDED.influencer_id,
      amount = EXCLUDED.amount,
      currency_code = EXCLUDED.currency_code,
      updated_by = COALESCE(p_actor_id, public.vendor_ios.updated_by),
      updated_at = timezone('utc', now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_create_vendor_io_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vendor IO must never block campaign execution; only draft helper row.
  IF NEW.status = 'confirmed' THEN
    PERFORM public.upsert_vendor_io_from_assignment(NEW.id, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_create_vendor_io_on_line_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id uuid;
BEGIN
  IF NEW.assignment_status = 'assigned' THEN
    FOR v_assignment_id IN
      SELECT id
      FROM public.campaign_influencers
      WHERE campaign_line_id = NEW.id
    LOOP
      PERFORM public.upsert_vendor_io_from_assignment(v_assignment_id, NEW.created_by);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_client_io(
  p_client_io_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := public.generate_io_approval_token();

  UPDATE public.client_ios
  SET
    status = 'sent',
    sent_at = timezone('utc', now()),
    approval_token_hash = public.hash_io_approval_token(v_token),
    approval_token_expires_at = timezone('utc', now()) + interval '14 days',
    updated_by = p_actor_id,
    updated_at = timezone('utc', now())
  WHERE id = p_client_io_id;

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'client',
    p_client_io_id,
    'client_io_sent',
    jsonb_build_object('by', p_actor_id, 'sent_at', timezone('utc', now()))
  );

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'client',
    p_client_io_id,
    'io_pending_approval',
    jsonb_build_object('by', p_actor_id, 'sent_at', timezone('utc', now()))
  );

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_vendor_io(
  p_vendor_io_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := public.generate_io_approval_token();

  UPDATE public.vendor_ios
  SET
    status = 'sent',
    sent_at = timezone('utc', now()),
    approval_token_hash = public.hash_io_approval_token(v_token),
    approval_token_expires_at = timezone('utc', now()) + interval '14 days',
    updated_by = p_actor_id,
    updated_at = timezone('utc', now())
  WHERE id = p_vendor_io_id;

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'vendor',
    p_vendor_io_id,
    'vendor_io_sent',
    jsonb_build_object('by', p_actor_id, 'sent_at', timezone('utc', now()))
  );

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'vendor',
    p_vendor_io_id,
    'io_pending_approval',
    jsonb_build_object('by', p_actor_id, 'sent_at', timezone('utc', now()))
  );

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_client_io_by_token(
  p_token text,
  p_approved_by_name text,
  p_approval_ip inet DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_io_id uuid;
BEGIN
  v_hash := public.hash_io_approval_token(p_token);

  UPDATE public.client_ios
  SET
    status = 'approved',
    approved_at = timezone('utc', now()),
    approved_by_name = p_approved_by_name,
    approval_ip = p_approval_ip,
    approval_accessed_at = timezone('utc', now()),
    approval_token_hash = NULL,
    approval_token_expires_at = NULL,
    updated_at = timezone('utc', now())
  WHERE approval_token_hash = v_hash
    AND status IN ('draft', 'sent')
    AND (approval_token_expires_at IS NULL OR approval_token_expires_at > timezone('utc', now()))
  RETURNING id INTO v_io_id;

  IF v_io_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired approval link.';
  END IF;

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'client',
    v_io_id,
    'client_io_approved',
    jsonb_build_object('approved_by', p_approved_by_name, 'approved_at', timezone('utc', now()))
  );

  RETURN v_io_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_vendor_io_by_token(
  p_token text,
  p_approved_by_name text,
  p_approval_ip inet DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_io_id uuid;
BEGIN
  v_hash := public.hash_io_approval_token(p_token);

  UPDATE public.vendor_ios
  SET
    status = 'approved',
    approved_at = timezone('utc', now()),
    approved_by_name = p_approved_by_name,
    approval_ip = p_approval_ip,
    approval_accessed_at = timezone('utc', now()),
    approval_token_hash = NULL,
    approval_token_expires_at = NULL,
    updated_at = timezone('utc', now())
  WHERE approval_token_hash = v_hash
    AND status IN ('draft', 'sent', 'rejected')
    AND (approval_token_expires_at IS NULL OR approval_token_expires_at > timezone('utc', now()))
  RETURNING id INTO v_io_id;

  IF v_io_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired approval link.';
  END IF;

  INSERT INTO public.io_notifications (io_type, io_id, event_type, payload)
  VALUES (
    'vendor',
    v_io_id,
    'vendor_io_approved',
    jsonb_build_object('approved_by', p_approved_by_name, 'approved_at', timezone('utc', now()))
  );

  RETURN v_io_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_vendor_io_by_token(
  p_token text,
  p_approved_by_name text,
  p_rejection_reason text DEFAULT NULL,
  p_approval_ip inet DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_io_id uuid;
BEGIN
  v_hash := public.hash_io_approval_token(p_token);

  UPDATE public.vendor_ios
  SET
    status = 'rejected',
    approved_at = timezone('utc', now()),
    approved_by_name = p_approved_by_name,
    approval_ip = p_approval_ip,
    rejection_reason = p_rejection_reason,
    approval_accessed_at = timezone('utc', now()),
    approval_token_hash = NULL,
    approval_token_expires_at = NULL,
    updated_at = timezone('utc', now())
  WHERE approval_token_hash = v_hash
    AND status IN ('draft', 'sent')
    AND (approval_token_expires_at IS NULL OR approval_token_expires_at > timezone('utc', now()))
  RETURNING id INTO v_io_id;

  IF v_io_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired approval link.';
  END IF;

  RETURN v_io_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_client_io_approval_context(
  p_token text
)
RETURNS TABLE (
  id uuid,
  campaign_name text,
  client_name text,
  status public.client_io_status,
  terms_html text,
  terms_text text,
  attachment_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cio.id,
    ch.name AS campaign_name,
    c.name AS client_name,
    cio.status,
    cio.terms_html,
    cio.terms_text,
    cio.attachment_url
  FROM public.client_ios cio
  JOIN public.campaign_headers ch ON ch.id = cio.campaign_header_id
  JOIN public.clients c ON c.id = cio.client_id
  WHERE cio.approval_token_hash = public.hash_io_approval_token(p_token)
    AND (cio.approval_token_expires_at IS NULL OR cio.approval_token_expires_at > timezone('utc', now()))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_vendor_io_approval_context(
  p_token text
)
RETURNS TABLE (
  id uuid,
  campaign_name text,
  influencer_name text,
  amount numeric,
  currency_code char(3),
  status public.vendor_io_status,
  terms_html text,
  terms_text text,
  attachment_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vio.id,
    ch.name AS campaign_name,
    i.display_name AS influencer_name,
    vio.amount,
    vio.currency_code,
    vio.status,
    vio.terms_html,
    vio.terms_text,
    vio.attachment_url
  FROM public.vendor_ios vio
  JOIN public.campaign_headers ch ON ch.id = vio.campaign_header_id
  JOIN public.influencers i ON i.id = vio.influencer_id
  WHERE vio.approval_token_hash = public.hash_io_approval_token(p_token)
    AND (vio.approval_token_expires_at IS NULL OR vio.approval_token_expires_at > timezone('utc', now()))
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('client_ios.read', 'client_ios', 'read', 'View client IOs'),
  ('client_ios.write', 'client_ios', 'write', 'Create/update/send client IOs'),
  ('vendor_ios.read', 'vendor_ios', 'read', 'View vendor IOs'),
  ('vendor_ios.write', 'vendor_ios', 'write', 'Create/update/send vendor IOs')
ON CONFLICT (slug) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    updated_at = timezone('utc', now());

WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN (
  'client_ios.read', 'client_ios.write', 'vendor_ios.read', 'vendor_ios.write'
)
WHERE r.slug IN ('super_admin', 'admin', 'account_manager', 'operations', 'finance')
ON CONFLICT DO NOTHING;

WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN ('client_ios.read', 'vendor_ios.read')
WHERE r.slug IN ('client_user', 'influencer')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_client_ios_updated_at ON public.client_ios;
CREATE TRIGGER set_client_ios_updated_at
  BEFORE UPDATE ON public.client_ios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_vendor_ios_updated_at ON public.vendor_ios;
CREATE TRIGGER set_vendor_ios_updated_at
  BEFORE UPDATE ON public.vendor_ios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS auto_create_vendor_io_on_assignment ON public.campaign_influencers;
CREATE TRIGGER auto_create_vendor_io_on_assignment
  AFTER INSERT OR UPDATE OF status, agreed_fee, currency, deliverable_count ON public.campaign_influencers
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_vendor_io_on_assignment();

DROP TRIGGER IF EXISTS auto_create_vendor_io_on_line_assigned ON public.campaign_lines;
CREATE TRIGGER auto_create_vendor_io_on_line_assigned
  AFTER INSERT OR UPDATE OF assignment_status ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_vendor_io_on_line_assigned();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_ios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.io_notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_ios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.io_notifications FORCE ROW LEVEL SECURITY;

-- Client IO policies
DROP POLICY IF EXISTS client_ios_select ON public.client_ios;
CREATE POLICY client_ios_select ON public.client_ios
  FOR SELECT TO authenticated
  USING (
    (
      public.has_permission('client_ios.read')
      OR public.has_permission('campaigns.read')
    )
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS client_ios_write ON public.client_ios;
CREATE POLICY client_ios_write ON public.client_ios
  FOR ALL TO authenticated
  USING (
    (
      public.has_permission('client_ios.write')
      OR public.has_permission('campaigns.write')
    )
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    (
      public.has_permission('client_ios.write')
      OR public.has_permission('campaigns.write')
    )
    AND public.can_access_campaign_header(campaign_header_id)
  );

-- Vendor IO policies
DROP POLICY IF EXISTS vendor_ios_select ON public.vendor_ios;
CREATE POLICY vendor_ios_select ON public.vendor_ios
  FOR SELECT TO authenticated
  USING (
    (
      public.has_permission('vendor_ios.read')
      OR public.has_permission('campaigns.read')
    )
    AND (
      public.can_access_campaign_header(campaign_header_id)
      OR EXISTS (
        SELECT 1
        FROM public.influencers i
        WHERE i.id = influencer_id
          AND i.profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS vendor_ios_write ON public.vendor_ios;
CREATE POLICY vendor_ios_write ON public.vendor_ios
  FOR ALL TO authenticated
  USING (
    (
      public.has_permission('vendor_ios.write')
      OR public.has_permission('campaigns.write')
    )
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    (
      public.has_permission('vendor_ios.write')
      OR public.has_permission('campaigns.write')
    )
    AND public.can_access_campaign_header(campaign_header_id)
  );

-- IO notifications policies (internal only)
DROP POLICY IF EXISTS io_notifications_select ON public.io_notifications;
CREATE POLICY io_notifications_select ON public.io_notifications
  FOR SELECT TO authenticated
  USING (public.is_internal_user() OR public.has_permission('audit.read'));

DROP POLICY IF EXISTS io_notifications_insert ON public.io_notifications;
CREATE POLICY io_notifications_insert ON public.io_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user());

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_ios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_ios TO authenticated;
GRANT SELECT, INSERT ON public.io_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_client_io_for_campaign(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_vendor_io_from_assignment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_client_io(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_vendor_io(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_client_io_by_token(text, text, inet) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_vendor_io_by_token(text, text, inet) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_vendor_io_by_token(text, text, text, inet) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_io_approval_context(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_io_approval_context(text) TO anon, authenticated;

