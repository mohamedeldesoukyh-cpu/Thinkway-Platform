-- PostgREST cannot choose between the 3-arg and 4-arg overloads when both
-- share defaulted named parameters. Keep only the 4-arg CRM-aware function.

DROP FUNCTION IF EXISTS public.vendor_list_total_count(text, text, text);

COMMENT ON FUNCTION public.vendor_list_total_count(text, text, text, boolean) IS
  'Vendor list total count with optional commercial-CRM-only filter (p_crm_only).';
