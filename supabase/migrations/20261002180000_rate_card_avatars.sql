-- Card-local presentation override. Never changes the creator directory or quotation prices.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create table public.rate_card_creator_avatars (
 card_id uuid not null references public.rate_cards(id) on delete cascade,
 creator_ref text not null check(creator_ref ~ '^(inf|dis):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 avatar_data text not null check(avatar_data like 'data:image/webp;base64,%' and length(avatar_data) <= 1000023),
 updated_at timestamptz not null default now(),
 primary key(card_id,creator_ref)
);
alter table public.rate_card_creator_avatars enable row level security;
alter table public.rate_card_creator_avatars force row level security;
create policy rca_read on public.rate_card_creator_avatars for select to authenticated
 using(exists(select 1 from public.rate_cards c where c.id=card_id));
create policy rca_create on public.rate_card_creator_avatars for insert to authenticated
 with check(public.rate_card_allowed('edit') and exists(select 1 from public.rate_cards c where c.id=card_id));
create policy rca_edit on public.rate_card_creator_avatars for update to authenticated
 using(public.rate_card_allowed('edit') and exists(select 1 from public.rate_cards c where c.id=card_id))
 with check(public.rate_card_allowed('edit') and exists(select 1 from public.rate_cards c where c.id=card_id));
create policy rca_delete on public.rate_card_creator_avatars for delete to authenticated
 using(public.rate_card_allowed('edit') and exists(select 1 from public.rate_cards c where c.id=card_id));
grant select,insert,update,delete on public.rate_card_creator_avatars to authenticated;
commit;
