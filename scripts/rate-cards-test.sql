-- Run after test-bootstrap and the migration, on a disposable database only.
set role authenticated;
do $$
declare cid uuid; bid uuid; creator uuid; vid uuid; copied uuid; qid uuid; stamp text; h jsonb; snap jsonb;
begin
 insert into clients(name) values('Test Client') returning id into cid;
 insert into brands(name,client_id) values('Test Brand',cid) returning id into bid;
 insert into influencers(display_name) values('Creator') returning id into creator;
 insert into md_currencies(code) values('EGP');
 h=jsonb_build_object('client_id',cid,'brand_id',bid,'name','Test card','version','V1','status','active');
 vid=save_rate_card(h);
 insert into rate_card_lines(version_id,influencer_id,creator_name,platform,deliverable,amount,currency,price_type) values(vid,creator,'Creator','instagram','instagram_reel',100000,'EGP','creator_cost');
 select updated_at::text into stamp from rate_card_versions where id=vid;
 copied=save_rate_card(h||'{"version":"V2","status":"inactive"}'::jsonb,null,vid,null,stamp);
 if(select count(*) from rate_card_lines where version_id=copied)<>1 then raise exception 'copy failed';end if;
 begin perform save_rate_card(h,vid,null,null,'2000-01-01');raise exception 'stale accepted';exception when others then if sqlerrm<>'stale' then raise;end if;end;
 snap=jsonb_build_object('0',jsonb_build_object('name','Test card','version','V1','amount',100000,'currency','EGP'));
 insert into quotation_items(quotation_id,cost,cost_currency,deliverables,rate_card_sources) values(gen_random_uuid(),100000,'EGP','[{"cost":100000,"cost_currency":"EGP","platform":"instagram","type":"instagram_reel"}]',snap) returning id into qid;
 update rate_card_lines set amount=120000 where version_id=vid;
 if(select cost from quotation_items where id=qid)<>100000 then raise exception 'retroactive edit';end if;
 delete from rate_card_versions where id=vid;
 if(select rate_card_sources from quotation_items where id=qid)<>snap then raise exception 'snapshot deleted';end if;
 update quotation_items set cost=95000,deliverables='[{"cost":95000,"cost_currency":"EGP","platform":"instagram","type":"instagram_reel"}]' where id=qid;
 if(select rate_card_sources->'0'->>'manual_override' from quotation_items where id=qid)<>'true' then raise exception 'manual override missing';end if;
 if not exists(select 1 from audit_logs where entity_type='quotation_rate_card' and entity_id=qid) then raise exception 'audit missing';end if;
 -- A bad import rolls back all rows and preserves the earlier version.
 select updated_at::text into stamp from rate_card_versions where id=copied;
 begin
  perform save_rate_card(null,copied,null,jsonb_build_array(jsonb_build_object('influencer_id',creator,'creator_name','Creator','platform','instagram','deliverable','instagram_story','price_type','creator_cost','amount',30000,'currency','EGP'),jsonb_build_object('influencer_id',creator,'creator_name','Creator','platform','instagram','deliverable','instagram_live','price_type','creator_cost','amount',30000,'currency','BAD')),stamp);
  raise exception 'bad currency accepted';
 exception when foreign_key_violation then null;end;
 if(select count(*) from rate_card_lines where version_id=copied)<>1 then raise exception 'partial import';end if;
 -- The exact handle resolver cannot merge two different creators with the same name.
 insert into influencer_platform_accounts(influencer_id,platform,handle) values(creator,'instagram','@creator');
 if(select count(*) from match_rate_card_handle('instagram','creator'))<>1 then raise exception 'handle match';end if;
 if(select count(*) from match_rate_card_handle('tiktok','creator'))<>0 then raise exception 'cross-platform match';end if;
 if(select count(*) from filter_rate_card_versions('Creator','instagram'))<>1 then raise exception 'filter failed';end if;
 -- Lock checking happens in the same transaction as source assignment.
 insert into quotations(id,status) select quotation_id,'approved' from quotation_items where id=qid;
 begin update quotation_items set rate_card_sources=jsonb_set(rate_card_sources,'{0,version}','"V2"') where id=qid;raise exception 'approved quotation edited';exception when others then if sqlerrm<>'quotation_locked' then raise;end if;end;
 -- Read-only actors cannot modify reference pricing or activate a version.
 perform set_config('test.admin','false',true);perform set_config('test.permissions','rate_cards.read',true);
 begin perform save_rate_card(h);raise exception 'unauthorized create';exception when others then if sqlerrm<>'permission' then raise;end if;end;
 if not exists(select 1 from rate_card_register where id=copied) then raise exception 'read denied';end if;
 -- Activation-only permission cannot edit the version name.
 perform set_config('test.permissions','rate_cards.read,rate_cards.activate',true);
 begin update rate_card_versions set version='injected' where id=copied;raise exception 'activation permission escalated';exception when others then if sqlerrm<>'permission' then raise;end if;end;
 perform set_config('test.internal','false',true);
 if exists(select 1 from rate_card_register) then raise exception 'portal access';end if;
end $$;
reset role;
select 'Rate card database invariants passed' as result;
