-- Preserve individual rates while storing scoped creator packages and their separate extras.
begin;
set local lock_timeout='5s';
alter table public.rate_card_lines add column if not exists package_key text not null default '';
alter table public.rate_card_lines add column if not exists package_details jsonb;
alter table public.rate_card_lines add constraint rate_card_package_scope check (
 (package_key='' and package_details is null and deliverable<>'package') or
 (package_key ~ '^[a-z0-9][a-z0-9_-]{0,49}$' and package_details is not null and jsonb_typeof(package_details)='object' and platform='all'
 and deliverable in ('package','usage_right','boosting','event_attendance')
 and jsonb_typeof(package_details->'profiles')='array' and jsonb_array_length(package_details->'profiles') between 1 and 3)
);
do $$ declare constraint_name text; begin
 select conname into constraint_name from pg_constraint where conrelid='public.rate_card_lines'::regclass and contype='u'
 and pg_get_constraintdef(oid)='UNIQUE (version_id, creator_ref, platform, deliverable, price_type)';
 if constraint_name is not null then execute format('alter table public.rate_card_lines drop constraint %I',constraint_name); end if;
end $$;
alter table public.rate_card_lines add constraint rate_card_lines_package_unique unique(version_id,creator_ref,platform,deliverable,price_type,package_key);
-- Preserve existing view column order and append the new duration column.
create or replace view public.rate_card_line_metrics with (security_invoker=true) as
select l.id,l.version_id,l.influencer_id,l.profile_id,l.creator_ref,l.creator_name,l.platform,l.deliverable,l.price_type,l.agency_fee_percent,l.amount,l.currency,l.notes,
c.amount as creator_cost,p.amount as client_price,c.currency as creator_currency,p.currency as client_currency,
case when c.currency=p.currency and p.amount<>0 then round((p.amount-c.amount)/p.amount*100,4) end as gp_percent,
case when c.currency=p.currency and c.amount<>0 then round((p.amount-c.amount)/c.amount*100,4) end as markup_percent,l.period_months,l.package_key,l.package_details
from public.rate_card_lines l
left join public.rate_card_lines c on c.version_id=l.version_id and c.creator_ref=l.creator_ref and c.platform=l.platform and c.deliverable=l.deliverable and c.price_type='creator_cost' and c.package_key=l.package_key
left join public.rate_card_lines p on p.version_id=l.version_id and p.creator_ref=l.creator_ref and p.platform=l.platform and p.deliverable=l.deliverable and p.price_type='client_price' and p.package_key=l.package_key;
create or replace function public.save_rate_card(p_header jsonb, p_version_id uuid default null, p_copy_id uuid default null, p_lines jsonb default null, p_expected text default null, p_operation text default 'upload')
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
   insert into public.rate_card_lines(version_id,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent,period_months,package_key,package_details)
   select vid,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent,period_months,package_key,package_details from public.rate_card_lines where version_id=p_copy_id;
  end if;
 end if;
 if p_lines is not null then
  if p_operation not in ('upload','pricing') or not public.rate_card_allowed(case when p_operation='pricing' then 'edit' else 'upload' end) then raise exception 'permission'; end if;
  if jsonb_array_length(p_lines)>40000 then raise exception 'file';end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'influencer_id',x->>'profile_id',x->>'platform',x->>'deliverable',x->>'price_type',coalesce(x->>'package_key','') having count(*)>1) then raise exception 'duplicate';end if;
  perform set_config('rate_cards.operation',p_operation,true);
  for l in select * from jsonb_array_elements(p_lines) loop
   insert into public.rate_card_lines(version_id,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent,period_months,package_key,package_details)
   values(vid,(l->>'influencer_id')::uuid,(l->>'profile_id')::uuid,l->>'creator_name',l->>'platform',l->>'deliverable',l->>'price_type',(l->>'amount')::numeric,l->>'currency',coalesce(l->>'notes',''),(l->>'agency_fee_percent')::numeric,coalesce((l->>'period_months')::integer,0),coalesce(l->>'package_key',''),nullif(l->'package_details','null'::jsonb))
   on conflict(version_id,creator_ref,platform,deliverable,price_type,package_key) do update set amount=excluded.amount,currency=excluded.currency,notes=excluded.notes,creator_name=excluded.creator_name,agency_fee_percent=excluded.agency_fee_percent,period_months=excluded.period_months,package_details=excluded.package_details;
   if coalesce(l->>'package_key','')<>'' then
    update public.rate_card_lines set package_details=l->'package_details' where version_id=vid and package_key=l->>'package_key'
     and (influencer_id=(l->>'influencer_id')::uuid or profile_id=(l->>'profile_id')::uuid);
   end if;
  end loop;
 end if;
 return vid;
end $$;

commit;
