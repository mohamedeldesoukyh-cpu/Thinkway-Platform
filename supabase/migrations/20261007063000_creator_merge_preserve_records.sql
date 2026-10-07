begin;
set local lock_timeout='5s';
-- Separate jobs for formerly separate profiles retain their IDs, prices and
-- documents after identity consolidation. Ordinary inserts still use slot zero.
alter table public.discovery_shortlist_items add column merge_record_key uuid not null default '00000000-0000-0000-0000-000000000000';
alter table public.campaign_influencers add column merge_record_key uuid not null default '00000000-0000-0000-0000-000000000000';
alter table public.vendor_ios add column merge_record_key uuid not null default '00000000-0000-0000-0000-000000000000';
alter table public.campaign_script_assignments add column merge_record_key uuid not null default '00000000-0000-0000-0000-000000000000';
alter table public.creator_agreement_templates add column merge_record_key uuid not null default '00000000-0000-0000-0000-000000000000';
drop index public.discovery_shortlist_items_influencer_collapse_unique;
drop index public.discovery_shortlist_items_influencer_standalone_unique;
create unique index discovery_shortlist_items_influencer_collapse_unique on public.discovery_shortlist_items(shortlist_id,influencer_id,collapse_group_id,merge_record_key) where influencer_id is not null and collapse_group_id is not null;
create unique index discovery_shortlist_items_influencer_standalone_unique on public.discovery_shortlist_items(shortlist_id,influencer_id,merge_record_key) where influencer_id is not null and collapse_group_id is null;
alter table public.campaign_influencers drop constraint campaign_influencers_unique;
alter table public.campaign_influencers add constraint campaign_influencers_unique unique(campaign_header_id,campaign_line_id,influencer_id,merge_record_key);
drop index public.campaign_influencers_shortlist_unique;
create unique index campaign_influencers_shortlist_unique on public.campaign_influencers(campaign_header_id,influencer_id,merge_record_key) where shortlist_assignment_status is not null;
drop index public.vendor_ios_active_influencer_campaign_unique;
create unique index vendor_ios_active_influencer_campaign_unique on public.vendor_ios(campaign_header_id,influencer_id,merge_record_key) where is_superseded=false and status<>'cancelled';
-- Future IO revisions retain the job's merge slot instead of colliding with a
-- different preserved assignment for the same creator and campaign.
create function public.vendor_io_merge_record_slot() returns trigger language plpgsql set search_path=public as $$
begin
 if new.replaces_vendor_io_id is not null then
  select merge_record_key into new.merge_record_key from public.vendor_ios where id=new.replaces_vendor_io_id;
 else
  select merge_record_key into new.merge_record_key from public.campaign_influencers where id=new.assignment_id;
 end if;
 new.merge_record_key:=coalesce(new.merge_record_key,'00000000-0000-0000-0000-000000000000'::uuid);
 return new;
end $$;
create trigger vendor_io_merge_record_slot before insert on public.vendor_ios for each row execute function public.vendor_io_merge_record_slot();
alter table public.campaign_script_assignments drop constraint campaign_script_assignments_script_id_influencer_id_key;
alter table public.campaign_script_assignments add constraint campaign_script_assignments_script_id_influencer_id_key unique(script_id,influencer_id,merge_record_key);
drop index public.creator_agreement_templates_combo_uidx;
create unique index creator_agreement_templates_combo_uidx on public.creator_agreement_templates(influencer_id,client_id,coalesce(brand_id,'00000000-0000-0000-0000-000000000000'::uuid),merge_record_key);

-- Conflicting single-profile projections are retained as complete snapshots,
-- linked to the surviving creator. Their underlying captures/history move too.
create table public.creator_merge_history (
 id uuid primary key default gen_random_uuid(), influencer_id uuid not null references public.influencers(id),
 source_influencer_id uuid not null, source_table text not null, record jsonb not null,
 created_at timestamptz not null default now(), actor_id uuid not null
);
alter table public.creator_merge_history enable row level security;
create policy creator_merge_history_read on public.creator_merge_history for select to authenticated using(public.is_admin());
grant select on public.creator_merge_history to authenticated;
grant all on public.creator_merge_history to service_role;
create index creator_merge_history_creator_idx on public.creator_merge_history(influencer_id,created_at desc);

