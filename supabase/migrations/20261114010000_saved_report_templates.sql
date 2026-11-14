begin;
create table public.saved_report_templates (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  name text not null check (length(trim(name)) between 1 and 80),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  visibility text not null default 'private' check (visibility in ('private', 'all', 'users')),
  shared_with uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility <> 'users' or cardinality(shared_with) > 0)
);
create index saved_report_templates_owner on public.saved_report_templates(owner_id);
alter table public.saved_report_templates enable row level security;
create policy saved_reports_read on public.saved_report_templates for select to authenticated using (
  public.is_internal_user() and (public.is_admin() or public.has_permission('analytics.read'))
  and (owner_id = auth.uid() or public.is_admin() or visibility = 'all' or (visibility = 'users' and auth.uid() = any(shared_with)))
);
create policy saved_reports_insert on public.saved_report_templates for insert to authenticated with check (
  owner_id = auth.uid() and public.is_internal_user() and (public.is_admin() or public.has_permission('analytics.read'))
);
create policy saved_reports_update on public.saved_report_templates for update to authenticated
using (public.is_internal_user() and (public.is_admin() or (owner_id = auth.uid() and public.has_permission('analytics.read'))))
with check (public.is_internal_user() and (public.is_admin() or (owner_id = auth.uid() and public.has_permission('analytics.read'))));
create table public.saved_report_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.saved_report_templates(id) on delete cascade,
  favorite boolean not null default false,
  primary key (user_id, report_id)
);
alter table public.saved_report_favorites enable row level security;
create policy saved_report_favorites_own on public.saved_report_favorites for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.saved_report_templates t where t.id = report_id));
grant select, insert, update on public.saved_report_templates to authenticated;
grant select, insert, update, delete on public.saved_report_favorites to authenticated;
-- Report sharing exposes a saved layout only; underlying report data keeps its existing permissions.
create table public.builtin_report_settings (
  id text primary key check (id in ('overview','pnl','vr','client-profitability','revenue-by-function','spending-by-category','top-clients','top-influencers','statements','unsettled','daily')),
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 500),
  currency text not null default 'EGP' check (currency in ('EGP','USD','AED','SAR')),
  visibility text not null default 'all' check (visibility in ('all','users')),
  shared_with uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  check (visibility <> 'users' or cardinality(shared_with) > 0)
);
alter table public.builtin_report_settings enable row level security;
create policy builtin_reports_read on public.builtin_report_settings for select to authenticated using (public.is_internal_user());
create policy builtin_reports_admin on public.builtin_report_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.builtin_report_settings to authenticated;
commit;
