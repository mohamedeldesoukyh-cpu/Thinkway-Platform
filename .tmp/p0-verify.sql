SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'guard_profile_privileged_columns';
SELECT id, public FROM storage.buckets WHERE id IN ('vendor-io-documents', 'client-io-documents');
SELECT version, name FROM supabase_migrations.schema_migrations WHERE version >= '20260625000000' ORDER BY version;
