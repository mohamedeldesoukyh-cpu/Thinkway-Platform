-- Isolated bootstrap database only. All fixtures roll back.
begin;
set local role authenticated;
do $$
declare v uuid; copied uuid; client uuid; creator uuid; stamp text; header jsonb; lines jsonb;
begin
 select id into client from clients limit 1; select id into creator from influencers limit 1;
 header=jsonb_build_object('client_id',client,'name','Period test','version','V1','status','inactive');
 v=save_rate_card(header);
 select updated_at::text into stamp from rate_card_versions where id=v;
 lines=jsonb_build_array(jsonb_build_object('influencer_id',creator,'creator_name','Test','platform','instagram','deliverable','usage_right','price_type','creator_cost','amount',100,'currency','EGP','period_months',2));
 perform save_rate_card(null,v,null,lines,stamp,'upload');
 if not exists(select 1 from rate_card_line_metrics where version_id=v and period_months=2 and amount=100) then raise exception 'period not saved';end if;
 select updated_at::text into stamp from rate_card_versions where id=v;
 copied=save_rate_card(header||'{"version":"V2"}'::jsonb,null,v,null,stamp);
 if not exists(select 1 from rate_card_lines where version_id=copied and period_months=2) then raise exception 'period not copied';end if;
 select updated_at::text into stamp from rate_card_versions where id=v;
 lines=jsonb_set(lines,'{0,period_months}','3');perform save_rate_card(null,v,null,lines,stamp,'upload');
 if (select count(*) from rate_card_lines where version_id=v)<>1 then raise exception 'period update duplicated rate';end if;
 if not exists(select 1 from rate_card_lines where version_id=v and period_months=3) then raise exception 'period not updated';end if;
 if not exists(select 1 from rate_card_lines where version_id=copied and period_months=2) then raise exception 'copied period changed';end if;
end $$;
rollback;
select 'Duration import, metrics, copy, update and version isolation passed' as result;
