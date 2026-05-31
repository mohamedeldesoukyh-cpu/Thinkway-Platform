-- =============================================================================
-- Thinkway Platform — Database Schema
-- Run in Supabase SQL Editor (or via migration) BEFORE policies.sql and seed.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'invited', 'suspended');

CREATE TYPE public.client_status AS ENUM ('prospect', 'active', 'inactive', 'archived');

CREATE TYPE public.campaign_status AS ENUM (
  'draft',
  'planning',
  'active',
  'paused',
  'completed',
  'cancelled'
);

CREATE TYPE public.influencer_status AS ENUM ('prospect', 'active', 'inactive', 'blacklisted');

CREATE TYPE public.campaign_influencer_status AS ENUM (
  'invited',
  'negotiating',
  'confirmed',
  'declined',
  'completed',
  'cancelled'
);

CREATE TYPE public.deliverable_type AS ENUM (
  'instagram_post',
  'instagram_story',
  'instagram_reel',
  'tiktok_video',
  'youtube_video',
  'youtube_short',
  'twitter_post',
  'linkedin_post',
  'blog_post',
  'live_stream',
  'other'
);

CREATE TYPE public.deliverable_status AS ENUM (
  'pending',
  'in_progress',
  'submitted',
  'revision_requested',
  'approved',
  'rejected',
  'published',
  'cancelled'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'void'
);

CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'cancelled'
);

CREATE TYPE public.payment_method AS ENUM (
  'bank_transfer',
  'credit_card',
  'debit_card',
  'paypal',
  'wire',
  'check',
  'other'
);

CREATE TYPE public.approval_entity_type AS ENUM (
  'campaign',
  'deliverable',
  'invoice',
  'payment',
  'campaign_influencer'
);

CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'in_review',
  'approved',
  'rejected',
  'cancelled',
  'expired'
);

CREATE TYPE public.audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'approve',
  'reject',
  'submit',
  'publish',
  'void',
  'export'
);

CREATE TYPE public.campaign_member_role AS ENUM ('lead', 'coordinator', 'viewer');

-- -----------------------------------------------------------------------------
-- Shared utility functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_document_number(
  p_prefix text,
  p_padding integer DEFAULT 6
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO public.document_sequences AS ds (prefix, last_value)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = ds.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN p_prefix || '-' || lpad(v_next::text, p_padding, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    NEW.document_number := public.next_document_number(TG_ARGV[0]);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_role_id uuid;
BEGIN
  SELECT id
  INTO v_default_role_id
  FROM public.roles
  WHERE slug = 'viewer'
  LIMIT 1;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role_id,
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url',
    v_default_role_id,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
      updated_at = timezone('utc', now());

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.audit_action;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_entity_id := NEW.id;
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_entity_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  )
  VALUES (
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
BEGIN
  SELECT COALESCE(SUM(line_total), 0)
  INTO v_subtotal
  FROM public.invoice_line_items
  WHERE invoice_id = p_invoice_id;

  SELECT tax_amount
  INTO v_tax
  FROM public.invoices
  WHERE id = p_invoice_id;

  v_total := v_subtotal + COALESCE(v_tax, 0);

  UPDATE public.invoices
  SET
    subtotal = v_subtotal,
    total = v_total,
    updated_at = timezone('utc', now())
  WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT total
  INTO v_total
  FROM public.invoices
  WHERE id = v_invoice_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM public.payments
  WHERE invoice_id = v_invoice_id
    AND status = 'completed';

  UPDATE public.invoices
  SET
    amount_paid = v_paid,
    status = CASE
      WHEN status = 'void' THEN status
      WHEN v_paid <= 0 THEN
        CASE WHEN status IN ('sent', 'overdue') THEN status ELSE 'sent' END
      WHEN v_paid >= v_total THEN 'paid'
      ELSE 'partial'
    END,
    updated_at = timezone('utc', now())
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_invoice_line_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.line_total := ROUND(COALESCE(NEW.quantity, 1) * COALESCE(NEW.unit_price, 0), 2);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.after_invoice_line_item_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- Authorization (roles & permissions)
-- -----------------------------------------------------------------------------
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  resource text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT permissions_resource_action_unique UNIQUE (resource, action)
);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (role_id, permission_id)
);

