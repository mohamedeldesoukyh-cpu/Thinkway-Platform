begin;
set local lock_timeout='5s';
-- Resolve only prices explicitly reviewed by the operator. All choices succeed
-- together or roll back; changed rows require a fresh comparison.
create or replace function public.resolve_creator_merge_rates(p_target uuid,p_source uuid,p_actor uuid,p_choices jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare choice jsonb; kept public.rate_card_lines%rowtype; removed public.rate_card_lines%rowtype;
begin
 if p_target is null or p_source is null or p_target=p_source or p_actor is null then raise exception 'Choose two different creators';end if;
 if jsonb_typeof(p_choices)<>'array' or jsonb_array_length(p_choices) not between 1 and 5000 then raise exception 'Select prices to keep';end if;
 perform id from public.rate_card_lines where influencer_id in(p_target,p_source) order by id for update;
 for choice in select value from jsonb_array_elements(p_choices) loop
  select * into kept from public.rate_card_lines where id=(choice->'keep'->>'id')::uuid;
  if not found then raise exception 'Prices changed. Reload the comparison.';end if;
  select * into removed from public.rate_card_lines where id=(choice->'remove'->>'id')::uuid;
  if not found then raise exception 'Prices changed. Reload the comparison.';end if;
  if kept.influencer_id not in(p_target,p_source) or removed.influencer_id not in(p_target,p_source)
    or kept.influencer_id=removed.influencer_id
    or kept.influencer_id is null or removed.influencer_id is null
    or (kept.version_id,kept.platform,kept.deliverable,kept.price_type,kept.package_key)
      is distinct from (removed.version_id,removed.platform,removed.deliverable,removed.price_type,removed.package_key) then
    raise exception 'These prices are not an overlapping creator pair';
  end if;
  if to_jsonb(kept) is distinct from choice->'keep' or to_jsonb(removed) is distinct from choice->'remove' then
    raise exception 'Prices changed. Reload the comparison before choosing.';
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data,metadata)
    values(p_actor,'delete','rate_card_lines',removed.id,to_jsonb(removed),to_jsonb(kept),
      jsonb_build_object('operation','creator_merge_price_resolution','source_creator',p_source,'target_creator',p_target,'kept_line',kept.id));
  insert into public.creator_merge_history(influencer_id,source_influencer_id,source_table,record,actor_id)
    values(p_target,p_source,'rate_card_lines',to_jsonb(removed),p_actor);
  delete from public.rate_card_lines where id=removed.id;
 end loop;
end $$;
revoke all on function public.resolve_creator_merge_rates(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_creator_merge_rates(uuid,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
