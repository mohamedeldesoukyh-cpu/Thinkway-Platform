-- Dev integration test; fixture changes must never persist.
begin;
select set_config('request.jwt.claim.sub',(select p.id::text from public.profiles p join public.roles r on r.id=p.role_id where r.slug='super_admin' limit 1),true) is not null as actor_ready;
set local role authenticated;
do $$
declare v uuid; copied uuid; stamp text; header jsonb; lines jsonb; scope jsonb; actor text;
begin
 actor=auth.uid()::text;
 select jsonb_build_object('client_id',client_id,'name','Event travel rollback QA','version','V1','status','inactive') into header from rate_cards limit 1;
 v=save_rate_card(header);
 select jsonb_agg(to_jsonb(l)-array['id','version_id','creator_ref','created_at','updated_at']) into lines from rate_card_lines l where version_id='6eb08807-a1b3-4254-a53d-c3acd89573b2';
 select updated_at::text into stamp from rate_card_versions where id=v;
 perform save_rate_card(null,v,null,lines,stamp,'upload');
 select updated_at::text into stamp from rate_card_versions where id=v;
 perform set_rate_card_travel_uplifts(v,'{"tu_a_percent":10,"tu_b_percent":20,"itu_percent":30}',stamp);
 if exists(select 1 from rate_card_lines where version_id=v and (tu_a_percent<>10 or tu_b_percent<>20 or itu_percent<>30)) then raise exception 'bulk update incomplete';end if;
 begin perform set_rate_card_travel_uplifts(v,'{"tu_a_percent":40}',stamp);raise exception 'stale write accepted';exception when others then if sqlerrm<>'stale' then raise;end if;end;
 select updated_at::text into stamp from rate_card_versions where id=v;
 select jsonb_build_object('creator_ref',creator_ref,'platform',platform,'package_key',package_key) into scope from rate_card_lines where version_id=v limit 1;
 perform set_rate_card_travel_uplifts(v,'{"tu_a_percent":5,"itu_percent":null}',stamp,scope);
 if exists(select 1 from rate_card_lines where version_id=v and creator_ref=scope->>'creator_ref' and (tu_a_percent<>5 or itu_percent is not null)) then raise exception 'scoped update failed';end if;
 if exists(select 1 from rate_card_lines where version_id=v and creator_ref<>scope->>'creator_ref' and tu_a_percent<>10) then raise exception 'scope escaped';end if;
 select updated_at::text into stamp from rate_card_versions where id=v;
 perform save_rate_card(null,v,null,lines,stamp,'upload');
 if exists(select 1 from rate_card_lines where version_id=v and tu_b_percent<>20) then raise exception 'reimport lost travel';end if;
 lines=jsonb_build_array((lines->0)||'{"deliverable":"event_attendance","amount":8000,"event_days":3}'::jsonb);
 select updated_at::text into stamp from rate_card_versions where id=v;
 perform save_rate_card(null,v,null,lines,stamp,'upload');
 if not exists(select 1 from rate_card_line_metrics where version_id=v and event_days=3 and amount=8000 and tu_b_percent=20) then raise exception 'event save or inheritance failed';end if;
 select updated_at::text into stamp from rate_card_versions where id=v;
 copied=save_rate_card(header||'{"version":"V2"}',null,v,null,stamp);
 if not exists(select 1 from rate_card_lines where version_id=copied and event_days=3 and tu_b_percent=20) then raise exception 'copy lost fields';end if;
 begin perform set_rate_card_travel_uplifts(v,'{"tu_a_percent":-1}',stamp);raise exception 'invalid value accepted';exception when others then if sqlerrm<>'invalid' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform set_rate_card_travel_uplifts(v,'{"tu_a_percent":9}',stamp);raise exception 'unauthorized update accepted';exception when others then if sqlerrm<>'permission' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',actor,true);
end $$;
select 'Event days, all-row and scoped uplifts, stale protection, reimport, inheritance, version copy and permissions passed' as result;
rollback;
