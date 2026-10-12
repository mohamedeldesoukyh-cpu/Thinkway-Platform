# Client/brand dependency protection

Run only in a disposable local PostgreSQL instance on 127.0.0.1:55439 as brand_test,
with a new database named brand_integrity_test. The SQL fixture refuses other database names.
It creates synthetic clients, brands, dependencies and authorization stubs; it is not a full
Supabase integration test and must never run on dev/shared/production databases.

1. Run psql -h 127.0.0.1 -p 55439 -U brand_test -d brand_integrity_test -f supabase/tests/brand-client/dependency-protection.sql
2. Run node supabase/tests/brand-client/concurrent-dependency.cjs (requires the Windows PostgreSQL 17 installation).
3. Stop the disposable PostgreSQL instance.

Coverage: typed confirmation, stale ownership, unused-brand move, unused-entity deletion,
campaign blocking, SET NULL/CASCADE blocking, RLS-hidden dependencies, missing permission,
portal denial, privileged MFA, and concurrent dependency insertion during reassignment.

Deployment order: verify migration 20261013190000 on dev first, deploy/verify the UI on dev,
then seek explicit live release approval. The migration is not applied to shared databases
by these tests. The actions fail closed when the RPC is unavailable.

Deletion requires removing or reassigning all inbound records via their own supported workflows.
It deliberately does not cascade-delete contacts, agreements, quotations or financial history.
Used-brand bulk transfer is not implemented; issued documents must not be rewritten.
Rare delete/move operations briefly lock referencing tables and fail on contention.
Normal brand edits do not take these locks.