-- -----------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email citext NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  job_title text,
  role_id uuid REFERENCES public.roles (id) ON DELETE SET NULL,
  status public.user_status NOT NULL DEFAULT 'invited',
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX profiles_role_id_idx ON public.profiles (role_id);
CREATE INDEX profiles_email_idx ON public.profiles (email);
CREATE INDEX profiles_status_idx ON public.profiles (status);

-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  industry text,
  website text,
  logo_url text,
  status public.client_status NOT NULL DEFAULT 'prospect',
  billing_email citext,
  billing_phone text,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  tax_id text,
  currency char(3) NOT NULL DEFAULT 'USD',
  account_manager_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT clients_currency_check CHECK (char_length(currency) = 3)
);

CREATE INDEX clients_status_idx ON public.clients (status);
CREATE INDEX clients_account_manager_id_idx ON public.clients (account_manager_id);
CREATE INDEX clients_name_idx ON public.clients (name);

CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email citext,
  phone text,
  job_title text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX client_contacts_client_id_idx ON public.client_contacts (client_id);

CREATE TABLE public.client_users (
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (client_id, profile_id)
);

CREATE INDEX client_users_profile_id_idx ON public.client_users (profile_id);

-- -----------------------------------------------------------------------------
-- Campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  brief text,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  budget numeric(14, 2) NOT NULL DEFAULT 0,
  spent numeric(14, 2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  start_date date,
  end_date date,
  account_manager_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT campaigns_currency_check CHECK (char_length(currency) = 3),
  CONSTRAINT campaigns_budget_non_negative CHECK (budget >= 0),
  CONSTRAINT campaigns_spent_non_negative CHECK (spent >= 0),
  CONSTRAINT campaigns_date_range_check CHECK (
    start_date IS NULL OR end_date IS NULL OR start_date <= end_date
  )
);

CREATE INDEX campaigns_client_id_idx ON public.campaigns (client_id);
CREATE INDEX campaigns_status_idx ON public.campaigns (status);
CREATE INDEX campaigns_account_manager_id_idx ON public.campaigns (account_manager_id);
CREATE INDEX campaigns_start_date_idx ON public.campaigns (start_date);

CREATE TABLE public.campaign_members (
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_role public.campaign_member_role NOT NULL DEFAULT 'coordinator',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (campaign_id, profile_id)
);

CREATE INDEX campaign_members_profile_id_idx ON public.campaign_members (profile_id);

-- -----------------------------------------------------------------------------
-- Influencers
-- -----------------------------------------------------------------------------
CREATE TABLE public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  profile_id uuid UNIQUE REFERENCES public.profiles (id) ON DELETE SET NULL,
  display_name text NOT NULL,
  legal_name text,
  email citext,
  phone text,
  status public.influencer_status NOT NULL DEFAULT 'prospect',
  country_code char(2),
  languages text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT '{}',
  rate_card jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX influencers_status_idx ON public.influencers (status);
CREATE INDEX influencers_profile_id_idx ON public.influencers (profile_id);
CREATE INDEX influencers_display_name_idx ON public.influencers (display_name);

CREATE TABLE public.influencer_platform_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform text NOT NULL,
  handle citext NOT NULL,
  profile_url text,
  follower_count bigint NOT NULL DEFAULT 0,
  engagement_rate numeric(6, 3),
  is_verified boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT influencer_platform_accounts_unique UNIQUE (influencer_id, platform, handle)
);

CREATE INDEX influencer_platform_accounts_influencer_id_idx
  ON public.influencer_platform_accounts (influencer_id);

