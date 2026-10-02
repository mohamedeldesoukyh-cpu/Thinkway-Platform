-- Reference pricing only. No trigger on these tables writes quotation data.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
insert into public.permissions(slug, resource, action, description)
select 'rate_cards.' || a, 'rate_cards', a, 'Rate cards: ' || a
from unnest(array['read','create','edit','upload','delete','activate','apply']) a
on conflict(slug) do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.slug in ('admin','super_admin') and p.resource='rate_cards' on conflict do nothing;

alter table public.clients add column if not exists rate_cards_enabled boolean not null default false;
create table public.rate_cards (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id),
 brand_id uuid references public.brands(id), name text not null check(length(trim(name)) between 1 and 200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.rate_cards(client_id,brand_id);
create table public.rate_card_versions (
 id uuid primary key default gen_random_uuid(), card_id uuid not null references public.rate_cards(id) on delete cascade,
 version text not null check(length(trim(version)) between 1 and 50), status text not null default 'inactive' check(status in ('active','inactive')),
 effective_date date, expiry_date date, notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(card_id,version), check(expiry_date is null or effective_date is null or expiry_date >= effective_date)
);
create table public.rate_card_lines (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.rate_card_versions(id) on delete cascade,
 influencer_id uuid references public.influencers(id), profile_id uuid references public.discovered_profiles(id),
 creator_ref text generated always as (case when influencer_id is not null then 'inf:' || influencer_id::text else 'dis:' || profile_id::text end) stored,
 creator_name text not null, platform text not null, deliverable text not null,
 price_type text not null check(price_type in ('creator_cost','client_price')),
 agency_fee_percent numeric(7,4) check(agency_fee_percent between 0 and 100),
 amount numeric(18,4) not null check(amount >= 0), currency text not null references public.md_currencies(code), notes text not null default '',
 check(num_nonnulls(influencer_id,profile_id)=1), unique(version_id,creator_ref,platform,deliverable,price_type)
);
create index on public.rate_card_lines(creator_ref,platform,currency);

create function public.rate_card_line_guard() returns trigger language plpgsql security invoker set search_path=public as $$
declare canonical uuid;
begin
 if new.profile_id is not null then
  select influencer_id into canonical from public.discovered_profiles where id=new.profile_id;
  if canonical is not null then new.influencer_id=canonical;new.profile_id=null;end if;
 end if;
 if exists(select 1 from public.md_currencies where code=new.currency and not is_active) then raise exception 'currency';end if;
 return new;
end $$;
create trigger rcl_guard before insert or update on public.rate_card_lines for each row execute function public.rate_card_line_guard();

create function public.rate_card_allowed(p_action text) returns boolean language sql stable security invoker set search_path=public as $$
 select public.is_internal_user() and (public.is_admin() or public.has_permission('rate_cards.' || p_action));
$$;

alter table public.rate_cards enable row level security;
alter table public.rate_card_versions enable row level security;
alter table public.rate_card_lines enable row level security;
alter table public.rate_cards force row level security;
alter table public.rate_card_versions force row level security;
alter table public.rate_card_lines force row level security;
create policy rc_read on public.rate_cards for select to authenticated using (public.rate_card_allowed('read') and exists(select 1 from public.clients c where c.id=client_id));
create policy rc_create on public.rate_cards for insert to authenticated with check(public.rate_card_allowed('create') and exists(select 1 from public.clients c where c.id=client_id));
create policy rc_edit on public.rate_cards for update to authenticated using(public.rate_card_allowed('edit') and exists(select 1 from public.clients c where c.id=client_id)) with check(exists(select 1 from public.clients c where c.id=client_id));
create policy rc_delete on public.rate_cards for delete to authenticated using(public.rate_card_allowed('delete') and exists(select 1 from public.clients c where c.id=client_id));
create policy rcv_read on public.rate_card_versions for select to authenticated using(exists(select 1 from public.rate_cards c where c.id=card_id));
create policy rcv_create on public.rate_card_versions for insert to authenticated with check((public.rate_card_allowed('create') or public.rate_card_allowed('upload')) and exists(select 1 from public.rate_cards c where c.id=card_id));
create policy rcv_edit on public.rate_card_versions for update to authenticated using((public.rate_card_allowed('edit') or public.rate_card_allowed('activate') or public.rate_card_allowed('upload')) and exists(select 1 from public.rate_cards c where c.id=card_id)) with check(exists(select 1 from public.rate_cards c where c.id=card_id));
create policy rcv_delete on public.rate_card_versions for delete to authenticated using(public.rate_card_allowed('delete') and exists(select 1 from public.rate_cards c where c.id=card_id));
create policy rcl_read on public.rate_card_lines for select to authenticated using(exists(select 1 from public.rate_card_versions v where v.id=version_id));
create policy rcl_create on public.rate_card_lines for insert to authenticated with check((public.rate_card_allowed('edit') or public.rate_card_allowed('upload') or public.rate_card_allowed('create')) and exists(select 1 from public.rate_card_versions v where v.id=version_id));
create policy rcl_edit on public.rate_card_lines for update to authenticated using((public.rate_card_allowed('edit') or public.rate_card_allowed('upload')) and exists(select 1 from public.rate_card_versions v where v.id=version_id)) with check(exists(select 1 from public.rate_card_versions v where v.id=version_id));
create policy rcl_delete on public.rate_card_lines for delete to authenticated using((public.rate_card_allowed('edit') or public.rate_card_allowed('delete')) and exists(select 1 from public.rate_card_versions v where v.id=version_id));
grant select,insert,update,delete on public.rate_cards,public.rate_card_versions,public.rate_card_lines to authenticated;

create function public.rate_card_guard() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if tg_table_name='rate_cards' then
  if new.brand_id is not null and not exists(select 1 from public.brands where id=new.brand_id and client_id=new.client_id) then raise exception 'brand_scope'; end if;
  new.updated_at=clock_timestamp();
 elsif tg_table_name='rate_card_versions' then
  if tg_op='UPDATE' then
   if new.card_id<>old.card_id then raise exception 'scope'; end if;
   if new.status<>old.status and not public.rate_card_allowed('activate') then raise exception 'permission'; end if;
   if (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at']) and not public.rate_card_allowed('edit') then raise exception 'permission'; end if;
  elsif new.status='active' and not public.rate_card_allowed('activate') then raise exception 'permission'; end if;
  new.updated_at=clock_timestamp();
 end if;
 return new;
end $$;
create trigger rc_guard before insert or update on public.rate_cards for each row execute function public.rate_card_guard();
create trigger rcv_guard before insert or update on public.rate_card_versions for each row execute function public.rate_card_guard();

create function public.audit_rate_card() returns trigger language plpgsql security definer set search_path=public as $$
declare row_data jsonb; parent_id uuid; card uuid; scope jsonb;
begin
 row_data=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='rate_cards' then card=(row_data->>'id')::uuid;
 elsif tg_table_name='rate_card_versions' then card=(row_data->>'card_id')::uuid;
 else select card_id into card from public.rate_card_versions where id=(row_data->>'version_id')::uuid; end if;
 select jsonb_build_object('client_id',client_id,'brand_id',brand_id) into scope from public.rate_cards where id=card;
 insert into public.audit_logs(action,entity_type,entity_id,actor_id,old_data,new_data,metadata)
 values((case tg_op when 'INSERT' then 'create' else lower(tg_op) end)::public.audit_action,tg_table_name,(row_data->>'id')::uuid,auth.uid(),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end,coalesce(scope,'{}')||jsonb_build_object('module','rate_cards','operation',nullif(current_setting('rate_cards.operation',true),''),'card_id',card,'version_id',case when tg_table_name='rate_card_versions' then row_data->>'id' else row_data->>'version_id' end,'creator_ref',row_data->>'creator_ref'));
 if tg_table_name='rate_card_lines' then
  parent_id=(row_data->>'version_id')::uuid;
  update public.rate_card_versions set updated_at=clock_timestamp() where id=parent_id;
 end if;
 return coalesce(new,old);
end $$;
create trigger rc_audit after insert or update or delete on public.rate_cards for each row execute function public.audit_rate_card();
create trigger rcv_audit after insert or update or delete on public.rate_card_versions for each row execute function public.audit_rate_card();
create trigger rcl_audit after insert or update or delete on public.rate_card_lines for each row execute function public.audit_rate_card();

create view public.rate_card_register with (security_invoker=true) as
select v.*, c.client_id,c.brand_id,c.name,cl.name as client_name,b.name as brand_name,
 (select count(distinct creator_ref) from public.rate_card_lines l where l.version_id=v.id) as creator_count,
 array(select distinct currency from public.rate_card_lines l where l.version_id=v.id order by currency) as currencies
from public.rate_card_versions v join public.rate_cards c on c.id=v.card_id join public.clients cl on cl.id=c.client_id left join public.brands b on b.id=c.brand_id;
grant select on public.rate_card_register to authenticated;
create view public.rate_card_line_metrics with (security_invoker=true) as
select l.*,c.amount as creator_cost,p.amount as client_price,c.currency as creator_currency,p.currency as client_currency,
 case when c.currency=p.currency and p.amount<>0 then round((p.amount-c.amount)/p.amount*100,4) end as gp_percent,
 case when c.currency=p.currency and c.amount<>0 then round((p.amount-c.amount)/c.amount*100,4) end as markup_percent
from public.rate_card_lines l
left join public.rate_card_lines c on c.version_id=l.version_id and c.creator_ref=l.creator_ref and c.platform=l.platform and c.deliverable=l.deliverable and c.price_type='creator_cost'
left join public.rate_card_lines p on p.version_id=l.version_id and p.creator_ref=l.creator_ref and p.platform=l.platform and p.deliverable=l.deliverable and p.price_type='client_price';
grant select on public.rate_card_line_metrics to authenticated;


-- Create/edit/import a version atomically. Upload updates are additive/upserts; nothing is silently removed.
create function public.save_rate_card(p_header jsonb, p_version_id uuid default null, p_copy_id uuid default null, p_lines jsonb default null, p_expected text default null, p_operation text default 'upload')
returns uuid language plpgsql security invoker set search_path=public as $$
declare cid uuid; vid uuid; v public.rate_card_versions; l jsonb;
begin
 if p_version_id is not null then
  select * into strict v from public.rate_card_versions where id=p_version_id for update;
  if p_expected is null or v.updated_at<>p_expected::timestamptz then raise exception 'stale'; end if;
  cid=v.card_id; vid=v.id;
  if p_header is not null then
   if not public.rate_card_allowed('edit') then raise exception 'permission'; end if;
   update public.rate_cards set name=p_header->>'name' where id=cid;
   update public.rate_card_versions set version=p_header->>'version',status=p_header->>'status',effective_date=(p_header->>'effective_date')::date,expiry_date=(p_header->>'expiry_date')::date,notes=coalesce(p_header->>'notes','') where id=vid;
  end if;
 else
  if not(public.rate_card_allowed('create') or (p_copy_id is not null and public.rate_card_allowed('upload'))) then raise exception 'permission'; end if;
  if p_copy_id is not null then
   select * into strict v from public.rate_card_versions where id=p_copy_id for update;
   if p_expected is not null and v.updated_at<>p_expected::timestamptz then raise exception 'stale'; end if;
   cid=v.card_id;
  else
   insert into public.rate_cards(client_id,brand_id,name) values((p_header->>'client_id')::uuid,(p_header->>'brand_id')::uuid,p_header->>'name') returning id into cid;
  end if;
  insert into public.rate_card_versions(card_id,version,status,effective_date,expiry_date,notes)
  values(cid,p_header->>'version',p_header->>'status',(p_header->>'effective_date')::date,(p_header->>'expiry_date')::date,coalesce(p_header->>'notes','')) returning id into vid;
  if p_copy_id is not null then
   insert into public.rate_card_lines(version_id,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent)
   select vid,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent from public.rate_card_lines where version_id=p_copy_id;
  end if;
 end if;
 if p_lines is not null then
  if p_operation not in ('upload','pricing') or not public.rate_card_allowed(case when p_operation='pricing' then 'edit' else 'upload' end) then raise exception 'permission'; end if;
  if jsonb_array_length(p_lines)>10000 then raise exception 'file';end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'influencer_id',x->>'profile_id',x->>'platform',x->>'deliverable',x->>'price_type' having count(*)>1) then raise exception 'duplicate';end if;
  perform set_config('rate_cards.operation',p_operation,true);
  for l in select * from jsonb_array_elements(p_lines) loop
   insert into public.rate_card_lines(version_id,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent)
   values(vid,(l->>'influencer_id')::uuid,(l->>'profile_id')::uuid,l->>'creator_name',l->>'platform',l->>'deliverable',l->>'price_type',(l->>'amount')::numeric,l->>'currency',coalesce(l->>'notes',''),(l->>'agency_fee_percent')::numeric)
   on conflict(version_id,creator_ref,platform,deliverable,price_type) do update set amount=excluded.amount,currency=excluded.currency,notes=excluded.notes,creator_name=excluded.creator_name,agency_fee_percent=excluded.agency_fee_percent;
  end loop;
 end if;
 return vid;
end $$;
revoke all on function public.save_rate_card(jsonb,uuid,uuid,jsonb,text,text) from public;
grant execute on function public.save_rate_card(jsonb,uuid,uuid,jsonb,text,text) to authenticated;
create function public.filter_rate_card_versions(p_creator text,p_platform text) returns setof public.rate_card_register
language sql stable security invoker set search_path=public as $$
 select r.* from public.rate_card_register r where exists(select 1 from public.rate_card_lines l where l.version_id=r.id and (p_creator is null or l.creator_name ilike '%' || p_creator || '%' or l.creator_ref=p_creator) and (p_platform is null or l.platform=p_platform));
$$;
create function public.match_rate_card_handle(p_platform text,p_handle text) returns table(creator_ref text,creator_name text)
language sql stable security invoker set search_path=public as $$
 select distinct 'inf:' || i.id::text,i.display_name from public.influencer_platform_accounts a join public.influencers i on i.id=a.influencer_id
 where lower(a.platform)=lower(p_platform) and lower(ltrim(a.handle,'@'))=lower(ltrim(p_handle,'@'))
 union
 select case when d.influencer_id is null then 'dis:' || d.id::text else 'inf:' || d.influencer_id::text end,coalesce(i.display_name,d.display_name) from public.discovered_profiles d
 left join public.influencers i on i.id=d.influencer_id
 where lower(d.platform::text)=lower(p_platform) and lower(ltrim(d.username::text,'@'))=lower(ltrim(p_handle,'@'));
$$;
create function public.mutate_rate_card_version(p_id uuid,p_action text,p_expected text) returns void
language plpgsql security invoker set search_path=public as $$
declare v public.rate_card_versions;
begin
 select * into strict v from public.rate_card_versions where id=p_id for update;
 if v.updated_at<>p_expected::timestamptz then raise exception 'stale'; end if;
 if p_action in ('activate','deactivate') then
  if not public.rate_card_allowed('activate') then raise exception 'permission'; end if;
  update public.rate_card_versions set status=case p_action when 'activate' then 'active' else 'inactive' end where id=p_id;
 elsif p_action in ('delete','delete_card') then
  if not public.rate_card_allowed('delete') then raise exception 'permission'; end if;
  if p_action='delete_card' then delete from public.rate_cards where id=v.card_id;
  else delete from public.rate_card_versions where id=p_id; end if;
 else raise exception 'invalid'; end if;
end $$;
revoke all on function public.mutate_rate_card_version(uuid,text,text), public.match_rate_card_handle(text,text), public.filter_rate_card_versions(text,text) from public;
grant execute on function public.mutate_rate_card_version(uuid,text,text), public.match_rate_card_handle(text,text), public.filter_rate_card_versions(text,text) to authenticated;

create function public.match_rate_card_handles(p_candidates jsonb) returns table(match_key text,creator_ref text,creator_name text)
language sql stable security invoker set search_path=public as $$
 select c->>'key',m.creator_ref,m.creator_name from jsonb_array_elements(p_candidates) c
 cross join lateral public.match_rate_card_handle(c->>'platform',c->>'handle') m
 where public.rate_card_allowed('upload');
$$;
revoke all on function public.match_rate_card_handles(jsonb) from public;
grant execute on function public.match_rate_card_handles(jsonb) to authenticated;

-- Historical source snapshots deliberately have no foreign keys to rate cards.
alter table public.quotation_items add column if not exists rate_card_sources jsonb not null default '{}'::jsonb;
create function public.audit_quotation_rate_source() returns trigger language plpgsql security definer set search_path=public as $$
declare k text; s jsonb; idx int; quote_status text;
begin
 if new.rate_card_sources is distinct from old.rate_card_sources then
  if not public.rate_card_allowed('apply') then raise exception 'permission'; end if;
  select status::text into quote_status from public.quotations where id=new.quotation_id for update;
  if quote_status='approved' then raise exception 'quotation_locked'; end if;
 end if;
 for k,s in select * from jsonb_each(old.rate_card_sources) loop
  idx=split_part(k,':',1)::int;
  if new.rate_card_sources->k = s and (
    (new.deliverables->idx->'platform',new.deliverables->idx->'type',new.deliverables->idx->'types',new.deliverables->idx->'type_lines') is distinct from
    (old.deliverables->idx->'platform',old.deliverables->idx->'type',old.deliverables->idx->'types',old.deliverables->idx->'type_lines')
    or new.deliverables->idx->'cost_currency' is distinct from old.deliverables->idx->'cost_currency'
    or case when coalesce(s->>'price_type','creator_cost')='creator_cost' then
      new.deliverables->idx->'cost' is distinct from old.deliverables->idx->'cost'
      or (new.deliverables is not distinct from old.deliverables and new.cost is distinct from old.cost)
    else
      new.deliverables->idx->'revenue' is distinct from old.deliverables->idx->'revenue'
      or (new.deliverables is not distinct from old.deliverables and new.revenue is distinct from old.revenue)
    end
    or (coalesce(s->>'price_type','creator_cost')='client_price' and (new.deliverables->idx->'af_pct' is distinct from old.deliverables->idx->'af_pct' or new.af_pct is distinct from old.af_pct))
    or new.cost_currency is distinct from old.cost_currency
  ) then
   new.rate_card_sources=jsonb_set(new.rate_card_sources,array[k,'manual_override'],'true'::jsonb);
  end if;
 end loop;
 if new.rate_card_sources is distinct from old.rate_card_sources then
  insert into public.audit_logs(action,entity_type,entity_id,actor_id,old_data,new_data,metadata)
  values('update','quotation_rate_card',new.id,auth.uid(),jsonb_build_object('sources',old.rate_card_sources,'cost',old.cost,'revenue',old.revenue,'af_pct',old.af_pct,'deliverables',old.deliverables),jsonb_build_object('sources',new.rate_card_sources,'cost',new.cost,'revenue',new.revenue,'af_pct',new.af_pct,'deliverables',new.deliverables),jsonb_build_object('quotation_id',new.quotation_id));
 end if;
 return new;
end $$;
create trigger quotation_rate_source_audit before update on public.quotation_items for each row execute function public.audit_quotation_rate_source();
commit;
