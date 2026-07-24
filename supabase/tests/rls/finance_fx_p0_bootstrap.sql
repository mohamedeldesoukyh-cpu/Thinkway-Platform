-- Minimal bootstrap so P0 finance migrations + regression tests can run
-- outside full supabase start (which fails: first migration ALTERs clients
-- before schema.sql is applied).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

DO $$ BEGIN
  CREATE TYPE public.client_status AS ENUM ('prospect', 'active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_document_kind AS ENUM (
    'client_invoice', 'vendor_io', 'client_credit_note', 'vendor_credit_note',
    'client_debit_note', 'vendor_debit_note'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_adjustment_status AS ENUM (
    'draft', 'approved', 'posted', 'cancelled', 'void', 'pending_repost'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_posting_batch_status AS ENUM (
    'draft', 'posted', 'reversed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.erp_sync_status AS ENUM (
    'queued', 'sent', 'acknowledged', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.finance_document_link_type AS ENUM (
    'adjustment_to_invoice', 'adjustment_to_vendor_io', 'payment_to_invoice',
    'posting_batch', 'reversal_of'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('draft', 'active', 'exceeded', 'expired', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  role_id uuid REFERENCES public.roles (id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  status public.client_status NOT NULL DEFAULT 'prospect',
  account_manager_id uuid REFERENCES public.profiles (id),
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.client_users (
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  access_role text NOT NULL DEFAULT 'view',
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (client_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.md_currencies (
  code char(3) PRIMARY KEY,
  name text NOT NULL,
  symbol text,
  country_code text,
  decimal_places integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.campaign_headers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients (id),
  account_manager_id uuid REFERENCES public.profiles (id),
  created_by uuid REFERENCES public.profiles (id),
  name text
);

CREATE TABLE IF NOT EXISTS public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles (id)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients (id)
);

CREATE TABLE IF NOT EXISTS public.vendor_ios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.md_exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency char(3) NOT NULL REFERENCES public.md_currencies (code),
  to_currency char(3) NOT NULL REFERENCES public.md_currencies (code),
  exchange_rate numeric(18, 8) NOT NULL,
  effective_start_date date NOT NULL,
  effective_end_date date,
  source text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.fx_rate_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text,
  old_data jsonb,
  new_data jsonb,
  override_reason text,
  recalculation_scope text,
  impacted_record_count integer,
  changed_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.po_governance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  action text NOT NULL,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  override_reason text,
  changed_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.finance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.campaign_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  po_number text NOT NULL,
  po_currency char(3) NOT NULL REFERENCES public.md_currencies (code),
  po_exchange_rate numeric(18, 8) NOT NULL DEFAULT 1,
  po_amount_original numeric(14, 2) NOT NULL DEFAULT 0,
  po_amount_campaign_currency numeric(14, 2) NOT NULL DEFAULT 0,
  po_consumed_amount numeric(14, 2) NOT NULL DEFAULT 0,
  po_remaining_amount numeric(14, 2) NOT NULL DEFAULT 0,
  po_remaining_percent numeric(8, 4),
  po_status public.po_status NOT NULL DEFAULT 'draft',
  po_expiry_date date,
  is_primary boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.finance_posting_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  transaction_type public.finance_document_kind NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  legal_entity_id uuid REFERENCES public.clients (id),
  currency char(3),
  status public.finance_posting_batch_status NOT NULL DEFAULT 'draft',
  document_count integer NOT NULL DEFAULT 0,
  total_before_vat numeric(14, 2) NOT NULL DEFAULT 0,
  total_vat numeric(14, 2) NOT NULL DEFAULT 0,
  total_after_vat numeric(14, 2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.finance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_kind public.finance_document_kind NOT NULL,
  document_number text NOT NULL UNIQUE,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients (id),
  vendor_id uuid REFERENCES public.influencers (id),
  campaign_header_id uuid REFERENCES public.campaign_headers (id),
  currency char(3) NOT NULL DEFAULT 'USD',
  amount_before_vat numeric(14, 2) NOT NULL DEFAULT 0,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  posting_batch_id uuid REFERENCES public.finance_posting_batches (id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (source_table, source_id)
);

CREATE TABLE IF NOT EXISTS public.erp_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_batch_id uuid REFERENCES public.finance_posting_batches (id),
  finance_document_id uuid REFERENCES public.finance_documents (id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.erp_sync_status NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.finance_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_type public.finance_document_link_type NOT NULL,
  source_document_id uuid NOT NULL REFERENCES public.finance_documents (id),
  target_document_id uuid NOT NULL REFERENCES public.finance_documents (id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.client_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  invoice_id uuid NOT NULL REFERENCES public.invoices (id),
  client_id uuid NOT NULL REFERENCES public.clients (id),
  campaign_header_id uuid REFERENCES public.campaign_headers (id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.vendor_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  vendor_io_id uuid REFERENCES public.vendor_ios (id),
  vendor_id uuid NOT NULL REFERENCES public.influencers (id),
  campaign_header_id uuid REFERENCES public.campaign_headers (id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.client_debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  invoice_id uuid REFERENCES public.invoices (id),
  client_id uuid NOT NULL REFERENCES public.clients (id),
  campaign_header_id uuid REFERENCES public.campaign_headers (id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.vendor_debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  vendor_io_id uuid REFERENCES public.vendor_ios (id),
  vendor_id uuid NOT NULL REFERENCES public.influencers (id),
  campaign_header_id uuid REFERENCES public.campaign_headers (id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);

CREATE TABLE IF NOT EXISTS public.period_lock_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.finance_override_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.invoice_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.md_vat_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Auth helpers (from schema.sql)
CREATE OR REPLACE FUNCTION public.get_user_role_slug()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.slug FROM public.profiles p
  LEFT JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid() AND p.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_id = p.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE p.id = auth.uid() AND p.is_active = true AND perm.slug = p_permission
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role_slug() IN ('super_admin', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role_slug() IN (
    'super_admin', 'admin', 'account_manager', 'finance', 'operations'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin()
    OR (
      public.is_internal_user()
      AND (
        public.has_permission('clients.read')
        OR public.has_permission('clients.write')
        OR public.has_permission('invoices.read')
        OR public.has_permission('invoices.write')
        OR public.has_permission('payments.read')
        OR public.has_permission('payments.write')
        OR public.has_permission('campaigns.read')
        OR public.has_permission('finance.read')
        OR public.has_permission('finance.write')
        OR public.has_permission('finance.override')
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = p_client_id AND c.account_manager_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.client_id = p_client_id AND cu.profile_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_campaign_header(p_header_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.campaign_headers h
      WHERE h.id = p_header_id
        AND (h.account_manager_id = auth.uid() OR h.created_by = auth.uid())
    )
    OR public.can_access_client(
      (SELECT client_id FROM public.campaign_headers WHERE id = p_header_id)
    );
$$;

-- Roles / permissions seed
INSERT INTO public.roles (slug, name, is_system) VALUES
  ('super_admin', 'Super Admin', true),
  ('admin', 'Admin', true),
  ('account_manager', 'Account Manager', true),
  ('finance', 'Finance', true),
  ('operations', 'Operations', true),
  ('viewer', 'Viewer', true),
  ('client_user', 'Client User', true),
  ('influencer', 'Influencer', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.permissions (slug, resource, action, description) VALUES
  ('clients.read', 'clients', 'read', ''),
  ('invoices.read', 'invoices', 'read', ''),
  ('invoices.write', 'invoices', 'write', ''),
  ('finance.read', 'finance', 'read', ''),
  ('finance.write', 'finance', 'write', ''),
  ('finance.override', 'finance', 'override', '')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.slug IN (
  'clients.read', 'invoices.read', 'invoices.write',
  'finance.read', 'finance.write', 'finance.override'
)
WHERE r.slug = 'finance'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.slug = 'finance.override'
WHERE r.slug = 'operations'
ON CONFLICT DO NOTHING;

INSERT INTO public.md_currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('EGP', 'Egyptian Pound', 'E£'),
  ('P0T', 'P0 Test', 'P')
ON CONFLICT (code) DO NOTHING;

-- Roles used by Supabase migrations / SET ROLE tests
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
