-- Keep every line's audit record, but touch each parent once per statement.
-- Preserve RLS and atomic save_rate_card transactions; no timeout increase.
begin;
set local lock_timeout='5s';
create or replace function public.audit_rate_card() returns trigger language plpgsql security definer set search_path=public as $$
declare row_data jsonb; card uuid; scope jsonb;
begin
 row_data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='rate_cards' then card=(row_data->>'id')::uuid;
 elsif tg_table_name='rate_card_versions' then card=(row_data->>'card_id')::uuid;
 else select card_id into card from public.rate_card_versions where id=(row_data->>'version_id')::uuid; end if;
 select jsonb_build_object('client_id',client_id,'brand_id',brand_id) into scope from public.rate_cards where id=card;
 insert into public.audit_logs(action,entity_type,entity_id,actor_id,old_data,new_data,metadata)
 values((case tg_op when 'INSERT' then 'create' else lower(tg_op) end)::public.audit_action,tg_table_name,(row_data->>'id')::uuid,auth.uid(),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end,coalesce(scope,'{}')||jsonb_build_object('module','rate_cards','operation',nullif(current_setting('rate_cards.operation',true),''),'card_id',card,'version_id',case when tg_table_name='rate_card_versions' then row_data->>'id' else row_data->>'version_id' end,'creator_ref',row_data->>'creator_ref'));
 return coalesce(new,old);
end $$;

create or replace function public.touch_rate_card_line_versions() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
  update public.rate_card_versions set updated_at=clock_timestamp()
  where id in (select version_id from new_lines);
 elsif tg_op='DELETE' then
  update public.rate_card_versions set updated_at=clock_timestamp()
  where id in (select version_id from old_lines);
 else
  update public.rate_card_versions set updated_at=clock_timestamp()
  where id in (select version_id from new_lines union select version_id from old_lines);
 end if;
 return null;
end $$;
revoke all on function public.touch_rate_card_line_versions() from public;
create trigger rcl_touch_insert after insert on public.rate_card_lines
 referencing new table as new_lines for each statement execute function public.touch_rate_card_line_versions();
create trigger rcl_touch_update after update on public.rate_card_lines
 referencing old table as old_lines new table as new_lines for each statement execute function public.touch_rate_card_line_versions();
create trigger rcl_touch_delete after delete on public.rate_card_lines
 referencing old table as old_lines for each statement execute function public.touch_rate_card_line_versions();

-- Use the existing (version_id, creator_ref, platform, ...) unique index.
-- The previous OR over source IDs scanned the version for every inserted price.
create or replace function public.rate_card_inherit_travel() returns trigger
language plpgsql security invoker set search_path=public as $$
declare prior public.rate_card_lines;
begin
 select * into prior from public.rate_card_lines l
 where l.version_id=new.version_id
 and l.creator_ref=case when new.influencer_id is not null then 'inf:'||new.influencer_id::text else 'dis:'||new.profile_id::text end
 and l.platform=new.platform and l.package_key=new.package_key
 order by l.id limit 1;
 if found then
  new.tu_a_percent=coalesce(new.tu_a_percent,prior.tu_a_percent);
  new.tu_b_percent=coalesce(new.tu_b_percent,prior.tu_b_percent);
  new.itu_percent=coalesce(new.itu_percent,prior.itu_percent);
 end if;
 return new;
end $$;

-- Actor permissions are constant for a statement. InitPlans evaluate them once;
-- client/version visibility checks remain row-specific and unchanged.
alter policy rc_read on public.rate_cards using ((select public.rate_card_allowed('read')) and exists(select 1 from public.clients c where c.id=client_id));
alter policy rc_create on public.rate_cards with check((select public.rate_card_allowed('create')) and exists(select 1 from public.clients c where c.id=client_id));
alter policy rc_edit on public.rate_cards using((select public.rate_card_allowed('edit')) and exists(select 1 from public.clients c where c.id=client_id)) with check(exists(select 1 from public.clients c where c.id=client_id));
alter policy rc_delete on public.rate_cards using((select public.rate_card_allowed('delete')) and exists(select 1 from public.clients c where c.id=client_id));
alter policy rcv_read on public.rate_card_versions using(exists(select 1 from public.rate_cards c where c.id=card_id));
alter policy rcv_create on public.rate_card_versions with check(((select public.rate_card_allowed('create')) or (select public.rate_card_allowed('upload'))) and exists(select 1 from public.rate_cards c where c.id=card_id));
alter policy rcv_edit on public.rate_card_versions using(((select public.rate_card_allowed('edit')) or (select public.rate_card_allowed('activate')) or (select public.rate_card_allowed('upload'))) and exists(select 1 from public.rate_cards c where c.id=card_id)) with check(exists(select 1 from public.rate_cards c where c.id=card_id));
alter policy rcv_delete on public.rate_card_versions using((select public.rate_card_allowed('delete')) and exists(select 1 from public.rate_cards c where c.id=card_id));
alter policy rcl_read on public.rate_card_lines using(exists(select 1 from public.rate_card_versions v where v.id=version_id));
alter policy rcl_create on public.rate_card_lines with check(((select public.rate_card_allowed('edit')) or (select public.rate_card_allowed('upload')) or (select public.rate_card_allowed('create'))) and exists(select 1 from public.rate_card_versions v where v.id=version_id));
alter policy rcl_edit on public.rate_card_lines using(((select public.rate_card_allowed('edit')) or (select public.rate_card_allowed('upload'))) and exists(select 1 from public.rate_card_versions v where v.id=version_id)) with check(exists(select 1 from public.rate_card_versions v where v.id=version_id));
alter policy rcl_delete on public.rate_card_lines using(((select public.rate_card_allowed('edit')) or (select public.rate_card_allowed('delete'))) and exists(select 1 from public.rate_card_versions v where v.id=version_id));
notify pgrst,'reload schema';
commit;
