-- Security audit 2026-11-02: default Supabase grants left anonymous access
-- on internal SECURITY DEFINER functions, even after PUBLIC was revoked.
-- Revoke BOTH PUBLIC and anon; preserve owner/trigger and service-role calls.
BEGIN;

-- IO downloads already use authenticated or expiring signed URLs.
UPDATE storage.buckets SET public = false WHERE id = 'vendor-io-documents';
REVOKE EXECUTE ON FUNCTION public.apply_campaign_advances(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_campaign_advances(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.generate_quotation_serial(timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_quotation_serial(timestamp with time zone) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_document_number(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(text, integer) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(uuid) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_invoice_line_item_duplicates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_invoice_line_item_duplicates(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.repair_invoice_sequence_for_year(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_invoice_sequence_for_year(integer, boolean) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.reseed_invoice_document_sequences(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseed_invoice_document_sequences(integer, boolean) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.reseed_quotation_document_sequences(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reseed_quotation_document_sequences(integer, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reseed_thinkway_campaign_sequence(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reseed_thinkway_campaign_sequence(integer, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.send_client_io(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_client_io(uuid, uuid) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_vendor_io(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_vendor_io(uuid, uuid) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_collection_advance_internal(uuid, uuid, numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_collection_advance_internal(uuid, uuid, numeric, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.update_unpaid_vendor_cost(uuid, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_unpaid_vendor_cost(uuid, numeric, numeric, numeric) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.send_client_io(p_client_io_id uuid, p_actor_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.has_permission('client_ios.write'))
       OR NOT EXISTS (SELECT 1 FROM public.client_ios io WHERE io.id = p_client_io_id AND public.can_access_campaign_header(io.campaign_header_id)) THEN
      RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
    END IF;
    IF p_actor_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Actor must match the authenticated user' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_token := public.generate_io_approval_token();

  UPDATE public.client_ios
  SET
    status = 'under_client_review',
    sent_at = COALESCE(sent_at, timezone('utc', now())),
    approval_token_hash = public.hash_io_approval_token(v_token),
    approval_token_expires_at = timezone('utc', now()) + interval '14 days',
    updated_by = p_actor_id,
    updated_at = timezone('utc', now())
  WHERE id = p_client_io_id
    AND is_superseded = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client IO not found or superseded.';
  END IF;

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
    jsonb_build_object(
      'by', p_actor_id,
      'sent_at', timezone('utc', now()),
      'status', 'under_client_review'
    )
  );

  RETURN v_token;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_vendor_io(p_vendor_io_id uuid, p_actor_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR (public.has_permission('vendor_ios.write') OR public.has_permission('influencers.write')))
       OR NOT EXISTS (SELECT 1 FROM public.vendor_ios io WHERE io.id = p_vendor_io_id AND public.can_access_campaign_header(io.campaign_header_id)) THEN
      RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
    END IF;
    IF p_actor_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Actor must match the authenticated user' USING ERRCODE = '42501';
    END IF;
  END IF;

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
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
  v_exempt boolean;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND
     (auth.uid() IS NULL OR NOT public.can_write_invoice_line_items(p_invoice_id)) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(SUM(revenue_before_vat), 0),
    COALESCE(SUM(revenue_vat_amount), 0),
    BOOL_AND(COALESCE(revenue_vat_exempt, false))
  INTO v_subtotal, v_tax, v_exempt
  FROM public.invoice_line_items
  WHERE invoice_id = p_invoice_id;

  v_total := v_subtotal + v_tax;

  UPDATE public.invoices
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = v_total,
    revenue_before_vat = v_subtotal,
    revenue_vat_amount = v_tax,
    revenue_after_vat = v_total,
    revenue_vat_exempt = COALESCE(v_exempt, false),
    updated_at = timezone('utc', now())
  WHERE id = p_invoice_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.repair_invoice_sequence_for_year(p_year integer, p_dry_run boolean DEFAULT true)
 RETURNS TABLE(year integer, invoice_id uuid, old_document_number text, new_document_number text, renumbered integer, previous_max_serial bigint, new_max_serial bigint, next_serial bigint, applied boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_prefix text := 'INV-' || p_year::text;
  v_prev_max bigint;
  v_count integer := 0;
  v_serial integer := 0;
  v_invoice record;
  v_old_number text;
  v_new_number text;
  v_temp_number text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND
     (auth.uid() IS NULL OR NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Administrator permission required' USING ERRCODE = '42501';
  END IF;

  v_prev_max := public.max_invoice_serial(p_year);

  IF NOT p_dry_run THEN
    -- Archive void invoice numbers so active rows can compact to 1..N.
    UPDATE public.invoices i
    SET
      document_number = v_prefix || '-void-' || replace(i.id::text, '-', ''),
      updated_at = timezone('utc', now())
    WHERE coalesce(i.status, 'draft') = 'void'
      AND i.document_number ~ ('^' || v_prefix || '-\d+$');

    UPDATE public.finance_documents fd
    SET
      document_number = v_prefix || '-void-' || replace(fd.source_id::text, '-', ''),
      updated_at = timezone('utc', now())
    WHERE fd.source_table = 'invoices'
      AND fd.document_number ~ ('^' || v_prefix || '-\d+$')
      AND EXISTS (
        SELECT 1
        FROM public.invoices i
        WHERE i.id = fd.source_id
          AND coalesce(i.status, 'draft') = 'void'
      );

    FOR v_invoice IN
      SELECT i.id, i.document_number, i.created_at
      FROM public.invoices i
      WHERE i.document_number ~ ('^' || v_prefix || '-\d+$')
        AND coalesce(i.status, 'draft') <> 'void'
      ORDER BY i.created_at ASC, i.id ASC
    LOOP
      v_temp_number := v_prefix || '-renum-' || replace(v_invoice.id::text, '-', '');
      UPDATE public.invoices
      SET document_number = v_temp_number
      WHERE id = v_invoice.id;

      UPDATE public.finance_documents fd
      SET document_number = v_temp_number,
          updated_at = timezone('utc', now())
      WHERE fd.source_table = 'invoices'
        AND fd.source_id = v_invoice.id;
    END LOOP;
  END IF;

  FOR v_invoice IN
    SELECT i.id, i.document_number, i.created_at
    FROM public.invoices i
    WHERE (
      p_dry_run AND i.document_number ~ ('^' || v_prefix || '-\d+$')
      OR NOT p_dry_run AND i.document_number ~ ('^' || v_prefix || '-renum-[a-f0-9]+$')
    )
      AND coalesce(i.status, 'draft') <> 'void'
    ORDER BY i.created_at ASC, i.id ASC
  LOOP
    v_serial := v_serial + 1;
    v_old_number := v_invoice.document_number;
    v_new_number := v_prefix || '-' || v_serial::text;

    IF NOT p_dry_run THEN
      UPDATE public.invoices
      SET document_number = v_new_number
      WHERE id = v_invoice.id;

      UPDATE public.finance_documents fd
      SET document_number = v_new_number,
          updated_at = timezone('utc', now())
      WHERE fd.source_table = 'invoices'
        AND fd.source_id = v_invoice.id;

      v_count := v_count + 1;
    END IF;

    year := p_year;
    invoice_id := v_invoice.id;
    old_document_number := v_old_number;
    new_document_number := v_new_number;
    renumbered := 1;
    previous_max_serial := v_prev_max;
    new_max_serial := v_serial;
    next_serial := v_serial + 1;
    applied := NOT p_dry_run;
    RETURN NEXT;
  END LOOP;

  IF v_serial = 0 THEN
    year := p_year;
    invoice_id := NULL;
    old_document_number := NULL;
    new_document_number := NULL;
    renumbered := 0;
    previous_max_serial := v_prev_max;
    new_max_serial := 0;
    next_serial := 1;
    applied := false;
    RETURN NEXT;
  END IF;

  IF NOT p_dry_run THEN
    INSERT INTO public.document_sequences (prefix, last_value)
    VALUES (v_prefix, GREATEST(v_serial, 0))
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = EXCLUDED.last_value,
          updated_at = timezone('utc', now());
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.next_document_number(p_prefix text, p_padding integer DEFAULT 6)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next bigint;
BEGIN
  -- Invoker triggers need this helper; restrict browser callers to internal staff.
  IF auth.role() = 'authenticated' AND (auth.uid() IS NULL OR NOT public.is_internal_user()) THEN
    RAISE EXCEPTION 'Internal user required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.document_sequences AS ds (prefix, last_value)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = ds.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN p_prefix || '-' || lpad(v_next::text, p_padding, '0');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reseed_invoice_document_sequences(p_year integer DEFAULT NULL::integer, p_dry_run boolean DEFAULT true)
 RETURNS TABLE(year integer, prefix text, previous_last_value bigint, new_last_value bigint, max_existing_serial bigint, next_serial bigint, surviving_invoices bigint, applied boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_year integer;
  v_prefix text;
  v_max bigint;
  v_prev bigint;
  v_survivors bigint;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND
     (auth.uid() IS NULL OR NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Administrator permission required' USING ERRCODE = '42501';
  END IF;

  FOR v_year IN
    SELECT DISTINCT y
    FROM (
      SELECT (regexp_match(ds.prefix, '^INV-(\d{4})$'))[1]::integer AS y
      FROM public.document_sequences ds
      WHERE ds.prefix ~ '^INV-\d{4}$'
      UNION
      SELECT (regexp_match(i.document_number, '^INV-(\d{4})-\d+$'))[1]::integer AS y
      FROM public.invoices i
      WHERE i.document_number ~ '^INV-\d{4}-\d+$'
    ) years
    WHERE y IS NOT NULL
      AND (p_year IS NULL OR y = p_year)
    ORDER BY y
  LOOP
    v_prefix := 'INV-' || v_year::text;
    v_max := public.max_invoice_serial(v_year);

    SELECT ds.last_value INTO v_prev
    FROM public.document_sequences ds
    WHERE ds.prefix = v_prefix;

    v_prev := coalesce(v_prev, 0);

    SELECT count(*) INTO v_survivors
    FROM public.invoices i
    WHERE i.document_number ~ ('^INV-' || v_year::text || '-\d+$');

    year := v_year;
    prefix := v_prefix;
    previous_last_value := v_prev;
    new_last_value := v_max;
    max_existing_serial := v_max;
    next_serial := v_max + 1;
    surviving_invoices := v_survivors;
    applied := false;

    IF NOT p_dry_run AND v_prev IS DISTINCT FROM v_max THEN
      INSERT INTO public.document_sequences (prefix, last_value)
      VALUES (v_prefix, v_max)
      ON CONFLICT (prefix) DO UPDATE
        SET last_value = EXCLUDED.last_value,
            updated_at = timezone('utc', now());
      applied := true;
    ELSIF NOT p_dry_run AND v_prev = v_max THEN
      applied := true;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$function$
;
COMMIT;
