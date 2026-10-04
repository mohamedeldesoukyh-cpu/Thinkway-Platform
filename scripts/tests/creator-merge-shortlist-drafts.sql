BEGIN;
DO $$
declare target_id uuid; source_id uuid; list_id uuid:=gen_random_uuid(); target_item uuid:=gen_random_uuid(); source_item uuid:=gen_random_uuid(); actor uuid; result integer; quote_id uuid; assignment_id uuid; platform_a uuid:=gen_random_uuid(); platform_b uuid:=gen_random_uuid();
begin
 select id into target_id from influencers order by id limit 1;
 select id into source_id from influencers where id<>target_id order by id limit 1;
 select id into actor from auth.users limit 1;
 insert into discovery_shortlists(id,name,owner_id) select list_id,'Merge rollback QA',owner_id from discovery_shortlists limit 1;
 insert into discovery_shortlist_items(id,shortlist_id,influencer_id,unified_id,item_status,deliverables,platform_account_ids) values
 (target_item,list_id,target_id,'inf:'||target_id::text,'draft','[]','{}'),
 (source_item,list_id,source_id,'inf:'||source_id::text,'draft','[]','{}');
 update discovery_shortlist_items set platform_account_ids=array[platform_a] where id=target_item;
 update discovery_shortlist_items set platform_account_ids=array[platform_b] where id=source_item;
 select id into quote_id from quotation_items limit 1;
 select id into assignment_id from campaign_influencers limit 1;
 update quotation_items set source_shortlist_item_id=source_item where id=quote_id;
 update campaign_influencers set source_shortlist_item_id=source_item where id=assignment_id;
 update discovery_shortlist_items set cost=0 where id=source_item;
 begin
  perform consolidate_creator_shortlist_drafts(target_id,source_id,actor);
  raise exception 'Expected commercial overlap rejection';
 exception when raise_exception then
  if sqlerrm not like 'Both creator entries contain shortlist details.%' then raise;end if;
 end;
 if (select count(*) from discovery_shortlist_items where id in(target_item,source_item))<>2 then raise exception 'Blocked merge changed records';end if;
 update discovery_shortlist_items set cost=null where id=source_item;
 result:=consolidate_creator_shortlist_drafts(target_id,source_id,actor);
 if result<>1 or exists(select 1 from discovery_shortlist_items where id=source_item) or not exists(select 1 from discovery_shortlist_items where id=target_item) then raise exception 'Draft consolidation failed';end if;
 if not exists(select 1 from audit_logs where entity_id=target_item and metadata->>'operation'='creator_merge_empty_drafts') then raise exception 'Missing audit';end if;
 if (select cardinality(platform_account_ids) from discovery_shortlist_items where id=target_item)<>2 then raise exception 'Lost platforms';end if;
 if quote_id is not null and (select source_shortlist_item_id from quotation_items where id=quote_id)<>target_item then raise exception 'Lost quotation link';end if;
 if assignment_id is not null and (select source_shortlist_item_id from campaign_influencers where id=assignment_id)<>target_item then raise exception 'Lost assignment link';end if;
 raise notice 'PASS: priced draft rejected; empty draft consolidated and audited';
end $$;


ROLLBACK;
