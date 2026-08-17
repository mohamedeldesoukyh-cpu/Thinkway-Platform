#!/usr/bin/env bash
#
# Build the full local Supabase database for Thinkway development.
#
# Why this script exists:
#   - `supabase/schema.sql` is the LEGACY base schema (it has a `campaigns` table
#     and no `campaign_headers`).
#   - The 121 files in `supabase/migrations/` layer the current hierarchy on top,
#     but they are NOT linearly buildable from an empty database:
#       * migration 20260531140000 replaces the legacy `campaigns` TABLE with a
#         compatibility VIEW but never drops the table, and
#       * migration 20260531160000 uses public.write_audit_log() before it is
#         defined (in 20260531240000).
#   So `supabase start`/`db reset` cannot apply them directly (that is why
#   [db.migrations]/[db.seed] are disabled in supabase/config.toml).
#
# This script applies everything in the correct order against the local
# Supabase Postgres container, then reconciles document-number sequences and
# creates a super_admin user for local sign-in.
#
# Prerequisites: `supabase start` has been run (containers up). Docker available.
#
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-supabase_db_workspace}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPA_DIR="$REPO_ROOT/supabase"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@thinkway.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Thinkway123!}"
API_URL="${API_URL:-http://127.0.0.1:54321}"
# Standard local Supabase demo keys (deterministic for the default config).
ANON_KEY="${ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

psql_file() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$1"; }
psql_cmd()  { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres "$@"; }

echo "==> Resetting public + intelligence schemas (idempotent re-runs)"
psql_cmd -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS intelligence CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO anon, authenticated, service_role; GRANT USAGE ON SCHEMA public TO anon, authenticated;" >/dev/null

echo "==> Clearing app-defined storage policies/buckets (local stack ships none by default)"
psql_cmd -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
SET session_replication_role = replica;  -- bypass storage.protect_delete() trigger
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='buckets' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.buckets', p.policyname);
  END LOOP;
  DELETE FROM storage.objects;
  DELETE FROM storage.buckets;
END $$;
SET session_replication_role = origin;
SQL

echo "==> Applying schema.sql (legacy base)"
psql_file "$SUPA_DIR/schema.sql" >/dev/null

echo "==> Dropping legacy campaigns table (migration 20260531140000 turns it into a view)"
psql_cmd -c "DROP TABLE IF EXISTS public.campaigns CASCADE;" >/dev/null

echo "==> Pre-defining write_audit_log() (forward-referenced by migration 20260531160000)"
psql_file "$SUPA_DIR/migrations/20260531250000_normalize_audit_action_writes.sql" >/dev/null

echo "==> Applying $(ls "$SUPA_DIR"/migrations/*.sql | wc -l | tr -d ' ') migrations in order"
for f in $(ls "$SUPA_DIR"/migrations/*.sql | sort); do
  psql_file "$f" >/dev/null
done

echo "==> Applying policies.sql (the 4 'campaigns is not a table' errors are expected; it is a view)"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$SUPA_DIR/policies.sql" >/dev/null 2>&1 || true

echo "==> Applying storage.sql and seed.sql"
psql_file "$SUPA_DIR/storage.sql" >/dev/null
psql_file "$SUPA_DIR/seed.sql" >/dev/null

echo "==> Reconciling document-number sequences with seeded data"
psql_cmd -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$
DECLARE
  pairs text[][] := ARRAY[
    ['clients','CLT'],['influencers','INF'],['deliverables','DLV'],['payments','PAY'],
    ['approvals','APR'],['groups','GRP'],['brands','BRD'],['agencies','AGY'],
    ['vendor_payment_batches','VPB'],['financial_approval_requests','FAR'],['finance_posting_batches','FPB']
  ];
  r text[]; v_max bigint;
BEGIN
  FOREACH r SLICE 1 IN ARRAY pairs LOOP
    EXECUTE format(
      'SELECT COALESCE(MAX(regexp_replace(document_number, ''^%s-'', '''')::bigint),0) FROM public.%I WHERE document_number ~ ''^%s-[0-9]+$''',
      r[2], r[1], r[2]
    ) INTO v_max;
    INSERT INTO public.document_sequences(prefix, last_value) VALUES (r[2], v_max)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = GREATEST(public.document_sequences.last_value, EXCLUDED.last_value), updated_at = now();
  END LOOP;
END $$;
SQL

echo "==> Creating local super_admin user ($ADMIN_EMAIL)"
# Create the auth user (ignored if it already exists from a previous run).
curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Thinkway Admin\"}}" >/dev/null || true
# Ensure a matching profile exists and is promoted to super_admin. The
# handle_new_user trigger only fires on INSERT into auth.users, so on a schema
# rebuild (where public.profiles was recreated) we upsert the profile here.
psql_cmd -v ON_ERROR_STOP=1 -c "
INSERT INTO public.profiles (id, email, full_name, role_id, status)
SELECT u.id, u.email, 'Thinkway Admin', (SELECT id FROM public.roles WHERE slug='super_admin'), 'active'
FROM auth.users u WHERE u.email='$ADMIN_EMAIL'
ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id, status='active';" >/dev/null

echo "==> Writing .env.local"
cat > "$REPO_ROOT/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo "==> Done. Local Supabase DB is ready. Sign in with $ADMIN_EMAIL / $ADMIN_PASSWORD"
