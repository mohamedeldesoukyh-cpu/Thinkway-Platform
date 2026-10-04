-- Called only by the already-authorized service-role creator merge.
-- Recheck under row locks; never discard prices, notes, or deliverables.
create or replace function public.consolidate_creator_shortlist_drafts(p_target uuid,p_source uuid,p_actor uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare t public.discovery_shortlist_items%rowtype; s public.discovery_shortlist_items%rowtype; r public.discovery_shortlist_items%rowtype; n integer:=0;
begin
 if p_target=p_source or p_target is null or p_source is null then raise exception 'Choose two different creators';end if;
 perform id from public.discovery_shortlist_items where influencer_id in (p_target,p_source) order by id for update;
 for s in select * from public.discovery_shortlist_items where influencer_id=p_source loop
  select * into t from public.discovery_shortlist_items where influencer_id=p_target and shortlist_id=s.shortlist_id and collapse_group_id is not distinct from s.collapse_group_id;
  if not found then continue;end if;
  foreach r in array array[t,s] loop
   if r.item_status is distinct from 'draft' or r.profile_id is not null or
      r.cost is not null or r.revenue is not null or r.gp_pct is not null or r.gp_value is not null or
      r.cost_egp is not null or r.revenue_egp is not null or r.gp_value_egp is not null or
      r.cost_currency is not null or r.fx_rate_to_egp is not null or r.commercial_updated_at is not null or
      r.notes is not null or r.service_description is not null or r.match_score is not null or
      to_jsonb(r.deliverables) is distinct from '[]'::jsonb then
     raise exception 'Both creator entries contain shortlist details. Review their prices, notes and deliverables before combining.';
   end if;
  end loop;
  update public.discovery_shortlist_items set platform_account_ids=array(select distinct unnest(coalesce(t.platform_account_ids,'{}'::uuid[])||coalesce(s.platform_account_ids,'{}'::uuid[]))), unified_id='inf:'||p_target::text where id=t.id;
  update public.quotation_items set source_shortlist_item_id=t.id where source_shortlist_item_id=s.id;
  update public.campaign_influencers set source_shortlist_item_id=t.id where source_shortlist_item_id=s.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data,metadata)
   values(p_actor,'update','discovery_shortlist_items',t.id,jsonb_build_object('kept',to_jsonb(t),'combined',to_jsonb(s)),(select to_jsonb(x) from public.discovery_shortlist_items x where id=t.id),jsonb_build_object('operation','creator_merge_empty_drafts','source_creator',p_source,'target_creator',p_target));
  delete from public.discovery_shortlist_items where id=s.id;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.consolidate_creator_shortlist_drafts(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.consolidate_creator_shortlist_drafts(uuid,uuid,uuid) to service_role;
