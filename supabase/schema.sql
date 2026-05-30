-- =============================================================
-- Thinkway Platform — Complete Database Schema
-- PostgreSQL 15 / Supabase
-- Run via: supabase db push  OR  psql -f schema.sql
-- =============================================================

-- =============================================================
-- EXTENSIONS
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- ENUM TYPES
-- =============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin', 'director', 'manager', 'account_manager', 'finance', 'data_entry'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM (
    'active', 'inactive', 'suspended', 'pending_invitation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM (
    'draft', 'planning', 'active', 'paused', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_type AS ENUM ('fixed', 'hard_roi', 'performance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_influencer_status AS ENUM (
    'invited', 'confirmed', 'active', 'completed', 'declined', 'removed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE client_status AS ENUM (
    'active', 'inactive', 'prospect', 'churned', 'on_hold'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE client_tier AS ENUM (
    'standard', 'premium', 'enterprise', 'strategic'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vendor_status AS ENUM (
    'active', 'inactive', 'pending_onboarding', 'blacklisted', 'under_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE influencer_tier AS ENUM ('nano', 'micro', 'mid', 'macro', 'mega');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deliverable_type AS ENUM (
    'instagram_post', 'instagram_story', 'instagram_reel', 'instagram_carousel',
    'tiktok_video', 'youtube_video', 'youtube_short', 'twitter_post',
    'facebook_post', 'facebook_reel', 'linkedin_post', 'blog_post',
    'podcast_mention', 'live_stream', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deliverable_status AS ENUM (
    'not_started', 'in_progress', 'submitted', 'in_review',
    'revision_requested', 'approved', 'scheduled', 'published',
    'live', 'rejected', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft', 'sent', 'viewed', 'partially_paid', 'paid',
    'overdue', 'cancelled', 'void'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM (
    'pending', 'in_review', 'approved', 'rejected', 'revision_requested', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_type AS ENUM (
    'instagram', 'tiktok', 'youtube', 'x', 'facebook',
    'linkedin', 'snapchat', 'pinterest', 'threads'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE currency_type AS ENUM (
    'USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legal_entity AS ENUM ('uae', 'ksa', 'kwt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'bank_transfer', 'paypal', 'stripe', 'wise', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE revision_status AS ENUM (
    'pending', 'approved', 'rejected', 'revision_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- SEQUENCES TABLE (thread-safe auto-numbering with annual reset)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.sequences (
  key        TEXT    PRIMARY KEY,
  last_value BIGINT  NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_sequence_value(seq_key TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result BIGINT;
BEGIN
  INSERT INTO sequences (key, last_value) VALUES (seq_key, 1)
  ON CONFLICT (key) DO UPDATE
    SET last_value = sequences.last_value + 1
  RETURNING last_value INTO result;
  RETURN result;
END;
$$;

-- =============================================================
-- SHARED TRIGGER: updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================
-- PROFILES
-- Managed by Supabase Auth; one row per auth.users row.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID           PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT           NOT NULL,
  full_name        TEXT           NOT NULL DEFAULT '',
  first_name       TEXT,
  last_name        TEXT,
  avatar_url       TEXT,
  role             user_role      NOT NULL DEFAULT 'data_entry',
  team             TEXT,
  reports_to_id    UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           user_status    NOT NULL DEFAULT 'active',
  organization_id  UUID,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx    ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_status_idx  ON public.profiles (status);
CREATE INDEX IF NOT EXISTS profiles_email_idx   ON public.profiles (email);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'data_entry',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- CLIENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code          TEXT           UNIQUE,
  name                 TEXT           NOT NULL,
  trading_name         TEXT,
  logo_url             TEXT,
  industry             TEXT           NOT NULL,
  website              TEXT,
  description          TEXT,
  tier                 client_tier    NOT NULL DEFAULT 'standard',
  status               client_status  NOT NULL DEFAULT 'prospect',
  parent_group         TEXT,
  tax_id               TEXT,
  currency             currency_type  NOT NULL DEFAULT 'USD',
  payment_terms_days   INTEGER        NOT NULL DEFAULT 30,
  account_manager_id   UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes                TEXT,
  tags                 TEXT[]         NOT NULL DEFAULT '{}',
  address              JSONB,
  onboarded_at         TIMESTAMPTZ,
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  created_by           UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by           UUID           REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS clients_status_idx      ON public.clients (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS clients_tier_idx        ON public.clients (tier)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS clients_industry_idx    ON public.clients (industry) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS clients_am_idx          ON public.clients (account_manager_id);
CREATE INDEX IF NOT EXISTS clients_deleted_at_idx  ON public.clients (deleted_at);

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-assign client_code
CREATE OR REPLACE FUNCTION public.assign_client_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.client_code IS NULL THEN
    NEW.client_code := 'C' || LPAD(next_sequence_value('client_code')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_assign_code ON public.clients;
CREATE TRIGGER clients_assign_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION assign_client_code();

-- =============================================================
-- CLIENT CONTACTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID         NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name         TEXT         NOT NULL,
  email        TEXT         NOT NULL,
  phone        TEXT,
  role         TEXT,
  is_primary   BOOLEAN      NOT NULL DEFAULT false,
  linkedin_url TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_contacts_client_idx ON public.client_contacts (client_id);

DROP TRIGGER IF EXISTS client_contacts_updated_at ON public.client_contacts;
CREATE TRIGGER client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- VENDORS (influencers / creators)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id                        UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code               TEXT              UNIQUE,
  first_name                TEXT              NOT NULL,
  last_name                 TEXT              NOT NULL,
  display_name              TEXT,
  email                     TEXT              NOT NULL,
  phone                     TEXT,
  avatar_url                TEXT,
  bio                       TEXT,
  location                  TEXT              NOT NULL DEFAULT '',
  country                   TEXT              NOT NULL DEFAULT '',
  nationality               TEXT,
  primary_language          TEXT              NOT NULL DEFAULT 'en',
  languages                 TEXT[]            NOT NULL DEFAULT '{}',
  niche                     TEXT[]            NOT NULL DEFAULT '{}',
  content_categories        TEXT[]            NOT NULL DEFAULT '{}',
  tier                      influencer_tier   NOT NULL DEFAULT 'micro',
  status                    vendor_status     NOT NULL DEFAULT 'pending_onboarding',
  total_followers           BIGINT            NOT NULL DEFAULT 0,
  primary_platform          platform_type     NOT NULL DEFAULT 'instagram',
  average_engagement_rate   NUMERIC(6,4)      NOT NULL DEFAULT 0,
  default_rate              NUMERIC(12,2)     NOT NULL DEFAULT 0,
  default_currency          currency_type     NOT NULL DEFAULT 'USD',
  tax_id                    TEXT,
  payment_details           JSONB,
  notes                     TEXT,
  tags                      TEXT[]            NOT NULL DEFAULT '{}',
  agent_name                TEXT,
  agent_email               TEXT,
  contract_signed_at        TIMESTAMPTZ,
  onboarded_at              TIMESTAMPTZ,
  last_campaign_at          TIMESTAMPTZ,
  total_campaigns           INTEGER           NOT NULL DEFAULT 0,
  active_manager_id         UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at                TIMESTAMPTZ,
  created_at                TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ       NOT NULL DEFAULT now(),
  created_by                UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by                UUID              REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS vendors_status_idx     ON public.vendors (status)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vendors_tier_idx       ON public.vendors (tier)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vendors_platform_idx   ON public.vendors (primary_platform) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vendors_manager_idx    ON public.vendors (active_manager_id);
CREATE INDEX IF NOT EXISTS vendors_email_idx      ON public.vendors (email)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vendors_deleted_at_idx ON public.vendors (deleted_at);

DROP TRIGGER IF EXISTS vendors_updated_at ON public.vendors;
CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE OR REPLACE FUNCTION public.assign_vendor_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vendor_code IS NULL THEN
    NEW.vendor_code := 'V' || LPAD(next_sequence_value('vendor_code')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_assign_code ON public.vendors;
CREATE TRIGGER vendors_assign_code
  BEFORE INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION assign_vendor_code();

-- =============================================================
-- VENDOR SOCIAL PROFILES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.vendor_social_profiles (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           UUID           NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  platform            platform_type  NOT NULL,
  handle              TEXT           NOT NULL,
  profile_url         TEXT,
  followers           BIGINT         NOT NULL DEFAULT 0,
  following           BIGINT,
  avg_likes           NUMERIC(12,2),
  avg_comments        NUMERIC(12,2),
  engagement_rate     NUMERIC(6,4)   NOT NULL DEFAULT 0,
  is_verified         BOOLEAN        NOT NULL DEFAULT false,
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, platform)
);

CREATE INDEX IF NOT EXISTS vendor_social_vendor_idx ON public.vendor_social_profiles (vendor_id);

DROP TRIGGER IF EXISTS vendor_social_updated_at ON public.vendor_social_profiles;
CREATE TRIGGER vendor_social_updated_at
  BEFORE UPDATE ON public.vendor_social_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- CAMPAIGNS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                    UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_number       TEXT             UNIQUE,
  name                  TEXT             NOT NULL,
  description           TEXT,
  client_id             UUID             NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  campaign_type         campaign_type    NOT NULL DEFAULT 'fixed',
  status                campaign_status  NOT NULL DEFAULT 'draft',
  lifecycle_stage       INTEGER          NOT NULL DEFAULT 1 CHECK (lifecycle_stage BETWEEN 1 AND 15),
  start_date            DATE             NOT NULL,
  end_date              DATE             NOT NULL,
  budget_amount         NUMERIC(15,2)    NOT NULL DEFAULT 0,
  budget_currency       currency_type    NOT NULL DEFAULT 'USD',
  spent_amount          NUMERIC(15,2)    NOT NULL DEFAULT 0,
  target_reach          BIGINT,
  target_impressions    BIGINT,
  target_engagements    BIGINT,
  target_clicks         BIGINT,
  target_conversions    BIGINT,
  brief_url             TEXT,
  hashtags              TEXT[]           NOT NULL DEFAULT '{}',
  mentions              TEXT[]           NOT NULL DEFAULT '{}',
  goals                 TEXT,
  manager_id            UUID             REFERENCES public.profiles(id) ON DELETE SET NULL,
  team                  TEXT,
  tags                  TEXT[]           NOT NULL DEFAULT '{}',
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT now(),
  created_by            UUID             REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by            UUID             REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx     ON public.campaigns (status)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS campaigns_client_idx     ON public.campaigns (client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS campaigns_manager_idx    ON public.campaigns (manager_id);
CREATE INDEX IF NOT EXISTS campaigns_dates_idx      ON public.campaigns (start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS campaigns_deleted_at_idx ON public.campaigns (deleted_at);

DROP TRIGGER IF EXISTS campaigns_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE OR REPLACE FUNCTION public.assign_campaign_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_str TEXT := to_char(now(), 'YYYY');
BEGIN
  IF NEW.campaign_number IS NULL THEN
    NEW.campaign_number := 'TW-' || year_str || '-' ||
      LPAD(next_sequence_value('campaign_' || year_str)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaigns_assign_number ON public.campaigns;
CREATE TRIGGER campaigns_assign_number
  BEFORE INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION assign_campaign_number();

-- =============================================================
-- CAMPAIGN INFLUENCERS (junction: campaigns ↔ vendors)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.campaign_influencers (
  id            UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID                       NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  vendor_id     UUID                       NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  status        campaign_influencer_status NOT NULL DEFAULT 'invited',
  agreed_rate   NUMERIC(12,2)              NOT NULL DEFAULT 0,
  currency      currency_type              NOT NULL DEFAULT 'USD',
  confirmed_at  TIMESTAMPTZ,
  manager_id    UUID                       REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ                NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ                NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS campaign_influencers_campaign_idx ON public.campaign_influencers (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_influencers_vendor_idx   ON public.campaign_influencers (vendor_id);

DROP TRIGGER IF EXISTS campaign_influencers_updated_at ON public.campaign_influencers;
CREATE TRIGGER campaign_influencers_updated_at
  BEFORE UPDATE ON public.campaign_influencers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- DELIVERABLES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.deliverables (
  id                      UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id             UUID               NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  campaign_influencer_id  UUID               REFERENCES public.campaign_influencers(id) ON DELETE SET NULL,
  type                    deliverable_type   NOT NULL,
  platform                platform_type      NOT NULL,
  status                  deliverable_status NOT NULL DEFAULT 'not_started',
  due_date                DATE               NOT NULL,
  submitted_at            TIMESTAMPTZ,
  approved_at             TIMESTAMPTZ,
  scheduled_at            TIMESTAMPTZ,
  published_at            TIMESTAMPTZ,
  published_url           TEXT,
  content_url             TEXT,
  description             TEXT,
  caption                 TEXT,
  hashtags                TEXT[]             NOT NULL DEFAULT '{}',
  mentions                TEXT[]             NOT NULL DEFAULT '{}',
  requirements            TEXT,
  metrics                 JSONB,
  current_revision        INTEGER            NOT NULL DEFAULT 0,
  is_usage_rights_granted BOOLEAN            NOT NULL DEFAULT false,
  usage_rights_expiry     DATE,
  notes                   TEXT,
  assigned_reviewer_id    UUID               REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ        NOT NULL DEFAULT now(),
  created_by              UUID               REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID               REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS deliverables_campaign_idx     ON public.deliverables (campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS deliverables_ci_idx           ON public.deliverables (campaign_influencer_id);
CREATE INDEX IF NOT EXISTS deliverables_status_idx       ON public.deliverables (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS deliverables_reviewer_idx     ON public.deliverables (assigned_reviewer_id);
CREATE INDEX IF NOT EXISTS deliverables_deleted_at_idx   ON public.deliverables (deleted_at);

DROP TRIGGER IF EXISTS deliverables_updated_at ON public.deliverables;
CREATE TRIGGER deliverables_updated_at
  BEFORE UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- DELIVERABLE REVISIONS (immutable history)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.deliverable_revisions (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id  UUID             NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  round           INTEGER          NOT NULL,
  submitted_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  content_url     TEXT,
  notes           TEXT,
  reviewer_id     UUID             REFERENCES public.profiles(id) ON DELETE SET NULL,
  feedback        TEXT,
  reviewed_at     TIMESTAMPTZ,
  status          revision_status  NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now(),
  UNIQUE (deliverable_id, round)
);

CREATE INDEX IF NOT EXISTS deliverable_revisions_del_idx ON public.deliverable_revisions (deliverable_id);

-- =============================================================
-- INVOICES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT            UNIQUE,
  client_id       UUID            NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  campaign_id     UUID            REFERENCES public.campaigns(id) ON DELETE SET NULL,
  status          invoice_status  NOT NULL DEFAULT 'draft',
  issue_date      DATE            NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE            NOT NULL,
  currency        currency_type   NOT NULL DEFAULT 'USD',
  subtotal        NUMERIC(15,2)   NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4)    NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(15,2)   NOT NULL DEFAULT 0,
  total_amount    NUMERIC(15,2)   NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(15,2)   NOT NULL DEFAULT 0,
  notes           TEXT,
  terms           TEXT,
  po_number       TEXT,
  legal_entity    legal_entity,
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  voided_at       TIMESTAMPTZ,
  void_reason     TEXT,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  created_by      UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      UUID            REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS invoices_client_idx      ON public.invoices (client_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_campaign_idx    ON public.invoices (campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_status_idx      ON public.invoices (status)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_due_date_idx    ON public.invoices (due_date)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_deleted_at_idx  ON public.invoices (deleted_at);

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_str TEXT := to_char(now(), 'YYYY');
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV-' || year_str || '-' ||
      LPAD(next_sequence_value('invoice_' || year_str)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_assign_number ON public.invoices;
CREATE TRIGGER invoices_assign_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION assign_invoice_number();

-- =============================================================
-- INVOICE LINE ITEMS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID          NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description     TEXT          NOT NULL,
  campaign_id     UUID          REFERENCES public.campaigns(id) ON DELETE SET NULL,
  vendor_id       UUID          REFERENCES public.vendors(id) ON DELETE SET NULL,
  deliverable_id  UUID          REFERENCES public.deliverables(id) ON DELETE SET NULL,
  quantity        NUMERIC(10,4) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order      INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_idx ON public.invoice_line_items (invoice_id);

DROP TRIGGER IF EXISTS invoice_line_items_updated_at ON public.invoice_line_items;
CREATE TRIGGER invoice_line_items_updated_at
  BEFORE UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- PAYMENTS (vendor outgoing payments)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number  TEXT            UNIQUE,
  vendor_id       UUID            NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  campaign_id     UUID            REFERENCES public.campaigns(id) ON DELETE SET NULL,
  deliverable_id  UUID            REFERENCES public.deliverables(id) ON DELETE SET NULL,
  status          payment_status  NOT NULL DEFAULT 'pending',
  amount          NUMERIC(15,2)   NOT NULL,
  currency        currency_type   NOT NULL DEFAULT 'USD',
  payment_method  payment_method  NOT NULL DEFAULT 'bank_transfer',
  reference       TEXT,
  notes           TEXT,
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  created_by      UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      UUID            REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payments_vendor_idx      ON public.payments (vendor_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_campaign_idx    ON public.payments (campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_status_idx      ON public.payments (status)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS payments_deleted_at_idx  ON public.payments (deleted_at);

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE OR REPLACE FUNCTION public.assign_payment_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_str TEXT := to_char(now(), 'YYYY');
BEGIN
  IF NEW.payment_number IS NULL THEN
    NEW.payment_number := 'PAY-' || year_str || '-' ||
      LPAD(next_sequence_value('payment_' || year_str)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_assign_number ON public.payments;
CREATE TRIGGER payments_assign_number
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION assign_payment_number();

-- =============================================================
-- APPROVALS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.approvals (
  id                      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id          UUID              NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  revision_round          INTEGER           NOT NULL DEFAULT 0,
  status                  approval_status   NOT NULL DEFAULT 'pending',
  priority                approval_priority NOT NULL DEFAULT 'medium',
  deadline                TIMESTAMPTZ,
  assigned_reviewer_id    UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  reviewed_at             TIMESTAMPTZ,
  reviewer_id             UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_url             TEXT,
  caption                 TEXT,
  internal_notes          TEXT,
  requires_client_approval BOOLEAN          NOT NULL DEFAULT false,
  client_approved_at      TIMESTAMPTZ,
  client_reviewer_id      UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ       NOT NULL DEFAULT now(),
  created_by              UUID              REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by              UUID              REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS approvals_deliverable_idx  ON public.approvals (deliverable_id);
CREATE INDEX IF NOT EXISTS approvals_status_idx       ON public.approvals (status);
CREATE INDEX IF NOT EXISTS approvals_reviewer_idx     ON public.approvals (assigned_reviewer_id);

DROP TRIGGER IF EXISTS approvals_updated_at ON public.approvals;
CREATE TRIGGER approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- APPROVAL COMMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.approval_comments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id  UUID         NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  author_id    UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content      TEXT         NOT NULL,
  is_internal  BOOLEAN      NOT NULL DEFAULT false,
  attachments  TEXT[]       NOT NULL DEFAULT '{}',
  is_edited    BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_comments_approval_idx ON public.approval_comments (approval_id);

DROP TRIGGER IF EXISTS approval_comments_updated_at ON public.approval_comments;
CREATE TRIGGER approval_comments_updated_at
  BEFORE UPDATE ON public.approval_comments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================
-- AUDIT LOGS (immutable — no updated_at, no deletes)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email    TEXT         NOT NULL,
  actor_role     TEXT         NOT NULL,
  action         TEXT         NOT NULL,
  resource_type  TEXT         NOT NULL,
  resource_id    UUID,
  resource_name  TEXT,
  changes        JSONB,
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx         ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx      ON public.audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx        ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx    ON public.audit_logs (created_at DESC);
