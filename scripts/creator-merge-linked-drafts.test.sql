BEGIN;
DO $$
declare target_id uuid; source_id uuid; profile uuid; actor uuid; shortlist uuid; kept uuid; removed uuid; n integer;
begin
 select p.id,p.influencer_id into profile,source_id from discovered_profiles p where p.influencer_id is not null limit 1;
 select id into target_id from influencers where id<>source_id limit 1;
 select id into actor from profiles limit 1;
 insert into discovery_shortlists(name,owner_id) values('Rollback merge regression',actor) returning id into shortlist;
 insert into discovery_shortlist_items(shortlist_id,influencer_id,unified_id,item_status,deliverables) values(shortlist,target_id,'inf:'||target_id,'draft','[]') returning id into kept;
 insert into discovery_shortlist_items(shortlist_id,influencer_id,unified_id,profile_id,item_status,deliverables) values(shortlist,source_id,'inf:'||source_id,profile,'draft','[]') returning id into removed;
 -- Limit the function to synthetic records by using isolated creators would be ideal;
 -- instead savepoint exception rolls back all helper writes before checking blockers.
 begin
  n=consolidate_creator_shortlist_drafts(target_id,source_id,actor);
  if not exists(select 1 from discovery_shortlist_items where id=kept and profile_id=profile) or exists(select 1 from discovery_shortlist_items where id=removed) then raise exception 'identity consolidation failed';end if;
  if not exists(select 1 from audit_logs where entity_id=kept and old_data->'combined'->>'id'=removed::text) then raise exception 'audit missing';end if;
  raise exception 'rollback_success';
 exception when raise_exception then if sqlerrm<>'rollback_success' then raise;end if;end;
 update discovery_shortlist_items set cost=0 where id=removed;
 begin
  perform consolidate_creator_shortlist_drafts(target_id,source_id,actor);
  raise exception 'commercial data accepted';
 exception when raise_exception then if sqlerrm not like 'Both creator entries contain shortlist details%' then raise;end if;end;
 if not exists(select 1 from discovery_shortlist_items where id=removed and cost=0) then raise exception 'commercial data lost';end if;
 raise notice 'Linked draft identity, audit history, and commercial blocker checks passed';
end $$;
ROLLBACK;
