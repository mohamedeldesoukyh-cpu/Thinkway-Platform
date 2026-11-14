begin;
insert into public.saved_report_templates(id,owner_id,name,configuration,visibility,shared_with) values
('f0000000-1111-4000-8000-000000000001','aaaaaaaa-00c1-4000-8000-000000000004','Report RLS test','{}','private','{}'),
('f0000000-1111-4000-8000-000000000002','aaaaaaaa-00c1-4000-8000-000000000004','Report RLS shared','{}','users',array['aaaaaaaa-00c1-4000-8000-000000000003']::uuid[]);
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-00c1-4000-8000-000000000003',true);
do $$ declare n int; begin
 select count(*) into n from public.saved_report_templates where id in ('f0000000-1111-4000-8000-000000000001','f0000000-1111-4000-8000-000000000002');
 if n <> 1 then raise exception 'Recipient should see only the shared report'; end if;
 update public.saved_report_templates set name='Unauthorized edit' where id='f0000000-1111-4000-8000-000000000002';
 get diagnostics n = row_count; if n <> 0 then raise exception 'Recipient edited owner report'; end if;
 insert into public.saved_report_favorites values ('aaaaaaaa-00c1-4000-8000-000000000003','f0000000-1111-4000-8000-000000000002',true);
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-00c1-4000-8000-000000000004',true);
do $$ declare n int; begin
 select count(*) into n from public.saved_report_favorites where report_id='f0000000-1111-4000-8000-000000000002';
 if n <> 0 then raise exception 'Favorites leaked across users'; end if;
 update public.saved_report_templates set name='Owner updated' where id='f0000000-1111-4000-8000-000000000001';
 get diagnostics n = row_count; if n <> 1 then raise exception 'Owner could not update report'; end if;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000001',true);
do $$ declare n int; begin
 select count(*) into n from public.saved_report_templates where id in ('f0000000-1111-4000-8000-000000000001','f0000000-1111-4000-8000-000000000002');
 if n <> 0 then raise exception 'Unrecognized user saw reports'; end if;
end $$;
rollback;
