-- Development only. No fixture or financial mutation survives this test.
BEGIN;
DO $$
DECLARE v_header uuid; v_line uuid; v_client uuid; v_invoice uuid; v_item uuid;
  v_rate numeric; v_snapshot jsonb; v_code text; v_user uuid; v_source text; v_target text; v_other_invoice uuid; v_other_item uuid;
BEGIN
  SELECT p.id INTO v_user FROM public.profiles p JOIN public.roles r ON r.id=p.role_id WHERE r.slug='super_admin' LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  SELECT l.id,h.id,h.client_id INTO v_line,v_header,v_client FROM public.campaign_lines l
    JOIN public.campaign_headers h ON h.id=l.campaign_header_id WHERE h.client_id IS NOT NULL LIMIT 1;
  ASSERT v_line IS NOT NULL,'development assignment fixture required';
  UPDATE public.campaign_lines SET currency_code='USD' WHERE id=v_line;
  INSERT INTO public.invoices(client_id,campaign_header_id,currency) VALUES(v_client,v_header,'EGP') RETURNING id INTO v_invoice;
  v_rate:=public.resolve_effective_exchange_rate('USD','EGP',current_date);
  INSERT INTO public.invoice_line_items(invoice_id,campaign_line_id,campaign_header_id,description,quantity,unit_price,revenue_vat_percent,metadata)
    VALUES(v_invoice,v_line,v_header,'FX regression partial',1,40,14,jsonb_build_object('operational_source_amount',40)) RETURNING id INTO v_item;
  ASSERT (SELECT revenue_before_vat=round(40*v_rate,2) AND revenue_vat_amount=round(round(40*v_rate,2)*.14,2)
    FROM public.invoice_line_items WHERE id=v_item),'converted invoice amount and VAT';
  ASSERT (SELECT revenue_before_vat=40 FROM public.invoice_line_items_operational WHERE id=v_item),'coverage stays in USD';
  ASSERT (SELECT subtotal=round(40*v_rate,2) FROM public.invoices WHERE id=v_invoice),'invoice header uses converted subtotal';
  UPDATE public.invoice_line_items SET unit_price=75,revenue_before_vat=75,metadata=jsonb_build_object('operational_source_amount',75) WHERE id=v_item;
  ASSERT (SELECT revenue_before_vat=round(75*v_rate,2) FROM public.invoice_line_items WHERE id=v_item),'append is not double converted';
  ASSERT (SELECT revenue_before_vat=75 FROM public.invoice_line_items_operational WHERE id=v_item),'append native coverage';
  SELECT to_jsonb(i) INTO v_snapshot FROM public.invoice_line_items i WHERE id=v_item;
  FOREACH v_code IN ARRAY ARRAY['USD','AED','EUR','GBP','SAR','EGP'] LOOP
    PERFORM public.set_campaign_display_currency(v_header,v_code);
    ASSERT (SELECT currency_code=v_code FROM public.campaign_headers WHERE id=v_header),'selector saved';
    ASSERT v_snapshot=(SELECT to_jsonb(i) FROM public.invoice_line_items i WHERE id=v_item),'selector leaves invoice snapshot unchanged';
    ASSERT (SELECT abs(h.po_consumed_amount-p.po_consumed)<.01 FROM public.campaign_headers h JOIN public.campaign_fx_po_totals p ON p.campaign_header_id=h.id WHERE h.id=v_header),'stored PO guards use selected currency';
  END LOOP;
  BEGIN
    PERFORM public.set_campaign_display_currency(v_header,'ZZZ');
    RAISE EXCEPTION 'Unsupported currency unexpectedly saved';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Unsupported currency:%' THEN RAISE; END IF;
  END;
  ASSERT (SELECT currency_code='EGP' FROM public.campaign_headers WHERE id=v_header),'failed selector leaves prior value';
  -- Ordinary document edits cannot run conversion a second time.
  UPDATE public.invoice_line_items SET description='Renamed regression line' WHERE id=v_item;
  ASSERT (SELECT revenue_before_vat=round(75*v_rate,2) FROM public.invoice_line_items WHERE id=v_item),'ordinary update preserves converted amount';
  PERFORM public.save_exchange_rate(jsonb_build_object('from_currency','USD','to_currency','EGP',
    'exchange_rate',60,'effective_start_date',current_date,'apply_mode','future'));
  UPDATE public.invoice_line_items SET unit_price=80,revenue_before_vat=80,metadata=jsonb_build_object('operational_source_amount',80) WHERE id=v_item;
  ASSERT (SELECT revenue_before_vat=round(75*v_rate,2)+300 FROM public.invoice_line_items WHERE id=v_item),'append converts only new slice at new rate';
  ASSERT (SELECT revenue_before_vat=80 FROM public.invoice_line_items_operational WHERE id=v_item),'rate change cannot inflate native coverage';
  UPDATE public.invoice_line_items SET unit_price=80,revenue_before_vat=80,metadata=jsonb_build_object('operational_source_amount',80,'operational_fx_refresh',true) WHERE id=v_item;
  ASSERT (SELECT revenue_before_vat=4800 FROM public.invoice_line_items WHERE id=v_item),'authorized regeneration rebuilds at current FX';
  FOREACH v_source IN ARRAY ARRAY['USD','AED','EUR','GBP','SAR','EGP'] LOOP
    UPDATE public.campaign_lines SET currency_code=v_source WHERE id=v_line;
    FOREACH v_target IN ARRAY ARRAY['USD','AED','EUR','GBP','SAR','EGP'] LOOP
      INSERT INTO public.invoices(client_id,campaign_header_id,currency) VALUES(v_client,v_header,v_target) RETURNING id INTO v_other_invoice;
      INSERT INTO public.invoice_line_items(invoice_id,campaign_line_id,campaign_header_id,description,quantity,unit_price,revenue_vat_percent,revenue_vat_exempt,metadata)
        VALUES(v_other_invoice,v_line,v_header,'Cross-currency regression',1,12.34,14,true,jsonb_build_object('operational_source_amount',12.34)) RETURNING id INTO v_other_item;
      ASSERT (SELECT revenue_before_vat=round(12.34*public.resolve_effective_exchange_rate(v_source,v_target,current_date),2) AND revenue_vat_amount=0 FROM public.invoice_line_items WHERE id=v_other_item),'all currency pairs and VAT exemption';
      ASSERT (SELECT revenue_before_vat=12.34 FROM public.invoice_line_items_operational WHERE id=v_other_item),'all pairs native coverage';
    END LOOP;
  END LOOP;
END; $$;
ROLLBACK;