-- Cancelled documents stay immutable, except for an audited identity-only move
-- performed inside the service-only merge transaction.
create or replace function public.guard_cancelled_vendor_io() returns trigger language plpgsql set search_path=public as $$
begin
 if old.status='cancelled' then
  if tg_op='UPDATE' and current_user in ('service_role','postgres')
    and current_setting('thinkway.creator_merge',true)='on'
    and (to_jsonb(new)-array['influencer_id','merge_record_key','updated_at'])=(to_jsonb(old)-array['influencer_id','merge_record_key','updated_at']) then return new;end if;
  raise exception 'Cancelled IOs are retained for history and cannot be edited or deleted.';
 end if;
 if tg_op='DELETE' and old.status<>'draft' then raise exception 'Issued IOs must be cancelled, not deleted.';end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;

create or replace function public.combine_creator_records(p_target uuid,p_source uuid,p_actor uuid,p_patch jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare t public.influencers%rowtype; s public.influencers%rowtype; fk record; row_data jsonb; table_name text; moved integer; version_offset integer;
begin
 if p_target is null or p_source is null or p_target=p_source or p_actor is null then raise exception 'Choose two different creators';end if;
 perform id from public.influencers where id in(p_target,p_source) order by id for update;
 select * into t from public.influencers where id=p_target;
 if not found then raise exception 'Creator to keep no longer exists';end if;
 select * into s from public.influencers where id=p_source;
 if not found then raise exception 'Duplicate creator no longer exists';end if;
 perform set_config('thinkway.creator_merge','on',true);
 insert into public.creator_merge_history(influencer_id,source_influencer_id,source_table,record,actor_id) values(p_target,p_source,'influencers',to_jsonb(s),p_actor);
 -- Recheck prices under locks; no silent deletion of commercial lines.
 perform id from public.rate_card_lines where influencer_id in(p_target,p_source) order by id for update;
 if exists(select 1 from public.rate_card_lines a join public.rate_card_lines b on (a.version_id,a.platform,a.deliverable,a.price_type,a.package_key)=(b.version_id,b.platform,b.deliverable,b.price_type,b.package_key) where a.influencer_id=p_target and b.influencer_id=p_source) then
  raise exception 'Both creators have prices in the same rate card. Review the overlapping prices on this screen.';
 end if;
 foreach table_name in array array['discovery_shortlist_items','campaign_influencers','vendor_ios','campaign_script_assignments','creator_agreement_templates'] loop
  execute format('update public.%I set merge_record_key=id where influencer_id=$1 and merge_record_key=''00000000-0000-0000-0000-000000000000''',table_name) using p_source;
 end loop;
 -- Keep a chosen portrait on each card; preserve the other portrait in history.
 insert into public.creator_merge_history(influencer_id,source_influencer_id,source_table,record,actor_id)
 select p_target,p_source,'rate_card_creator_avatars',to_jsonb(a),p_actor from public.rate_card_creator_avatars a
 where a.creator_ref='inf:'||p_source::text and exists(select 1 from public.rate_card_creator_avatars b where b.card_id=a.card_id and b.creator_ref='inf:'||p_target::text);
 delete from public.rate_card_creator_avatars a where a.creator_ref='inf:'||p_source::text and exists(select 1 from public.rate_card_creator_avatars b where b.card_id=a.card_id and b.creator_ref='inf:'||p_target::text);
 update public.rate_card_creator_avatars set creator_ref='inf:'||p_target::text where creator_ref='inf:'||p_source::text;
 -- Preserve current single-row projections before consolidating their identity.
 foreach table_name in array array['creator_dna','creator_crm_profiles'] loop
  execute format('insert into public.creator_merge_history(influencer_id,source_influencer_id,source_table,record,actor_id) select $1,$2,%L,to_jsonb(x),$3 from public.%I x where influencer_id=$2 and exists(select 1 from public.%I where influencer_id=$1)',table_name,table_name,table_name) using p_target,p_source,p_actor;
  execute format('delete from public.%I where influencer_id=$2 and exists(select 1 from public.%I where influencer_id=$1)',table_name,table_name) using p_target,p_source;
 end loop;
 -- DNA version documents are never dropped; allocate unused version numbers.
 select coalesce(max(version),0) into version_offset from public.creator_dna_versions where influencer_id=p_target;
 update public.creator_dna_versions set influencer_id=p_target,version=version+version_offset where influencer_id=p_source;
 -- Derived projections have one current value per key. Retain their original
 -- full row in merge history, instead of losing it to a uniqueness conflict.
 for row_data in select to_jsonb(a) from public.creator_intelligence_monthly_metrics a where a.influencer_id=p_source and exists(select 1 from public.creator_intelligence_monthly_metrics b where b.influencer_id=p_target and (b.platform,b.period_month)=(a.platform,a.period_month)) loop
  insert into public.creator_merge_history(influencer_id,source_influencer_id,source_table,record,actor_id) values(p_target,p_source,'creator_intelligence_monthly_metrics',row_data,p_actor);
  delete from public.creator_intelligence_monthly_metrics where id=(row_data->>'id')::uuid;
 end loop;
 for row_data in select to_jsonb(a) from public.creator_content_performance_baselines a where a.influencer_id=p_source and exists(select 1 from public.creator_content_performance_baselines b where b.influencer_id=p_target and (b.platform,b.content_type)=(a.platform,a.content_type)) loop
  insert into public.creator_merge_history(influencer_id,source_influencer_id,source_table,record,actor_id) values(p_target,p_source,'creator_content_performance_baselines',row_data,p_actor);
  delete from public.creator_content_performance_baselines where id=(row_data->>'id')::uuid;
 end loop;
 for row_data in select to_jsonb(a) from public.creator_crm_activation_events a where a.influencer_id=p_source and exists(select 1 from public.creator_crm_activation_events b where b.influencer_id=p_target and (b.reason,b.source_entity_type,b.source_entity_id)=(a.reason,a.source_entity_type,a.source_entity_id)) loop
  insert into public.creator_merge_history(influencer_id,source_influencer_id,source_table,record,actor_id) values(p_target,p_source,'creator_crm_activation_events',row_data,p_actor);
  delete from public.creator_crm_activation_events where id=(row_data->>'id')::uuid;
 end loop;
 if exists(select 1 from public.influencer_bank_accounts where influencer_id=p_target and is_default) then update public.influencer_bank_accounts set is_default=false where influencer_id=p_source and is_default;end if;
 if exists(select 1 from public.user_invites where influencer_id=p_target and portal_type='creator' and status='invited') then update public.user_invites set status='revoked' where influencer_id=p_source and portal_type='creator' and status='invited';end if;
 if exists(select 1 from public.influencer_platform_accounts where influencer_id=p_target and is_primary) then update public.influencer_platform_accounts set is_primary=false where influencer_id=p_source;end if;
 select count(*) into moved from public.influencer_platform_accounts where influencer_id=p_source;
 -- Discover real FK references, including finance documents, bank accounts,
 -- portal connections and future tables; IDs and dependent documents stay put.
 for fk in select n.nspname schema_name,c.relname table_name,a.attname column_name from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1] where k.contype='f' and k.confrelid='public.influencers'::regclass and cardinality(k.conkey)=1 and n.nspname='public' order by case when c.relname in ('creator_crm_activation_events','creator_crm_profiles') then 0 else 1 end,c.relname,a.attname loop
  execute format('update %I.%I set %I=$1 where %I=$2',fk.schema_name,fk.table_name,fk.column_name,fk.column_name) using p_target,p_source;
 end loop;
 update public.discovery_shortlist_items set unified_id='inf:'||p_target::text where influencer_id=p_target and unified_id='inf:'||p_source::text;
 update public.rate_card_lines set creator_name=t.display_name where influencer_id=p_target;
 -- Only allow known identity fields in the server-calculated patch.
 update public.influencers set
  email=coalesce(nullif(t.email,''),s.email),phone=coalesce(nullif(t.phone,''),s.phone),
  country_code=coalesce(t.country_code,s.country_code),
  country_codes=array(select distinct unnest(coalesce(t.country_codes,'{}')||coalesce(s.country_codes,'{}'))),
  categories=array(select distinct unnest(coalesce(t.categories,'{}')||coalesce(s.categories,'{}'))),
  languages=array(select distinct unnest(coalesce(t.languages,'{}')||coalesce(s.languages,'{}'))),
  rate_card=coalesce(s.rate_card,'{}'::jsonb)||coalesce(t.rate_card,'{}'::jsonb),
  notes=concat_ws(E'\n\n',nullif(t.notes,''),nullif(s.notes,'')),
  influencer_url=coalesce(nullif(t.influencer_url,''),s.influencer_url)
 where id=p_target;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,old_data,new_data,metadata) values(p_actor,'update','influencers',p_target,to_jsonb(t),(select to_jsonb(x) from public.influencers x where id=p_target),jsonb_build_object('operation','combine_creators','source_creator',p_source,'records_preserved',true));
 delete from public.influencers where id=p_source;
 return moved;
end $$;
revoke all on function public.combine_creator_records(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.combine_creator_records(uuid,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
