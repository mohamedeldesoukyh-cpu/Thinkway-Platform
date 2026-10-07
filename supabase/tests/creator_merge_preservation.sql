-- Run against dev inside an enclosing transaction; fixtures always roll back.
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); actor uuid; shortlist uuid; campaign uuid; quotation uuid; version_id_test uuid;
 sa uuid; sb uuid; ca uuid; cb uuid; qa uuid; qb uuid; va uuid; vb uuid; ra uuid; rb uuid; snapshot_a jsonb; snapshot_b jsonb; c uuid:=gen_random_uuid(); cc uuid; vc uuid;
begin
 select id into actor from public.profiles limit 1;
 select id into shortlist from public.discovery_shortlists limit 1;
 select id into campaign from public.campaign_headers limit 1;
 select id into quotation from public.quotations limit 1;
 select id into version_id_test from public.rate_card_versions limit 1;
 if actor is null or shortlist is null or campaign is null or quotation is null or version_id_test is null then raise exception 'Dev fixture parent records missing';end if;
 insert into public.influencers(id,display_name,document_number) values(a,'Merge test keep','MERGE-TEST-'||a::text),(b,'Merge test source','MERGE-TEST-'||b::text);
 insert into public.discovery_shortlist_items(shortlist_id,influencer_id,cost,notes) values(shortlist,a,100,'Keep original job') returning id into sa;
 insert into public.discovery_shortlist_items(shortlist_id,influencer_id,cost,notes) values(shortlist,b,200,'Keep source job') returning id into sb;
 insert into public.campaign_influencers(campaign_id,campaign_header_id,influencer_id,source_shortlist_item_id,shortlist_assignment_status,agreed_fee) values(campaign,campaign,a,sa,'suggested',100) returning id into ca;
 insert into public.campaign_influencers(campaign_id,campaign_header_id,influencer_id,source_shortlist_item_id,shortlist_assignment_status,agreed_fee) values(campaign,campaign,b,sb,'suggested',200) returning id into cb;
 insert into public.quotation_items(quotation_id,influencer_id,source_shortlist_item_id) values(quotation,a,sa) returning id into qa;
 insert into public.quotation_items(quotation_id,influencer_id,source_shortlist_item_id) values(quotation,b,sb) returning id into qb;
 insert into public.vendor_ios(campaign_header_id,influencer_id,assignment_id,document_number) values(campaign,a,ca,'MERGE-TEST-'||a::text) returning id into va;
 insert into public.vendor_ios(campaign_header_id,influencer_id,assignment_id,document_number) values(campaign,b,cb,'MERGE-TEST-'||b::text) returning id into vb;
 insert into public.creator_dna_versions(influencer_id,version,document) values(a,1,'{"keep":true}'),(b,1,'{"source":true}'),(b,2,'{"source_later":true}');
 insert into public.rate_card_lines(version_id,influencer_id,creator_name,platform,deliverable,price_type,amount,currency) values(version_id_test,a,'Merge test keep','instagram','reel','creator_cost',100,'EGP') returning id into ra;
 insert into public.rate_card_lines(version_id,influencer_id,creator_name,platform,deliverable,price_type,amount,currency) values(version_id_test,b,'Merge test source','instagram','reel','creator_cost',200,'EGP') returning id into rb;
 begin
  perform public.combine_creator_records(a,b,actor,'{}');
  raise exception 'TEST: price conflict did not block';
 exception when raise_exception then
  if sqlerrm like 'TEST:%' then raise;end if;
  if sqlerrm not like 'Both creators have prices%' then raise;end if;
 end;
 if not exists(select 1 from public.influencers where id=b) or not exists(select 1 from public.campaign_influencers where id=cb and influencer_id=b) then raise exception 'Failed merge did not roll back';end if;
 select to_jsonb(x) into snapshot_a from public.rate_card_lines x where id=ra;
 select to_jsonb(x) into snapshot_b from public.rate_card_lines x where id=rb;
 begin
  perform public.resolve_creator_merge_rates(a,b,actor,jsonb_build_array(jsonb_build_object('keep',snapshot_a||'{"amount":999}', 'remove',snapshot_b)));
  raise exception 'TEST: stale comparison accepted';
 exception when raise_exception then
  if sqlerrm like 'TEST:%' then raise;end if;
  if sqlerrm not like 'Prices changed%' then raise;end if;
 end;
 if not exists(select 1 from public.rate_card_lines where id=rb) then raise exception 'Stale choice deleted a rate';end if;
 perform public.resolve_creator_merge_rates(a,b,actor,jsonb_build_array(jsonb_build_object('keep',snapshot_b,'remove',snapshot_a)));
 perform public.combine_creator_records(a,b,actor,'{}');
 if exists(select 1 from public.influencers where id=b) then raise exception 'Duplicate profile remains';end if;
 if (select count(*) from public.discovery_shortlist_items where id in(sa,sb) and influencer_id=a)<>2 then raise exception 'Shortlist jobs were lost';end if;
 if not exists(select 1 from public.discovery_shortlist_items where id=sb and cost=200 and notes='Keep source job') then raise exception 'Shortlist commercial details changed';end if;
 if (select count(*) from public.campaign_influencers where id in(ca,cb) and influencer_id=a)<>2 then raise exception 'Campaign assignments were lost';end if;
 if (select count(*) from public.quotation_items where id in(qa,qb) and influencer_id=a)<>2 then raise exception 'Quotation lines were lost';end if;
 if (select count(*) from public.vendor_ios where id in(va,vb) and influencer_id=a and is_superseded=false)<>2 then raise exception 'IOs were lost or superseded';end if;
 if not exists(select 1 from public.rate_card_lines where id=rb and influencer_id=a and amount=200) then raise exception 'Chosen rate was lost';end if;
 if (select count(*) from public.creator_dna_versions where influencer_id=a)<>3 then raise exception 'DNA history lost';end if;
 insert into public.influencers(id,display_name,document_number) values(c,'Cancelled IO merge test','MERGE-TEST-'||c::text);
 insert into public.campaign_influencers(campaign_id,campaign_header_id,influencer_id) values(campaign,campaign,c) returning id into cc;
 insert into public.vendor_ios(campaign_header_id,influencer_id,assignment_id,document_number) values(campaign,c,cc,'MERGE-TEST-'||c::text) returning id into vc;
 update public.vendor_ios set status='cancelled' where id=vc;
 perform public.combine_creator_records(a,c,actor,'{}');
 if not exists(select 1 from public.vendor_ios where id=vc and influencer_id=a and status='cancelled') then raise exception 'Cancelled IO history was not transferred';end if;
 if has_function_privilege('authenticated','public.combine_creator_records(uuid,uuid,uuid,jsonb)','execute') or has_function_privilege('authenticated','public.resolve_creator_merge_rates(uuid,uuid,uuid,jsonb)','execute') then raise exception 'Unauthorised direct merge execution allowed';end if;
 raise notice 'PASS: overlapping priced shortlists, campaigns, quotations, active IOs, rates and DNA versions preserved; stale writes and failed merges rolled back';
end $$;
