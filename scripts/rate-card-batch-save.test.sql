-- Run using psql as migration role; all fixture changes roll back.
BEGIN;
SET LOCAL statement_timeout='30s';
select set_config('request.jwt.claim.sub',(select p.id::text from profiles p join roles r on r.id=p.role_id where r.slug='super_admin' limit 1),true) is not null as actor_ready;
CREATE TEMP TABLE qa_lines AS select jsonb_agg(jsonb_build_object('influencer_id',id,'creator_name','Import QA','platform','all','deliverable',d,'price_type',p,'amount',1000,'currency','EGP','package_key','qa','package_details','{"profiles": [{"platform":"instagram","handle":"qa"}]}'::jsonb)) as payload from (select id from influencers limit 49) i cross join unnest(array['package','usage_right','boosting']) d cross join unnest(array['creator_cost','client_price']) p;
GRANT SELECT ON qa_lines TO authenticated;
SET LOCAL ROLE authenticated;
DO $$ declare v uuid; h jsonb; stamp text; started timestamptz; begin
select jsonb_build_object('client_id',client_id,'name','Rollback import QA','version','V1','status','inactive') into h from rate_cards limit 1;
v=save_rate_card(h); select updated_at::text into stamp from rate_card_versions where id=v; started=clock_timestamp();
perform save_rate_card(null,v,null,(select payload from qa_lines),stamp,'upload');
raise notice '294 lines took %',clock_timestamp()-started;
if (select count(*) from rate_card_lines where version_id=v)<>294 then raise exception 'missing pricing entries';end if;
begin perform save_rate_card(null,v,null,(select payload from qa_lines),stamp,'upload');raise exception 'stale accepted';exception when others then if sqlerrm<>'stale' then raise;end if;end;
select updated_at::text into stamp from rate_card_versions where id=v;
perform set_rate_card_travel_uplifts(v,'{"tu_a_percent":10,"tu_b_percent":20,"itu_percent":30}',stamp);
select updated_at::text into stamp from rate_card_versions where id=v;
perform save_rate_card(null,v,null,(select payload from qa_lines),stamp,'upload');
if (select count(*) from rate_card_lines where version_id=v)<>294 or exists(select 1 from rate_card_lines where version_id=v and tu_a_percent<>10) then raise exception 'reimport lost data';end if;
select updated_at::text into stamp from rate_card_versions where id=v;
begin perform save_rate_card(null,v,null,(select jsonb_build_array(payload->0,payload->0) from qa_lines),stamp,'upload');raise exception 'duplicate accepted';exception when others then if sqlerrm<>'duplicate' then raise;end if;end;
perform save_rate_card(null,v,null,(select jsonb_build_array((payload->0)||jsonb_build_object('package_details',(payload->0->'package_details')||'{"name":"Updated"}'::jsonb)) from qa_lines),stamp,'upload');
if (select count(*) from rate_card_lines where version_id=v and package_details->>'name'='Updated')<>6 then raise exception 'sibling metadata not propagated';end if;
perform set_config('request.jwt.claim.sub','',true);
begin perform save_rate_card(h);raise exception 'anonymous accepted';exception when others then if sqlerrm<>'permission' and sqlstate<>'42501' then raise;end if;end;
raise notice 'count, retry, travel preservation, stale, duplicates, package propagation and authorization passed';
end $$;
ROLLBACK;



