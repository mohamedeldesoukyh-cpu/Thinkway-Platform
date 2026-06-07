-- Clean-room seed: LIFECYCLE-FINAL-VALIDATION-2026-06-04
-- Steps 1-4 only (campaign → assignment → deliverables → VIO)
-- Invoice lifecycle (5-16) must run via app UI with Finance login.

DO $$
DECLARE
  v_brand_id uuid := '0b7d046c-47ab-428a-bb68-9c273c2ea5e4'; -- Mindshare USD
  v_client_id uuid := '678a75fe-be36-4e8a-9e96-43a580bb0b04';
  v_group_id uuid := '48c12209-27c7-42d0-bb5a-6cdb813ec9e2';
  v_influencer_id uuid := '04628c90-859c-4286-a5e3-f7c05d108746';
  v_actor_id uuid := 'cbeee142-8091-4057-bef8-2f62964e115b';
  v_campaign_id uuid;
  v_line_id uuid;
  v_ci_id uuid;
  v_vio_id uuid;
  v_del1_id uuid;
  v_del2_id uuid;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing
  FROM public.campaign_headers
  WHERE name = 'LIFECYCLE-FINAL-VALIDATION-2026-06-04';

  IF v_existing IS NOT NULL THEN
    DELETE FROM public.invoice_line_items ili
    USING public.invoices i
    WHERE ili.invoice_id = i.id AND i.campaign_header_id = v_existing;

    DELETE FROM public.invoices WHERE campaign_header_id = v_existing;
    DELETE FROM public.vendor_io_lines vil
    USING public.vendor_ios vio
    WHERE vil.vendor_io_id = vio.id AND vio.campaign_header_id = v_existing;
    DELETE FROM public.vendor_ios WHERE campaign_header_id = v_existing;
    DELETE FROM public.assignment_post_schedule ps
    USING public.campaign_lines cl
    WHERE ps.campaign_line_id = cl.id AND cl.campaign_header_id = v_existing;
    DELETE FROM public.assignment_deliverables WHERE campaign_header_id = v_existing;
    DELETE FROM public.campaign_influencers WHERE campaign_header_id = v_existing;
    DELETE FROM public.campaign_lines WHERE campaign_header_id = v_existing;
    DELETE FROM public.campaign_headers WHERE id = v_existing;
  END IF;

  INSERT INTO public.campaign_headers (
    name, brand_id, client_id, group_id, status, currency_code, created_by
  ) VALUES (
    'LIFECYCLE-FINAL-VALIDATION-2026-06-04',
    v_brand_id, v_client_id, v_group_id, 'active', 'USD', v_actor_id
  ) RETURNING id INTO v_campaign_id;

  INSERT INTO public.campaign_lines (
    campaign_header_id, name, status, assignment_status, pricing_mode,
    revenue, revenue_before_vat, revenue_vat_percent, revenue_vat_exempt,
    cost, cost_before_vat, currency_code, metadata, created_by
  ) VALUES (
    v_campaign_id,
    'Amir Youssef — Final Validation',
    'draft', 'assigned', 'per_deliverable',
    2000, 2000, 0, true,
    800, 800, 'USD',
    jsonb_build_object(
      'influencer_assignment', jsonb_build_object(
        'influencer_id', v_influencer_id,
        'influencer_name', 'Amir Youssef',
        'pricing_mode', 'per_deliverable',
        'platforms', jsonb_build_array(
          jsonb_build_object(
            'platform', 'instagram',
            'handle', '@lifecycle-final',
            'deliverables', jsonb_build_array('instagram_reel', 'instagram_story')
          )
        )
      )
    ),
    v_actor_id
  ) RETURNING id INTO v_line_id;

  INSERT INTO public.assignment_deliverables (
    campaign_header_id, campaign_line_id, sort_order, platform, deliverable_type,
    quantity, revenue_before_vat, revenue_vat_percent, revenue_vat_exempt,
    billable_amount, remaining_amount, billing_status
  ) VALUES (
    v_campaign_id, v_line_id, 0, 'instagram', 'instagram_reel', 1, 1000, 0, true, 1000, 1000, 'draft'
  ) RETURNING id INTO v_del1_id;

  INSERT INTO public.assignment_deliverables (
    campaign_header_id, campaign_line_id, sort_order, platform, deliverable_type,
    quantity, revenue_before_vat, revenue_vat_percent, revenue_vat_exempt,
    billable_amount, remaining_amount, billing_status
  ) VALUES (
    v_campaign_id, v_line_id, 1, 'instagram', 'instagram_story', 1, 1000, 0, true, 1000, 1000, 'draft'
  ) RETURNING id INTO v_del2_id;

  INSERT INTO public.campaign_influencers (
    campaign_id, campaign_header_id, campaign_line_id, influencer_id, status,
    agreed_fee, currency, deliverable_count
  ) VALUES (
    v_campaign_id, v_campaign_id, v_line_id, v_influencer_id, 'confirmed', 2000, 'USD', 2
  ) RETURNING id INTO v_ci_id;

  INSERT INTO public.vendor_ios (
    assignment_id, campaign_header_id, influencer_id, amount, currency_code,
    status, terms_text, created_by, updated_by, revision_number
  ) VALUES (
    v_ci_id, v_campaign_id, v_influencer_id, 2000, 'USD',
    'draft', 'Lifecycle final validation VIO', v_actor_id, v_actor_id, 0
  ) RETURNING id INTO v_vio_id;

  INSERT INTO public.vendor_io_lines (vendor_io_id, campaign_line_id)
  VALUES (v_vio_id, v_line_id);

  UPDATE public.campaign_lines
  SET vendor_io_id = v_vio_id,
      operational_status = 'io_generated',
      billing_status = 'moved_to_billing'
  WHERE id = v_line_id;

  UPDATE public.assignment_deliverables
  SET billing_status = 'ready_to_invoice'
  WHERE campaign_line_id = v_line_id;

  RAISE NOTICE 'campaign_id=%', v_campaign_id;
  RAISE NOTICE 'campaign_line_id=%', v_line_id;
  RAISE NOTICE 'deliverable_ids=% %', v_del1_id, v_del2_id;
  RAISE NOTICE 'vendor_io_id=%', v_vio_id;
END $$;

SELECT ch.id, ch.document_number, ch.name, cl.document_number AS line_code, vio.document_number AS vio_code
FROM public.campaign_headers ch
JOIN public.campaign_lines cl ON cl.campaign_header_id = ch.id
LEFT JOIN public.vendor_ios vio ON vio.campaign_header_id = ch.id
WHERE ch.name = 'LIFECYCLE-FINAL-VALIDATION-2026-06-04';
