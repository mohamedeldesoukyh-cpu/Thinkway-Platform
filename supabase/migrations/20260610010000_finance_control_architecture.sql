-- Finance Control Architecture: CN/DN, posting batches, ERP sync, document registry.
-- Non-negotiable: no hard deletes; void/cancel/reverse only; serial continuity preserved.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'finance_document_kind'
  ) THEN
    CREATE TYPE public.finance_document_kind AS ENUM (
      'client_invoice',
      'vendor_io',
      'client_credit_note',
      'vendor_credit_note',
      'client_debit_note',
      'vendor_debit_note'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'finance_adjustment_status'
  ) THEN
    CREATE TYPE public.finance_adjustment_status AS ENUM (
      'draft',
      'approved',
      'posted',
      'cancelled',
      'void',
      'pending_repost'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'finance_posting_batch_status'
  ) THEN
    CREATE TYPE public.finance_posting_batch_status AS ENUM (
      'draft',
      'posted',
      'reversed',
      'failed'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'erp_sync_status'
  ) THEN
    CREATE TYPE public.erp_sync_status AS ENUM (
      'queued',
      'sent',
      'acknowledged',
      'failed',
      'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'finance_document_link_type'
  ) THEN
    CREATE TYPE public.finance_document_link_type AS ENUM (
      'adjustment_to_invoice',
      'adjustment_to_vendor_io',
      'payment_to_invoice',
      'posting_batch',
      'reversal_of'
    );
  END IF;
END $$;

-- Year-based serial assignment (prefix e.g. CCN-2026)
CREATE OR REPLACE FUNCTION public.assign_finance_year_document_number(p_prefix text)
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_full_prefix text := p_prefix || '-' || v_year;
  v_next bigint;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    INSERT INTO public.document_sequences AS ds (prefix, last_value)
    VALUES (v_full_prefix, 1)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = ds.last_value + 1
    RETURNING last_value INTO v_next;

    NEW.document_number := v_full_prefix || '-' || lpad(v_next::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Unified finance document registry (subledger index; never delete rows)
CREATE TABLE IF NOT EXISTS public.finance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_kind public.finance_document_kind NOT NULL,
  document_number text NOT NULL UNIQUE,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE RESTRICT,
  vendor_id uuid REFERENCES public.influencers (id) ON DELETE RESTRICT,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  amount_before_vat numeric(14, 2) NOT NULL DEFAULT 0,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  posted_at timestamptz,
  posting_batch_id uuid,
  cancelled_at timestamptz,
  voided_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT finance_documents_currency_check CHECK (char_length(currency) = 3),
  CONSTRAINT finance_documents_amounts_non_negative CHECK (
    amount_before_vat >= 0 AND vat_amount >= 0 AND amount_after_vat >= 0
  )
);

CREATE INDEX IF NOT EXISTS finance_documents_kind_idx ON public.finance_documents (document_kind);
CREATE INDEX IF NOT EXISTS finance_documents_status_idx ON public.finance_documents (status);
CREATE INDEX IF NOT EXISTS finance_documents_campaign_header_id_idx
  ON public.finance_documents (campaign_header_id);
