-- One setting for the shared journey, including subsequent review versions.
create table public.client_workspace_tab_settings (
  workspace_id uuid primary key,
  hidden_tabs text[] not null default '{}',
  refresh_limit integer not null default 0 check (refresh_limit between 0 and 1000),
  refresh_used integer not null default 0 check (refresh_used >= 0),
  last_refresh_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint client_workspace_hidden_tabs_valid check (
    hidden_tabs <@ array['shortlist','creators','commercial','approval','overview']::text[]
    and cardinality(hidden_tabs) < 5
  )
);
alter table public.client_workspace_tab_settings enable row level security;
revoke all on public.client_workspace_tab_settings from anon, authenticated;
grant select, insert, update, delete on public.client_workspace_tab_settings to service_role;

create table public.client_workspace_refresh_requests (
  id uuid primary key,
  workspace_id uuid not null references public.client_workspace_tab_settings(workspace_id),
  campaign_id uuid not null references public.campaign_headers(id),
  created_at timestamptz not null default now(),
  status text not null default 'reserved' check (status in ('reserved','queued','failed'))
);
alter table public.client_workspace_refresh_requests enable row level security;
revoke all on public.client_workspace_refresh_requests from anon, authenticated;
grant select, insert, update on public.client_workspace_refresh_requests to service_role;

create function public.reserve_client_workspace_refresh(p_workspace_id uuid, p_campaign_id uuid, p_request_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare settings public.client_workspace_tab_settings%rowtype;
begin
  select * into settings from public.client_workspace_tab_settings where workspace_id = p_workspace_id for update;
  if not found then return false; end if;
  if exists (select 1 from public.client_workspace_refresh_requests where id = p_request_id) then
    return exists (select 1 from public.client_workspace_refresh_requests where id = p_request_id
      and workspace_id = p_workspace_id and campaign_id = p_campaign_id and status = 'reserved');
  end if;
  if settings.refresh_used >= settings.refresh_limit then return false; end if;
  if settings.last_refresh_at > now() - interval '5 minutes' then return false; end if;
  insert into public.client_workspace_refresh_requests(id, workspace_id, campaign_id)
    values (p_request_id, p_workspace_id, p_campaign_id);
  update public.client_workspace_tab_settings set refresh_used = refresh_used + 1,
    last_refresh_at = now(), updated_at = now() where workspace_id = p_workspace_id;
  return true;
end;
$$;
revoke all on function public.reserve_client_workspace_refresh(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_client_workspace_refresh(uuid, uuid, uuid) to service_role;