CREATE TABLE public.campaign_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE RESTRICT,
  status public.campaign_influencer_status NOT NULL DEFAULT 'invited',
  agreed_fee numeric(14, 2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  deliverable_count integer NOT NULL DEFAULT 0,
  contract_notes text,
  invited_at timestamptz,
  confirmed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT campaign_influencers_unique UNIQUE (campaign_id, influencer_id),
  CONSTRAINT campaign_influencers_currency_check CHECK (char_length(currency) = 3),
  CONSTRAINT campaign_influencers_fee_non_negative CHECK (agreed_fee >= 0),
  CONSTRAINT campaign_influencers_deliverable_count_non_negative CHECK (deliverable_count >= 0)
);

CREATE INDEX campaign_influencers_campaign_id_idx ON public.campaign_influencers (campaign_id);
CREATE INDEX campaign_influencers_influencer_id_idx ON public.campaign_influencers (influencer_id);
CREATE INDEX campaign_influencers_status_idx ON public.campaign_influencers (status);

-- -----------------------------------------------------------------------------
-- Deliverables
-- -----------------------------------------------------------------------------
CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns (id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE RESTRICT,
  campaign_influencer_id uuid REFERENCES public.campaign_influencers (id) ON DELETE SET NULL,
  deliverable_type public.deliverable_type NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text,
  status public.deliverable_status NOT NULL DEFAULT 'pending',
  due_date timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  content_url text,
  proof_url text,
  platform text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX deliverables_campaign_id_idx ON public.deliverables (campaign_id);
CREATE INDEX deliverables_influencer_id_idx ON public.deliverables (influencer_id);
CREATE INDEX deliverables_status_idx ON public.deliverables (status);
CREATE INDEX deliverables_due_date_idx ON public.deliverables (due_date);

-- -----------------------------------------------------------------------------
-- Finance
-- -----------------------------------------------------------------------------
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  campaign_id uuid REFERENCES public.campaigns (id) ON DELETE SET NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  amount_paid numeric(14, 2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT invoices_currency_check CHECK (char_length(currency) = 3),
  CONSTRAINT invoices_amounts_non_negative CHECK (
    subtotal >= 0 AND tax_amount >= 0 AND total >= 0 AND amount_paid >= 0
  )
);

CREATE INDEX invoices_client_id_idx ON public.invoices (client_id);
CREATE INDEX invoices_campaign_id_idx ON public.invoices (campaign_id);
CREATE INDEX invoices_status_idx ON public.invoices (status);
CREATE INDEX invoices_due_date_idx ON public.invoices (due_date);

CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity numeric(12, 4) NOT NULL DEFAULT 1,
  unit_price numeric(14, 2) NOT NULL DEFAULT 0,
  line_total numeric(14, 2) NOT NULL DEFAULT 0,
  campaign_id uuid REFERENCES public.campaigns (id) ON DELETE SET NULL,
  deliverable_id uuid REFERENCES public.deliverables (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT invoice_line_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT invoice_line_items_unit_price_non_negative CHECK (unit_price >= 0)
);

CREATE INDEX invoice_line_items_invoice_id_idx ON public.invoice_line_items (invoice_id);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  reference_number text,
  paid_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT payments_currency_check CHECK (char_length(currency) = 3),
  CONSTRAINT payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX payments_invoice_id_idx ON public.payments (invoice_id);
CREATE INDEX payments_client_id_idx ON public.payments (client_id);
CREATE INDEX payments_status_idx ON public.payments (status);
CREATE INDEX payments_paid_at_idx ON public.payments (paid_at);

-- -----------------------------------------------------------------------------
-- Approvals
-- -----------------------------------------------------------------------------
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  entity_type public.approval_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  title text NOT NULL,
  description text,
  requested_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_notes text,
  due_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX approvals_entity_idx ON public.approvals (entity_type, entity_id);
CREATE INDEX approvals_status_idx ON public.approvals (status);
CREATE INDEX approvals_assigned_to_idx ON public.approvals (assigned_to);
CREATE INDEX approvals_requested_by_idx ON public.approvals (requested_by);

CREATE TABLE public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.approvals (id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  approver_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT approval_steps_unique_order UNIQUE (approval_id, step_order)
);

CREATE INDEX approval_steps_approval_id_idx ON public.approval_steps (approval_id);
CREATE INDEX approval_steps_approver_id_idx ON public.approval_steps (approver_id);

-- -----------------------------------------------------------------------------
-- Audit logs
-- -----------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);

