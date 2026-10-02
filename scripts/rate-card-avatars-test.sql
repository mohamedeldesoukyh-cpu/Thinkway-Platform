-- Run only in the disposable rate_cards_test bootstrap database.
begin;
set local role authenticated;
do $$
declare card_a uuid;card_b uuid;creator uuid;photo text='data:image/webp;base64,UklGRg==';
begin
 select id into creator from influencers limit 1;
 insert into rate_cards(client_id,name) select id,'Avatar test A' from clients limit 1 returning id into card_a;
 insert into rate_cards(client_id,name) select id,'Avatar test B' from clients limit 1 returning id into card_b;
 insert into rate_card_creator_avatars(card_id,creator_ref,avatar_data) values(card_a,'inf:'||creator,photo);
 if exists(select 1 from rate_card_creator_avatars where card_id=card_b) then raise exception 'avatar leaked across cards';end if;
 if (select avatar_data from rate_card_creator_avatars where card_id=card_a)<>photo then raise exception 'avatar not saved';end if;
 perform set_config('test.admin','false',true);perform set_config('test.permissions','rate_cards.read',true);
 begin
  insert into rate_card_creator_avatars(card_id,creator_ref,avatar_data) values(card_b,'inf:'||creator,photo);
  raise exception 'read-only user wrote avatar';
 exception when insufficient_privilege then null;end;
 update rate_card_creator_avatars set avatar_data='data:image/webp;base64,QUFB' where card_id=card_a;
 if (select avatar_data from rate_card_creator_avatars where card_id=card_a)<>photo then raise exception 'read-only user updated avatar';end if;
 perform set_config('test.internal','false',true);
 if exists(select 1 from rate_card_creator_avatars) then raise exception 'portal avatar access';end if;
end $$;
rollback;
select 'Card-local avatar isolation and permissions passed' as result;
