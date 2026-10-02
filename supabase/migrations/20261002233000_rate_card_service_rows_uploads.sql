begin;
create or replace view public.rate_card_service_rows with (security_invoker=true) as
 select version_id,creator_ref,platform,deliverable,min(creator_name) as creator_name,
 array_agg(distinct currency) as currencies,
 jsonb_agg(to_jsonb(m) order by price_type) as rates
 from public.rate_card_line_metrics m
 group by version_id,creator_ref,platform,deliverable;
grant select on public.rate_card_service_rows to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rate-card-imports','rate-card-imports',false,26214400,
 array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;
create policy rate_import_insert on storage.objects for insert to authenticated
with check(bucket_id='rate-card-imports' and (storage.foldername(name))[1]=auth.uid()::text and public.rate_card_allowed('upload'));
create policy rate_import_read on storage.objects for select to authenticated
using(bucket_id='rate-card-imports' and (storage.foldername(name))[1]=auth.uid()::text and public.rate_card_allowed('upload'));
create policy rate_import_delete on storage.objects for delete to authenticated
using(bucket_id='rate-card-imports' and (storage.foldername(name))[1]=auth.uid()::text and public.rate_card_allowed('upload'));
commit;