-- -----------------------------------------------------------------------------
-- Document numbering registry
-- -----------------------------------------------------------------------------
CREATE TABLE public.document_sequences (
  prefix text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- Authorization helper functions (depend on tables above)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role_slug()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.slug
  FROM public.profiles p
  LEFT JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid()
    AND p.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_id = p.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND perm.slug = p_permission
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role_slug() IN ('super_admin', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role_slug() IN (
    'super_admin',
    'admin',
    'account_manager',
    'finance',
    'operations'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_client_id
        AND c.account_manager_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.client_users cu
      WHERE cu.client_id = p_client_id
        AND cu.profile_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_campaign(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.campaigns c
      WHERE c.id = p_campaign_id
        AND (
          c.account_manager_id = auth.uid()
          OR c.created_by = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaign_members cm
      WHERE cm.campaign_id = p_campaign_id
        AND cm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaigns c
      JOIN public.client_users cu ON cu.client_id = c.client_id
      WHERE c.id = p_campaign_id
        AND cu.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaign_influencers ci
      JOIN public.influencers i ON i.id = ci.influencer_id
      WHERE ci.campaign_id = p_campaign_id
        AND i.profile_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_influencer(p_influencer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.influencers i
      WHERE i.id = p_influencer_id
        AND i.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaign_influencers ci
      JOIN public.campaigns c ON c.id = ci.campaign_id
      WHERE ci.influencer_id = p_influencer_id
        AND public.can_access_campaign(c.id)
    );
$$;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER set_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_influencer_platform_accounts_updated_at
  BEFORE UPDATE ON public.influencer_platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_campaign_influencers_updated_at
  BEFORE UPDATE ON public.campaign_influencers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_deliverables_updated_at
  BEFORE UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_invoice_line_items_updated_at
  BEFORE UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_approval_steps_updated_at
  BEFORE UPDATE ON public.approval_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auto-numbering triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER assign_clients_document_number
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('CLT');

CREATE TRIGGER assign_campaigns_document_number
  BEFORE INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('CMP');

CREATE TRIGGER assign_influencers_document_number
  BEFORE INSERT ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('INF');

CREATE TRIGGER assign_deliverables_document_number
  BEFORE INSERT ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('DLV');

CREATE TRIGGER assign_invoices_document_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('INV');

CREATE TRIGGER assign_payments_document_number
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('PAY');

CREATE TRIGGER assign_approvals_document_number
  BEFORE INSERT ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('APR');

-- -----------------------------------------------------------------------------
-- Business logic triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER refresh_invoice_line_total
  BEFORE INSERT OR UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.refresh_invoice_line_total();

CREATE TRIGGER after_invoice_line_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.after_invoice_line_item_change();

CREATE TRIGGER sync_invoice_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payment_status();

-- -----------------------------------------------------------------------------
-- Profile auto-create on auth signup
-- -----------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Audit triggers (mutable business entities)
-- -----------------------------------------------------------------------------
CREATE TRIGGER audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_influencers
  AFTER INSERT OR UPDATE OR DELETE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_deliverables
  AFTER INSERT OR UPDATE OR DELETE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER audit_approvals
  AFTER INSERT OR UPDATE OR DELETE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- -----------------------------------------------------------------------------
-- Grants (Supabase authenticated / service roles)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;
