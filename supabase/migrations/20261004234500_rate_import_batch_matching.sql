-- Resolve all candidate links in one query, rather than scanning protected
-- account tables once per link. Keep SECURITY INVOKER and existing RLS.
create or replace function public.match_rate_card_handles(p_candidates jsonb)
returns table(match_key text, creator_ref text, creator_name text)
language sql stable security invoker set search_path=public as $$
 with candidates as materialized (
   select c->>'key' as match_key, lower(c->>'platform') as platform,
     lower(ltrim(c->>'handle','@')) as handle
   from jsonb_array_elements(p_candidates) c
   where public.rate_card_allowed('upload')
 )
 select c.match_key, 'inf:' || i.id::text, i.display_name
 from candidates c
 join public.influencer_platform_accounts a
   on lower(a.platform)=c.platform and lower(ltrim(a.handle,'@'))=c.handle
 join public.influencers i on i.id=a.influencer_id
 union
 select c.match_key,
   case when d.influencer_id is null then 'dis:' || d.id::text else 'inf:' || d.influencer_id::text end,
   coalesce(i.display_name,d.display_name)
 from candidates c
 join public.discovered_profiles d
   on lower(d.platform::text)=c.platform and lower(ltrim(d.username::text,'@'))=c.handle
 left join public.influencers i on i.id=d.influencer_id;
$$;
