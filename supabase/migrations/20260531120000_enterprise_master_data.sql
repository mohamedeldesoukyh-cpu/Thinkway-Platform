-- =============================================================================
-- Enterprise master data: clients, influencers, documents, platform accounts
-- Idempotent — safe to re-run on Supabase
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'supported_currency') THEN
    CREATE TYPE public.supported_currency AS ENUM ('USD', 'AED', 'SAR', 'EGP', 'EUR');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'payment_terms') THEN
    CREATE TYPE public.payment_terms AS ENUM (
      'due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'custom'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'agency_or_direct') THEN
    CREATE TYPE public.agency_or_direct AS ENUM ('agency', 'direct', 'hybrid');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'client_category') THEN
    CREATE TYPE public.client_category AS ENUM (
      'fmcg', 'beauty', 'automotive', 'technology', 'finance', 'retail', 'government', 'entertainment', 'other'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'client_document_type') THEN
    CREATE TYPE public.client_document_type AS ENUM (
      'trade_license', 'vat_certificate', 'tax_certificate', 'nda', 'msa_contract', 'sow'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'influencer_document_type') THEN
    CREATE TYPE public.influencer_document_type AS ENUM (
      'passport', 'national_id', 'signed_contract', 'media_kit', 'tax_document', 'rate_card'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'contract_status') THEN
    CREATE TYPE public.contract_status AS ENUM (
      'none', 'draft', 'sent', 'signed', 'expired', 'terminated'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'influencer_gender') THEN
    CREATE TYPE public.influencer_gender AS ENUM (
      'female', 'male', 'non_binary', 'prefer_not_to_say', 'other'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'exclusivity_type') THEN
    CREATE TYPE public.exclusivity_type AS ENUM ('none', 'category', 'brand', 'full');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'social_platform') THEN
    CREATE TYPE public.social_platform AS ENUM (
      'instagram', 'tiktok', 'youtube', 'snapchat', 'twitter', 'linkedin', 'facebook'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Clients: legal, finance, compliance columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS trade_license_number text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS vat_number text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS legal_address jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS payment_terms public.payment_terms;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS credit_limit numeric(14, 2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_category public.client_category;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_subcategory text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS agency_or_direct public.agency_or_direct;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS trade_license_expiry date;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_currency_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_currency_check
  CHECK (currency IN ('USD', 'AED', 'SAR', 'EGP', 'EUR'));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_credit_limit_non_negative;
ALTER TABLE public.clients ADD CONSTRAINT clients_credit_limit_non_negative
  CHECK (credit_limit IS NULL OR credit_limit >= 0);

CREATE INDEX IF NOT EXISTS clients_client_category_idx ON public.clients (client_category);
CREATE INDEX IF NOT EXISTS clients_country_idx ON public.clients (country);
CREATE INDEX IF NOT EXISTS clients_trade_license_expiry_idx ON public.clients (trade_license_expiry);

-- -----------------------------------------------------------------------------
-- Influencers: talent & contract columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS contract_status public.contract_status DEFAULT 'none';
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS contract_expiry date;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS payment_terms public.payment_terms;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS exclusivity public.exclusivity_type DEFAULT 'none';
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS gender public.influencer_gender;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS influencer_url text;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS management_agency text;

CREATE INDEX IF NOT EXISTS influencers_contract_status_idx ON public.influencers (contract_status);
CREATE INDEX IF NOT EXISTS influencers_contract_expiry_idx ON public.influencers (contract_expiry);
CREATE INDEX IF NOT EXISTS influencers_nationality_idx ON public.influencers (nationality);

-- -----------------------------------------------------------------------------
-- Influencer platform accounts (expanded metrics)
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencer_platform_accounts ADD COLUMN IF NOT EXISTS username citext;
ALTER TABLE public.influencer_platform_accounts ADD COLUMN IF NOT EXISTS avg_views bigint NOT NULL DEFAULT 0;
ALTER TABLE public.influencer_platform_accounts ADD COLUMN IF NOT EXISTS audience_country text;
ALTER TABLE public.influencer_platform_accounts ADD COLUMN IF NOT EXISTS audience_gender_split jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.influencer_platform_accounts
SET username = handle
WHERE username IS NULL AND handle IS NOT NULL;

ALTER TABLE public.influencer_platform_accounts DROP CONSTRAINT IF EXISTS influencer_platform_accounts_avg_views_non_negative;
ALTER TABLE public.influencer_platform_accounts ADD CONSTRAINT influencer_platform_accounts_avg_views_non_negative
  CHECK (avg_views >= 0);

CREATE INDEX IF NOT EXISTS influencer_platform_accounts_platform_idx
  ON public.influencer_platform_accounts (platform);

-- -----------------------------------------------------------------------------
-- Client documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  document_type public.client_document_type NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  expires_at date,
  notes text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS client_documents_client_id_idx ON public.client_documents (client_id);
CREATE INDEX IF NOT EXISTS client_documents_document_type_idx ON public.client_documents (document_type);

-- -----------------------------------------------------------------------------
-- Influencer documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.influencer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  document_type public.influencer_document_type NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  file_size bigint,
  expires_at date,
  notes text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS influencer_documents_influencer_id_idx ON public.influencer_documents (influencer_id);
CREATE INDEX IF NOT EXISTS influencer_documents_document_type_idx ON public.influencer_documents (document_type);

-- -----------------------------------------------------------------------------
-- updated_at triggers for document tables
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_client_documents_updated_at ON public.client_documents;
CREATE TRIGGER set_client_documents_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_influencer_documents_updated_at ON public.influencer_documents;
CREATE TRIGGER set_influencer_documents_updated_at
  BEFORE UPDATE ON public.influencer_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_documents_select ON public.client_documents;
CREATE POLICY client_documents_select ON public.client_documents
  FOR SELECT TO authenticated
  USING (
    public.has_permission('clients.read')
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS client_documents_write ON public.client_documents;
CREATE POLICY client_documents_write ON public.client_documents
  FOR ALL TO authenticated
  USING (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS influencer_documents_select ON public.influencer_documents;
CREATE POLICY influencer_documents_select ON public.influencer_documents
  FOR SELECT TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(influencer_id)
  );

DROP POLICY IF EXISTS influencer_documents_write ON public.influencer_documents;
CREATE POLICY influencer_documents_write ON public.influencer_documents
  FOR ALL TO authenticated
  USING (
    public.has_permission('influencers.write')
    AND public.can_access_influencer(influencer_id)
  )
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.can_access_influencer(influencer_id)
  );

-- -----------------------------------------------------------------------------
-- Storage buckets (private)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'influencer-documents',
  'influencer-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
