<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Thinkway is a single Next.js 16 (App Router) app backed by Supabase (Postgres + Auth + Storage). For local development it runs against a **self-contained local Supabase stack** (Docker + Supabase CLI) — there is no committed hosted config, so no external secrets are required.

### Node / package manager
- Use Node **22.22.2 via nvm** (`export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`). The default `/exec-daemon/node` is 22.14.0, below the repo's `engines` floor of `>=22.17.0`.
- Install deps with **`npm install`**, not `npm ci` — the committed `package-lock.json` is out of sync with `package.json` (missing proxy-agent transitive deps), so `npm ci` fails.

### Local Supabase + database (required to run the app)
- The app throws at import if `NEXT_PUBLIC_SUPABASE_URL` / anon key are unset, so the DB must be up before `npm run dev`.
- Startup sequence (services, not part of the dependency update script):
  1. Ensure the Docker daemon is running (this VM has no systemd): `sudo dockerd &` if `docker info` fails, then `sudo chmod 666 /var/run/docker.sock`.
  2. `npx supabase start` (Studio 54323, API 54321, DB 54322).
  3. `bash scripts/setup-local-supabase-db.sh` — builds the full schema and writes `.env.local`.
- **Do not rely on `supabase start`/`db reset` to apply migrations.** `supabase/schema.sql` is the legacy base (has a `campaigns` table, no `campaign_headers`) and the 121 `supabase/migrations/` are NOT linearly buildable from empty (a legacy `campaigns` table→view swap that never drops the table, plus `write_audit_log()` used before it is defined). `[db.migrations]`/`[db.seed]` are therefore disabled in `supabase/config.toml`; `scripts/setup-local-supabase-db.sh` applies schema → migrations → `policies.sql` → `storage.sql` → `seed.sql` in the correct order, reconciles document-number sequences, and creates a super_admin. It is idempotent (safe to re-run).
- Local sign-in: **admin@thinkway.local / Thinkway123!** (super_admin). The `.env.local` uses the standard local Supabase demo keys.
- Gotcha: fresh migrations seed a `Default Group` (`GRP-000001`) without bumping `public.document_sequences`, so entity creation would hit a duplicate `document_number`. The bootstrap reconciles sequences to fix this; if you re-seed data manually, re-run the bootstrap or bump `document_sequences`.

### Run / lint / test / build
- Run: `npm run dev` (http://localhost:3000; `/` redirects to `/login`).
- Lint: `npm run lint` (works, but the repo currently has pre-existing lint errors/warnings, mostly under `scripts/`).
- Tests: `npm run test:services` is the CI test command; there are many other granular `test:*` scripts (all `tsx`-based, no DB needed).
- Build: `npm run build` (Turbopack).
- Optional discovery worker (BullMQ/Redis + Playwright) lives in `services/discovery-worker/` and is not needed for core app work; it degrades gracefully when `REDIS_URL` is unset.

### Known UI quirk (pre-existing, not env-related)
- The New Group dialog's client-side name check can transiently show "A group with this name already exists" while typing (even on an empty field); server-side creation still succeeds and persists.
