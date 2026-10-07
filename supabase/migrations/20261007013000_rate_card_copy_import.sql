-- Build new versions without copying prices that the upload will replace.
-- Unmatched source lines and manual travel uplifts are preserved.
begin;
set local lock_timeout='5s';
create or replace function public.save_rate_card(p_header jsonb, p_version_id uuid default null, p_copy_id uuid default null, p_lines jsonb default null, p_expected text default null, p_operation text default 'upload')
returns uuid language plpgsql security invoker set search_path=public as $$
declare cid uuid; vid uuid; v public.rate_card_versions;
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
   insert into public.rate_card_lines(version_id,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent,period_months,package_key,package_details,event_days,tu_a_percent,tu_b_percent,itu_percent)
   select vid,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent,period_months,package_key,package_details,event_days,tu_a_percent,tu_b_percent,itu_percent from public.rate_card_lines source where version_id=p_copy_id
    and not exists (
     select 1 from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) incoming(l)
     where source.creator_ref=case when l->>'influencer_id' is not null then 'inf:'||(l->>'influencer_id') else 'dis:'||(l->>'profile_id') end
      and source.platform=l->>'platform' and source.deliverable=l->>'deliverable'
      and source.price_type=l->>'price_type' and source.package_key=coalesce(l->>'package_key','')
    );
  end if;
 end if;
 if p_lines is not null then
  if p_operation not in ('upload','pricing') or not public.rate_card_allowed(case when p_operation='pricing' then 'edit' else 'upload' end) then raise exception 'permission'; end if;
  if jsonb_array_length(p_lines)>40000 then raise exception 'file';end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'influencer_id',x->>'profile_id',x->>'platform',x->>'deliverable',x->>'price_type',coalesce(x->>'package_key','') having count(*)>1) then raise exception 'duplicate';end if;
  perform set_config('rate_cards.operation',p_operation,true);

   insert into public.rate_card_lines(version_id,influencer_id,profile_id,creator_name,platform,deliverable,price_type,amount,currency,notes,agency_fee_percent,period_months,package_key,package_details,event_days,tu_a_percent,tu_b_percent,itu_percent)
   select vid,(l->>'influencer_id')::uuid,(l->>'profile_id')::uuid,l->>'creator_name',l->>'platform',l->>'deliverable',l->>'price_type',(l->>'amount')::numeric,l->>'currency',coalesce(l->>'notes',''),(l->>'agency_fee_percent')::numeric,coalesce((l->>'period_months')::integer,0),coalesce(l->>'package_key',''),nullif(l->'package_details','null'::jsonb),coalesce((l->>'event_days')::integer,1),prior.tu_a_percent,prior.tu_b_percent,prior.itu_percent
   from jsonb_array_elements(p_lines) as input(l)
   left join lateral (
    select old.tu_a_percent,old.tu_b_percent,old.itu_percent
    from public.rate_card_lines old
    where p_copy_id is not null and p_version_id is null and old.version_id=p_copy_id
     and old.creator_ref=case when l->>'influencer_id' is not null then 'inf:'||(l->>'influencer_id') else 'dis:'||(l->>'profile_id') end
     and old.platform=l->>'platform' and old.package_key=coalesce(l->>'package_key','')
    -- Preserve this price's uplifts; new extras inherit the existing offer's.
    order by (old.deliverable=l->>'deliverable' and old.price_type=l->>'price_type') desc,old.id
    limit 1
   ) prior on true
   on conflict(version_id,creator_ref,platform,deliverable,price_type,package_key) do update set amount=excluded.amount,currency=excluded.currency,notes=excluded.notes,creator_name=excluded.creator_name,agency_fee_percent=excluded.agency_fee_percent,period_months=excluded.period_months,package_details=excluded.package_details,event_days=excluded.event_days
   where (rate_card_lines.amount,rate_card_lines.currency,rate_card_lines.notes,rate_card_lines.creator_name,
    rate_card_lines.agency_fee_percent,rate_card_lines.period_months,rate_card_lines.package_details,rate_card_lines.event_days)
   is distinct from (excluded.amount,excluded.currency,excluded.notes,excluded.creator_name,
    excluded.agency_fee_percent,excluded.period_months,excluded.package_details,excluded.event_days);
  -- Propagate package metadata once per offer, preserving last input wins.
  -- Unchanged siblings must not trigger repeated audit/version updates.
  with offers as (
   select distinct on (l->>'influencer_id',l->>'profile_id',l->>'package_key')
    (l->>'influencer_id')::uuid influencer_id,(l->>'profile_id')::uuid profile_id,
    l->>'package_key' package_key,l->'package_details' details
   from jsonb_array_elements(p_lines) with ordinality as input(l,n)
   where coalesce(l->>'package_key','')<>''
   order by l->>'influencer_id',l->>'profile_id',l->>'package_key',n desc
  )
  update public.rate_card_lines target set package_details=offers.details from offers
  where target.version_id=vid and target.package_key=offers.package_key
   and (target.influencer_id=offers.influencer_id or target.profile_id=offers.profile_id)
   and target.package_details is distinct from offers.details;
 end if;
 return vid;
end $$;
notify pgrst,'reload schema';
commit;
