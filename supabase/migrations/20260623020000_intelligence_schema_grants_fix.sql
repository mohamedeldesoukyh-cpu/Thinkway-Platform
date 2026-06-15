-- Re-apply intelligence schema API access (PostgREST + service_role ETL).
-- Safe to run multiple times.

GRANT USAGE ON SCHEMA intelligence TO postgres, anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA intelligence TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA intelligence TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA intelligence TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA intelligence TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA intelligence
  GRANT SELECT ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA intelligence
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA intelligence
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA intelligence
  GRANT ALL ON SEQUENCES TO service_role;
