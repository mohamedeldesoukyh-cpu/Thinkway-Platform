create table if not exists public.client_review_share_covers (
  review_id uuid primary key references public.campaign_client_reviews(id) on delete cascade,
  storage_path text not null,
  updated_at timestamptz not null default now()
);
alter table public.client_review_share_covers enable row level security;
revoke all on public.client_review_share_covers from anon, authenticated;
grant all on public.client_review_share_covers to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-review-covers', 'client-review-covers', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
