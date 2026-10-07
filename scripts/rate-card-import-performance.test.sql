-- Run against dev using psql as migration role. All fixtures roll back.
-- Each import is its own statement with the same eight-second API limit.
\timing on
BEGIN;
SET LOCAL statement_timeout='8s';
select set_config('request.jwt.claim.sub',(select p.id::text from profiles p join roles r on r.id=p.role_id where r.slug='super_admin' limit 1),true) is not null as actor_ready;
CREATE TEMP TABLE qa_lines AS
 select jsonb_agg(jsonb_build_object('influencer_id',id,'creator_name','Bulk import regression',
 'platform','all','deliverable',d,'price_type',p,'amount',1000,'currency','EGP',
 'period_months',case when d in ('usage_right','boosting') then 1 else 0 end,
 'event_days',2,'package_key','bulk-qa','package_details','{"profiles":[{"platform":"instagram","handle":"qa"}]}'::jsonb)) payload
 from (select id from influencers order by id limit 269) i
 cross join unnest(array['package','usage_right','boosting','event_attendance']) d
 cross join unnest(array['creator_cost','client_price']) p;
CREATE TEMP TABLE qa_versions(id uuid, stamp text, copy_id uuid);
GRANT ALL ON qa_lines,qa_versions TO authenticated;
SET LOCAL ROLE authenticated;
insert into qa_versions(id) select save_rate_card(jsonb_build_object('client_id',(select client_id from rate_cards limit 1),'name','Rollback bulk QA','version','V1','status','inactive'));
update qa_versions set stamp=(select updated_at::text from rate_card_versions where id=qa_versions.id);
select save_rate_card(null,id,null,(select payload from qa_lines),stamp,'upload') from qa_versions;
DO $$ begin
 if (select count(*) from rate_card_lines where version_id=(select id from qa_versions))<>2152 then raise exception 'missing rates'; end if;
 if (select count(*) from rate_card_lines where version_id=(select id from qa_versions) and deliverable='event_attendance' and event_days=2)<>538 then raise exception 'missing event rates';end if;
 begin
  perform save_rate_card(null,id,null,(select payload from qa_lines),stamp,'upload') from qa_versions;
  raise exception 'stale accepted';
 exception when others then if sqlerrm<>'stale' then raise;end if;end;
end $$;
update qa_versions set stamp=(select updated_at::text from rate_card_versions where id=qa_versions.id);
select set_rate_card_travel_uplifts(id,'{"tu_a_percent":10,"tu_b_percent":20,"itu_percent":30}',stamp) from qa_versions;
update qa_versions set stamp=(select updated_at::text from rate_card_versions where id=qa_versions.id);
select save_rate_card(null,id,null,(select payload from qa_lines),stamp,'upload') from qa_versions;
DO $$ begin
 if exists(select 1 from rate_card_lines where version_id=(select id from qa_versions) and (tu_a_percent is distinct from 10 or tu_b_percent is distinct from 20 or itu_percent is distinct from 30)) then raise exception 'uplifts lost';end if;
end $$;
update qa_versions set stamp=(select updated_at::text from rate_card_versions where id=qa_versions.id);
update qa_versions set copy_id=save_rate_card(jsonb_build_object('version','V2','status','inactive'),null,id,(select payload from qa_lines),stamp,'upload');
DO $$ begin
 if (select count(*) from rate_card_lines where version_id=(select copy_id from qa_versions))<>2152 then raise exception 'copy lost rates';end if;
end $$;
-- Force a failure after an earlier valid row: no partial update may survive.
update qa_versions set stamp=(select updated_at::text from rate_card_versions where id=qa_versions.id);
DO $$ declare bad jsonb; begin
 select jsonb_build_array((payload->0)||'{"amount":999}',(payload->1)||'{"amount":-1}') into bad from qa_lines;
 begin
  perform save_rate_card(null,id,null,bad,stamp,'upload') from qa_versions;
  raise exception 'invalid amount accepted';
 exception when check_violation then null;end;
 if exists(select 1 from rate_card_lines where version_id=(select id from qa_versions) and amount<>1000) then raise exception 'partial update persisted';end if;
 if exists(select 1 from rate_card_versions v join qa_versions q on q.id=v.id where v.updated_at<>q.stamp::timestamptz) then raise exception 'failed write changed version';end if;
end $$;
-- Single-row and multi-version changes still invalidate all affected versions.
delete from rate_card_lines where id in (select min(id::text)::uuid from rate_card_lines where version_id in (select id from qa_versions union select copy_id from qa_versions) group by version_id);
RESET ROLE;
DO $$ declare card uuid; begin
 select card_id into card from rate_card_versions where id=(select id from qa_versions);
 if (select count(*) from audit_logs where entity_type='rate_card_lines' and action='create' and metadata->>'version_id'=(select id::text from qa_versions))<>2152 then raise exception 'missing line audit';end if;
 if (select count(*) from audit_logs where entity_type='rate_card_versions' and action='update' and metadata->>'card_id'=card::text)>12 then raise exception 'per-row version updates regressed';end if;
 if (select count(*) from audit_logs where entity_type='rate_card_lines' and action='delete' and metadata->>'card_id'=card::text)<>2 then raise exception 'missing delete audit';end if;
 raise notice 'PASS: 269 creators, 2152 rates, copy/update, events, travel preservation, stale checks, atomic rollback, audit counts';
end $$;
SET LOCAL ROLE authenticated;
select set_config('request.jwt.claim.sub','',true);
DO $$ begin
 if exists(select 1 from rate_card_lines where version_id=(select id from qa_versions)) then raise exception 'unauthorized read';end if;
 begin
  perform save_rate_card(null,id,null,(select payload from qa_lines),stamp,'upload') from qa_versions;
  raise exception 'unauthorized upload accepted';
 exception when no_data_found or insufficient_privilege then null;end;
 raise notice 'PASS: unauthorized reads and writes rejected';
end $$;
ROLLBACK;
