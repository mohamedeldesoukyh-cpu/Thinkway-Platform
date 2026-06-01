-- Campaign Billing & Finance Operations Engine
-- Idempotent migration aligned with THINKWAY_SYSTEM_REFERENCE.md

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'campaign_line_billing_status') THEN
    CREATE TYPE public.campaign_line_billing_status AS ENUM (
      'draft',
      'approved',
      'moved_to_billing',
      'invoiced',
      'partially_paid',
      'paid',
      'closed'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'collection_status') THEN
    CREATE TYPE public.collection_status AS ENUM (
      'pending',
      'partial',
      'collected',
      'overdue',
      'written_off'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'vendor_payment_status') THEN
    CREATE TYPE public.vendor_payment_status AS ENUM (
      'unpaid',
      'pending',
      'paid',
      'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'financial_approval_stage') THEN
    CREATE TYPE public.financial_approval_stage AS ENUM (
      'campaign_manager',
      'finance',
      'cfo_admin'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Campaign line billing lifecycle
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS billing_status public.campaign_line_billing_status NOT NULL DEFAULT 'draft';

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS revenue_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS cost_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS vendor_assignment_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices (id) ON DELETE SET NULL;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS po_consumed numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS finance_override_until timestamptz;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS billing_moved_at timestamptz;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS billing_invoiced_at timestamptz;

CREATE INDEX IF NOT EXISTS campaign_lines_billing_status_idx
  ON public.campaign_lines (billing_status);

CREATE INDEX IF NOT EXISTS campaign_lines_invoice_id_idx
  ON public.campaign_lines (invoice_id);

-- Sync po_consumed from cost
CREATE OR REPLACE FUNCTION public.sync_campaign_line_po_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.po_consumed := COALESCE(NEW.cost, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_campaign_line_po_consumed ON public.campaign_lines;
CREATE TRIGGER sync_campaign_line_po_consumed
  BEFORE INSERT OR UPDATE OF cost ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_line_po_consumed();

-- Billing lock enforcement
CREATE OR REPLACE FUNCTION public.enforce_campaign_line_billing_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_override_active boolean;
BEGIN
  v_override_active := NEW.finance_override_until IS NOT NULL
    AND NEW.finance_override_until > timezone('utc', now());

  IF OLD.revenue_locked AND NEW.revenue IS DISTINCT FROM OLD.revenue AND NOT v_override_active THEN
    RAISE EXCEPTION 'Revenue is locked on invoiced line %. Finance override required.', OLD.document_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.cost_locked AND NEW.cost IS DISTINCT FROM OLD.cost AND NOT v_override_active THEN
    RAISE EXCEPTION 'Cost is locked on line %. Finance override required.', OLD.document_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_campaign_line_billing_lock ON public.campaign_lines;
CREATE TRIGGER enforce_campaign_line_billing_lock
  BEFORE UPDATE ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_line_billing_lock();

DROP TRIGGER IF EXISTS audit_campaign_lines ON public.campaign_lines;
CREATE TRIGGER audit_campaign_lines
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- -----------------------------------------------------------------------------
-- Invoices: year-based numbering INV-YYYY-NNNNN
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS collection_status public.collection_status NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS invoices_campaign_header_id_idx
  ON public.invoices (campaign_header_id);

CREATE OR REPLACE FUNCTION public.assign_invoice_year_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := 'INV-' || v_year;
  v_next bigint;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    INSERT INTO public.document_sequences AS ds (prefix, last_value)
    VALUES (v_prefix, 1)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = ds.last_value + 1
    RETURNING last_value INTO v_next;

    NEW.document_number := v_prefix || '-' || lpad(v_next::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_invoices_document_number ON public.invoices;
CREATE TRIGGER assign_invoices_document_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_year_document_number();

-- Invoice line items ← campaign lines (invoice_lines alias view)
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS campaign_line_id uuid REFERENCES public.campaign_lines (id) ON DELETE SET NULL;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoice_line_items_campaign_line_id_idx
  ON public.invoice_line_items (campaign_line_id);

DROP VIEW IF EXISTS public.invoice_lines;
CREATE VIEW public.invoice_lines AS
SELECT
  ili.id,
  ili.invoice_id,
  ili.campaign_line_id,
  ili.campaign_header_id,
  ili.campaign_id,
  ili.sort_order,
  ili.description,
  ili.quantity,
  ili.unit_price,
  ili.line_total,
  ili.deliverable_id,
  ili.metadata,
  ili.created_at,
  ili.updated_at
FROM public.invoice_line_items ili;

-- Collection status sync on invoice payment changes
CREATE OR REPLACE FUNCTION public.sync_invoice_collection_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
  v_due date;
  v_status public.invoice_status;
BEGIN
  SELECT total, amount_paid, due_date, status
  INTO v_total, v_paid, v_due, v_status
  FROM public.invoices
  WHERE id = COALESCE(NEW.id, OLD.id);

  IF v_status = 'void' THEN
    UPDATE public.invoices SET collection_status = 'written_off' WHERE id = COALESCE(NEW.id, OLD.id);
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.invoices
  SET collection_status = CASE
    WHEN v_paid >= v_total AND v_total > 0 THEN 'collected'::public.collection_status
    WHEN v_paid > 0 THEN 'partial'::public.collection_status
    WHEN v_due IS NOT NULL AND v_due < CURRENT_DATE THEN 'overdue'::public.collection_status
    ELSE 'pending'::public.collection_status
  END
  WHERE id = COALESCE(NEW.id, OLD.id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_invoice_collection_status ON public.invoices;
CREATE TRIGGER sync_invoice_collection_status
  AFTER INSERT OR UPDATE OF total, amount_paid, due_date, status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_collection_status();

-- Sync campaign line billing status when invoice payment changes
CREATE OR REPLACE FUNCTION public.sync_campaign_line_billing_from_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
  v_line_status public.campaign_line_billing_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT total, amount_paid INTO v_total, v_paid
  FROM public.invoices WHERE id = v_invoice_id;

  v_line_status := CASE
    WHEN v_paid >= v_total AND v_total > 0 THEN 'paid'::public.campaign_line_billing_status
    WHEN v_paid > 0 THEN 'partially_paid'::public.campaign_line_billing_status
    ELSE 'invoiced'::public.campaign_line_billing_status
  END;

  UPDATE public.campaign_lines
  SET billing_status = v_line_status
  WHERE invoice_id = v_invoice_id
    AND billing_status IN ('invoiced', 'partially_paid', 'paid');

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_campaign_line_billing_from_invoice ON public.payments;
CREATE TRIGGER sync_campaign_line_billing_from_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_line_billing_from_invoice();

-- -----------------------------------------------------------------------------
-- Vendor payment batches
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  batch_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(14, 2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'USD',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vendor_payment_batches_currency_check CHECK (char_length(currency) = 3)
);

CREATE INDEX IF NOT EXISTS vendor_payment_batches_status_idx
  ON public.vendor_payment_batches (status);

DROP TRIGGER IF EXISTS assign_vendor_payment_batches_document_number ON public.vendor_payment_batches;
CREATE TRIGGER assign_vendor_payment_batches_document_number
  BEFORE INSERT ON public.vendor_payment_batches
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('VPB');

DROP TRIGGER IF EXISTS set_vendor_payment_batches_updated_at ON public.vendor_payment_batches;
CREATE TRIGGER set_vendor_payment_batches_updated_at
  BEFORE UPDATE ON public.vendor_payment_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS vendor_payment_status public.vendor_payment_status NOT NULL DEFAULT 'unpaid';

ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS vendor_paid_at timestamptz;

ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS payment_batch_id uuid REFERENCES public.vendor_payment_batches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_influencers_vendor_payment_status_idx
  ON public.campaign_influencers (vendor_payment_status);

-- -----------------------------------------------------------------------------
-- Financial approval chain
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  approval_stage public.financial_approval_stage NOT NULL,
  chain_order integer NOT NULL DEFAULT 1,
  status public.approval_status NOT NULL DEFAULT 'pending',
  title text NOT NULL,
  description text,
  requested_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS financial_approval_requests_entity_idx
  ON public.financial_approval_requests (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS financial_approval_requests_status_idx
  ON public.financial_approval_requests (status);

DROP TRIGGER IF EXISTS assign_financial_approval_requests_document_number ON public.financial_approval_requests;
CREATE TRIGGER assign_financial_approval_requests_document_number
  BEFORE INSERT ON public.financial_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('FAR');

DROP TRIGGER IF EXISTS set_financial_approval_requests_updated_at ON public.financial_approval_requests;
CREATE TRIGGER set_financial_approval_requests_updated_at
  BEFORE UPDATE ON public.financial_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS audit_financial_approval_requests ON public.financial_approval_requests;
CREATE TRIGGER audit_financial_approval_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.financial_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- RLS
ALTER TABLE public.vendor_payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payment_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.financial_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_approval_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_payment_batches_select ON public.vendor_payment_batches;
CREATE POLICY vendor_payment_batches_select ON public.vendor_payment_batches
  FOR SELECT TO authenticated
  USING (public.has_permission('payments.read'));

DROP POLICY IF EXISTS vendor_payment_batches_write ON public.vendor_payment_batches;
CREATE POLICY vendor_payment_batches_write ON public.vendor_payment_batches
  FOR ALL TO authenticated
  USING (public.has_permission('payments.write'))
  WITH CHECK (public.has_permission('payments.write'));

DROP POLICY IF EXISTS financial_approval_requests_select ON public.financial_approval_requests;
CREATE POLICY financial_approval_requests_select ON public.financial_approval_requests
  FOR SELECT TO authenticated
  USING (public.has_permission('invoices.read') OR public.has_permission('approvals.read'));

DROP POLICY IF EXISTS financial_approval_requests_write ON public.financial_approval_requests;
CREATE POLICY financial_approval_requests_write ON public.financial_approval_requests
  FOR ALL TO authenticated
  USING (public.has_permission('invoices.write') OR public.has_permission('approvals.write'))
  WITH CHECK (public.has_permission('invoices.write') OR public.has_permission('approvals.write'));

-- Backfill po_consumed
UPDATE public.campaign_lines SET po_consumed = cost WHERE po_consumed = 0 AND cost > 0;