CREATE INDEX IF NOT EXISTS finance_documents_client_id_idx ON public.finance_documents (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS finance_documents_source_unique_idx
  ON public.finance_documents (source_table, source_id);

CREATE TABLE IF NOT EXISTS public.finance_posting_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  transaction_type public.finance_document_kind NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  legal_entity_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  currency char(3),
  status public.finance_posting_batch_status NOT NULL DEFAULT 'draft',
  document_count integer NOT NULL DEFAULT 0,
  total_before_vat numeric(14, 2) NOT NULL DEFAULT 0,
  total_vat numeric(14, 2) NOT NULL DEFAULT 0,
  total_after_vat numeric(14, 2) NOT NULL DEFAULT 0,
  posted_at timestamptz,
  reversed_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS finance_posting_batches_status_idx
  ON public.finance_posting_batches (status);
CREATE INDEX IF NOT EXISTS finance_posting_batches_period_idx
  ON public.finance_posting_batches (period_from, period_to);

DROP TRIGGER IF EXISTS assign_finance_posting_batches_document_number ON public.finance_posting_batches;
CREATE TRIGGER assign_finance_posting_batches_document_number
  BEFORE INSERT ON public.finance_posting_batches
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('FPB');

CREATE TABLE IF NOT EXISTS public.erp_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_batch_id uuid REFERENCES public.finance_posting_batches (id) ON DELETE SET NULL,
  finance_document_id uuid REFERENCES public.finance_documents (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.erp_sync_status NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  queued_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS erp_sync_queue_status_idx ON public.erp_sync_queue (status);
CREATE INDEX IF NOT EXISTS erp_sync_queue_posting_batch_id_idx
  ON public.erp_sync_queue (posting_batch_id);

CREATE TABLE IF NOT EXISTS public.finance_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_type public.finance_document_link_type NOT NULL,
  source_document_id uuid NOT NULL REFERENCES public.finance_documents (id) ON DELETE RESTRICT,
  target_document_id uuid NOT NULL REFERENCES public.finance_documents (id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT finance_document_links_distinct CHECK (source_document_id <> target_document_id)
);

CREATE INDEX IF NOT EXISTS finance_document_links_source_idx
  ON public.finance_document_links (source_document_id);
CREATE INDEX IF NOT EXISTS finance_document_links_target_idx
  ON public.finance_document_links (target_document_id);

-- Shared adjustment columns pattern for CN/DN tables
CREATE TABLE IF NOT EXISTS public.client_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  notes text,
  posting_batch_id uuid REFERENCES public.finance_posting_batches (id) ON DELETE SET NULL,
  posted_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reversed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT client_credit_notes_amounts_positive CHECK (
    amount_before_vat > 0 AND amount_after_vat > 0
  )
);

CREATE INDEX IF NOT EXISTS client_credit_notes_invoice_id_idx
  ON public.client_credit_notes (invoice_id);
CREATE INDEX IF NOT EXISTS client_credit_notes_status_idx
  ON public.client_credit_notes (status);

DROP TRIGGER IF EXISTS assign_client_credit_notes_document_number ON public.client_credit_notes;
CREATE TRIGGER assign_client_credit_notes_document_number
  BEFORE INSERT ON public.client_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.assign_finance_year_document_number('CCN');

CREATE TABLE IF NOT EXISTS public.vendor_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  vendor_io_id uuid REFERENCES public.vendor_ios (id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE RESTRICT,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  notes text,
  posting_batch_id uuid REFERENCES public.finance_posting_batches (id) ON DELETE SET NULL,
  posted_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reversed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vendor_credit_notes_amounts_positive CHECK (
    amount_before_vat > 0 AND amount_after_vat > 0
  )
);

CREATE INDEX IF NOT EXISTS vendor_credit_notes_vendor_io_id_idx
  ON public.vendor_credit_notes (vendor_io_id);
CREATE INDEX IF NOT EXISTS vendor_credit_notes_status_idx
  ON public.vendor_credit_notes (status);

DROP TRIGGER IF EXISTS assign_vendor_credit_notes_document_number ON public.vendor_credit_notes;
CREATE TRIGGER assign_vendor_credit_notes_document_number
  BEFORE INSERT ON public.vendor_credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.assign_finance_year_document_number('VCN');

CREATE TABLE IF NOT EXISTS public.client_debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  invoice_id uuid REFERENCES public.invoices (id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  notes text,
  posting_batch_id uuid REFERENCES public.finance_posting_batches (id) ON DELETE SET NULL,
  posted_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reversed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT client_debit_notes_amounts_positive CHECK (
    amount_before_vat > 0 AND amount_after_vat > 0
  )
);

CREATE INDEX IF NOT EXISTS client_debit_notes_status_idx ON public.client_debit_notes (status);

DROP TRIGGER IF EXISTS assign_client_debit_notes_document_number ON public.client_debit_notes;
CREATE TRIGGER assign_client_debit_notes_document_number
  BEFORE INSERT ON public.client_debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.assign_finance_year_document_number('CDN');

CREATE TABLE IF NOT EXISTS public.vendor_debit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  status public.finance_adjustment_status NOT NULL DEFAULT 'draft',
  vendor_io_id uuid REFERENCES public.vendor_ios (id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE RESTRICT,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text NOT NULL,
  amount_before_vat numeric(14, 2) NOT NULL,
  vat_affected boolean NOT NULL DEFAULT true,
  vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  amount_after_vat numeric(14, 2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  notes text,
  posting_batch_id uuid REFERENCES public.finance_posting_batches (id) ON DELETE SET NULL,
  posted_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reversed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vendor_debit_notes_amounts_positive CHECK (
    amount_before_vat > 0 AND amount_after_vat > 0
  )
);

CREATE INDEX IF NOT EXISTS vendor_debit_notes_status_idx ON public.vendor_debit_notes (status);

DROP TRIGGER IF EXISTS assign_vendor_debit_notes_document_number ON public.vendor_debit_notes;
CREATE TRIGGER assign_vendor_debit_notes_document_number
  BEFORE INSERT ON public.vendor_debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.assign_finance_year_document_number('VDN');

ALTER TABLE public.finance_documents
  ADD CONSTRAINT finance_documents_posting_batch_id_fkey
  FOREIGN KEY (posting_batch_id) REFERENCES public.finance_posting_batches (id) ON DELETE SET NULL;

-- RLS (authenticated staff; refine per role matrix in follow-up)
ALTER TABLE public.finance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_posting_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_debit_notes ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_documents',
    'finance_posting_batches',
    'erp_sync_queue',
    'finance_document_links',
    'client_credit_notes',
    'vendor_credit_notes',
    'client_debit_notes',
    'vendor_debit_notes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (true)',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;
