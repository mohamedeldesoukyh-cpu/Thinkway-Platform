-- Test fixture ONLY: run against a fresh disposable PostgreSQL database.
do $$ begin
 if current_database() not like 'rate_cards_test%' then raise exception 'Use a disposable rate_cards_test database'; end if;
 begin create role authenticated; exception when duplicate_object then null; end;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
create function public.is_internal_user() returns boolean language sql stable as $$ select coalesce(current_setting('test.internal',true),'true')='true' $$;
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'true')='true' $$;
create function public.has_permission(p text) returns boolean language sql stable as $$ select p=any(string_to_array(coalesce(current_setting('test.permissions',true),''),',')) $$;
create type public.audit_action as enum('create','update','delete');
create table public.permissions(id uuid primary key default gen_random_uuid(),slug text unique,resource text,action text,description text);
create table public.roles(id uuid primary key default gen_random_uuid(),slug text unique);
create table public.role_permissions(role_id uuid,permission_id uuid,unique(role_id,permission_id));
create table public.clients(id uuid primary key default gen_random_uuid(),name text);
create table public.brands(id uuid primary key default gen_random_uuid(),client_id uuid references clients,name text);
create table public.influencers(id uuid primary key default gen_random_uuid(),display_name text);
create table public.discovered_profiles(id uuid primary key default gen_random_uuid(),display_name text,platform text,username text,influencer_id uuid references influencers);
create table public.influencer_platform_accounts(id uuid primary key default gen_random_uuid(),influencer_id uuid references influencers,platform text,handle text);
create table public.md_currencies(code text primary key,is_active boolean default true);
create table public.audit_logs(id uuid primary key default gen_random_uuid(),action audit_action,entity_type text,entity_id uuid,actor_id uuid,old_data jsonb,new_data jsonb,metadata jsonb,created_at timestamptz default now());
create table public.quotations(id uuid primary key default gen_random_uuid(),status text);
create table public.quotation_items(id uuid primary key default gen_random_uuid(),quotation_id uuid,cost numeric,revenue numeric,af_pct numeric,cost_currency text,deliverables jsonb);
grant usage on schema public,auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
