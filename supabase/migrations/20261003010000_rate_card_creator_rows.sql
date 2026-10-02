begin;
create or replace view public.rate_card_creator_rows with (security_invoker=true) as
 select version_id,creator_ref,platform,min(creator_name) as creator_name,
 array_agg(distinct currency) as currencies,
 jsonb_agg(to_jsonb(m) order by deliverable,price_type) as rates
 from public.rate_card_line_metrics m
 group by version_id,creator_ref,platform;
grant select on public.rate_card_creator_rows to authenticated;
commit;
