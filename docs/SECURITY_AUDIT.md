# Security Audit — Thinkway Platform

**Scope:** Codebase review for production go-live (documentation only; no code changes).  
**Reviewed:** Jun 2026  
**Sources:** `supabase/migrations/`, `supabase/policies.sql`, `supabase/storage.sql`, `lib/auth/`, `lib/supabase/`, `middleware.ts`, `app/api/`, `features/**/actions.ts`

---

## Executive summary

Thinkway has a **mature RLS-first data model** with permission helpers (`has_permission`, `can_access_client`, `can_access_campaign_header`), FORCE RLS on sensitive tables, and invoice RLS hardening (`20260531620000_billing_invoice_rls_hardening.sql`). Authentication uses Supabase SSR with middleware session refresh and `getUser()` (not `getSession()`) on the server.

**Blockers before unrestricted production:** potential **profile role self-escalation**, **public IO document storage buckets**, **production app still aligned to thinkway-dev Supabase** (`hsxrewjcbvmbkqdlzjhs`), inconsistent **application-layer permission checks** on some server actions/API routes, and **no `.env.example`** or centralized secrets documentation.

---

## 1. Supabase RLS

### What exists

| Area | Evidence | Assessment |
|------|----------|------------|
| Core entities | `supabase/policies.sql` — clients, campaigns, profiles, invoices, deliverables | Permission + scope checks |
| Enterprise hierarchy | `20260531140000_enterprise_hierarchy.sql` — FORCE RLS on groups, brands, campaign_headers, campaign_lines | Strong |
| Billing / invoices | `20260531620000_billing_invoice_rls_hardening.sql` — removed permissive dashboard policies; `can_write_invoice_line_items()` / `can_read_invoice_line_items()` | Hardened after audit |
| IO system | `20260603001000_thinkway_io_system.sql` — vendor_ios, client_ios, io_notifications | FORCE RLS |
| Finance governance | `20260531180000_operations_finance_governance.sql`, `20260610010000_finance_control_architecture.sql` | Movement batches, financial periods |
| Settings / invites | `20260603020000_settings_user_management.sql` — user_invites, access_logs | Admin-gated |
| Intelligence warehouse | `20260623010000_intelligence_warehouse.sql` — separate schema + grants fix | Role-scoped |
| Discovery | `20260611010000_discovery_engine.sql` — 20+ policies | Internal roles |

**Helper functions** (SECURITY DEFINER, `search_path = public`): `get_user_role_slug()`, `has_permission()`, `is_admin()`, `is_internal_user()`, `can_access_client()`, `can_access_campaign_header()` — defined in `supabase/schema.sql` and extended in migrations.

**FORCE RLS** applied to high-value tables (groups, brands, campaign_headers/lines, vendor_ios, client_ios, invoice-related tables, portal tables) preventing owner bypass.

### Gaps / risks

| ID | Finding | Risk | Remediation |
|----|---------|------|-------------|
| RLS-01 | Not all 73 migrations re-declared in `policies.sql`; production depends on migration order being fully applied | **Medium** | Run `npx supabase migration list`; verify Local = Remote for all `202605*` / `202606*` |
| RLS-02 | Migration comment documents **rogue permissive invoice policies** once existed in production outside repo | **High** (if not re-applied) | Confirm `20260531620000` applied on prod DB; run `supabase/debug/invoice_line_items_rls_audit.sql` |
| RLS-03 | Intelligence ETL uses service role and bypasses RLS by design | **Medium** | Restrict ETL to CI/ops; never expose service key to Vercel runtime |
| RLS-04 | Token-based IO approval RPCs granted to `anon` (`approve_vendor_io_by_token`, `get_vendor_io_approval_context`) | **Medium** | Acceptable for vendor portal; enforce short TTL, single-use tokens (already clears hash on approve) |

---

## 2. Authentication flows

| Component | Path | Behavior |
|-----------|------|----------|
| Middleware | `middleware.ts` → `lib/supabase/middleware.ts` | Refreshes session on all non-static routes; redirects unauthenticated users to `/login?next=` |
| Public routes | `lib/auth/routes.ts` | `/login`, `/auth/*`, `/io-approval/*`, `/api/build-info` |
| Server client | `lib/supabase/server.ts` | Anon key + cookies; `getAuthUser()` uses `getUser()` |
| Browser client | `lib/supabase/client.ts` | Standard Supabase browser client |
| New user hook | `handle_new_user()` in `supabase/schema.sql` | Creates profile with default role (`viewer`) |

**Strengths:** No `getSession()` trust on server; `sanitizeNextPath()` prevents open redirects to external URLs.

**Gaps:**

| ID | Finding | Risk | Remediation |
|----|---------|------|-------------|
| AUTH-01 | Middleware redirects API callers to HTML login (302) instead of 401 JSON | **Low** | Optional: branch on `Accept` / path prefix in middleware |
| AUTH-02 | No MFA enforcement documented or configured in codebase | **Medium** | Enable Supabase MFA for admin/finance roles in production |
| AUTH-03 | `/io-approval/*` is public; relies on token entropy in RPC | **Medium** | Audit token length/expiry; rate-limit approval endpoints at edge |

---

## 3. User permissions / roles

**Implementation model:** `roles` → `role_permissions` → `permissions` (slug-based, e.g. `clients.write`, `invoices.write`).

**Application layer:** `lib/auth/permissions.ts` — `requirePermission()`, `requireFinanceOverrideAccess()`, `hasPermission()` RPC wrapper.

**Privileged bypass:** `super_admin` and `admin` skip permission RPC in `requirePermission()`.

**Seed roles** (`supabase/seed.sql`): `super_admin`, `admin`, `account_manager`, `finance`, `operations`, `client_user`, `influencer`, `viewer`.

Extended permissions in migrations: IO (`client_ios.*`, `vendor_ios.*`), planning, collections, treasury, settings, publications, portals, discovery, intelligence.

---

## 4. Role escalation risks

| ID | Finding | Risk | Remediation |
|----|---------|------|-------------|
| ESC-01 | **`profiles_update_self_or_admin`** (`supabase/policies.sql`) allows `id = auth.uid()` for UPDATE with no column restriction — user may set `role_id` to admin via direct Supabase client/API | **Critical** | Add `BEFORE UPDATE` trigger: only `users.write` / `is_admin()` may change `role_id`, `is_active`; or split policies |
| ESC-02 | `requirePermission()` grants full bypass to `admin` / `super_admin` without audit log on bypass | **Low** | Acceptable; ensure admin count is minimal |
| ESC-03 | `profiles_insert_admin` requires `users.write` — good; invite flow in `features/settings/actions.ts` assigns role at invite time | **Low** | — |
| ESC-04 | No `director`, `manager`, or `data_entry` roles from system reference — operational staff may be over-permissioned as `operations` or `account_manager` | **Medium** | See `docs/ROLE_MATRIX.md` |

---

## 5. API exposure (`app/api/`)

| Route | Auth check | Permission check | Notes |
|-------|------------|------------------|-------|
| `/api/build-info` | Public (intentional) | N/A | Exposes git SHA, Supabase ref, architecture version |
| `/api/vendor-ios/[id]/document` | `getUser()` | RLS on `vendor_ios` | PDF/HTML generation |
| `/api/client-ios/[id]/document` | `getUser()` | RLS | Same pattern |
| `/api/invoices/[id]/document` | `getUser()` | RLS | Invoice PDF |
| `/api/reports/*/document` | `getUser()` | Query-layer auth | P&L, VR, statements, etc. |
| `/api/discovery/search`, `/api/discovery/jobs` | `getUser()` | RLS on discovery tables | No explicit role check |
| `/api/campaigns/influencers` | Should verify | — | Campaign influencer lookup |
| `/api/operations/campaigns` | **None in route** | Delegates to `getCampaignsForMovement()` which calls `requireUser()` | OK if query always runs |
| `/api/vendors/platform-accounts/enrich` | **None** | **None** | **Any authenticated session can POST** — middleware only |
| `/api/operations/vendors/[id]/assignments` | Verify at read time | — | — |

| ID | Finding | Risk | Remediation |
|----|---------|------|-------------|
| API-01 | `app/api/vendors/platform-accounts/enrich/route.ts` — no auth or permission gate | **High** | Add `getUser()` + `requirePermission(supabase, 'influencers.write')` |
| API-02 | `/api/build-info` public — information disclosure (env alignment, hints) | **Low** | Restrict to authenticated admin in production or remove hints |
| API-03 | Report export routes auth-only; no explicit finance/analytics permission in route | **Medium** | RLS + query layer may suffice; add explicit `analytics.read` check |
| API-04 | Puppeteer PDF routes (`maxDuration: 60`, 1GB memory in `vercel.json`) — DoS surface | **Medium** | Rate limit; require finance/campaign permission |

---

## 6. Service role usage

**Grep `SUPABASE_SERVICE_ROLE`:** Used only in **scripts** and **discovery worker**, not in Next.js app runtime:

- `scripts/intelligence-etl/run.ts`, `scripts/billing-lifecycle-e2e-retest.ts`, diagnostics
- `services/discovery-worker/src/config.ts`

**Assessment:** **Low risk** for Vercel deployment if `SUPABASE_SERVICE_ROLE_KEY` is **not** set in Vercel Production env (confirmed pattern: app uses anon key only).

**Documented misconfiguration:** `docs/INTELLIGENCE_ENVIRONMENT_CHECKLIST.md` — local `.env` had anon key in `SUPABASE_SERVICE_ROLE_KEY` slot. Ops must validate JWT `role: service_role` before ETL.

---

## 7. Secret management

| Secret | Where used | Exposure risk |
|--------|------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Public (expected) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + server | Public (expected; RLS must hold) |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts/worker only | Must never be `NEXT_PUBLIC_*` or Vercel Production |
| `OPENAI_API_KEY` | Discovery worker | Worker env only |
| `REDIS_URL` | Discovery queue/worker | Server-side |
| `META_GRAPH_ACCESS_TOKEN` | Social enrichment | Server-side optional |
| `NEXT_PUBLIC_APP_URL` | Invite links, IO URLs | Public |

| ID | Finding | Risk | Remediation |
|----|---------|------|-------------|
| SEC-01 | **No `.env.example`** in repository | **Medium** | Add documented template (no real values) |
| SEC-02 | Invite tokens stored hashed (`user_invites.token_hash`) — good | **Low** | — |
| SEC-03 | IO approval tokens hashed via `hash_io_approval_token()` | **Low** | — |

---

## 8. Environment variables

**Required for app** (`lib/supabase/env.ts`):

- `NEXT_PUBLIC_SUPABASE_URL` (required)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

**Production alignment** (`lib/deploy/build-info.ts`):

- Expected project ref: `hsxrewjcbvmbkqdlzjhs` (labeled **thinkway-dev** in docs)
- `productionReady` flag requires Supabase ref match + no legacy assignment env vars

**Optional / feature-specific:**

- `NEXT_PUBLIC_APP_URL` — invite and IO links
- `VERCEL_GIT_COMMIT_SHA` — deploy verification
- `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH` — PDF on non-Vercel
- Discovery: `REDIS_URL`, `OPENAI_API_KEY`, `DISCOVERY_*`
- Intelligence ETL: `SUPABASE_SERVICE_ROLE_KEY` (JWT `eyJ…`, role `service_role`)
- Legacy (must be **absent**): `ASSIGNMENTS_RENDER_STAGE`, `NEXT_PUBLIC_ASSIGNMENTS_RENDER_STAGE`, `ASSIGNMENTS_ALLOW_RENDER_BISECT`

---

## 9. Public endpoints

| Endpoint / route | Purpose | Controls |
|------------------|---------|----------|
| `/login`, `/auth/*` | Auth UI | Supabase Auth |
| `/io-approval/vendor`, `/io-approval/client` | External IO approval | Token RPC (`SECURITY DEFINER`); anon grant |
| `/api/build-info` | Deploy/schema probe | Unauthenticated read |
| Public storage buckets | IO PDF/HTML CDN-style URLs | See §10 |

All other app routes require session via middleware.

---

## 10. File upload security

### Application validation (`lib/supabase/storage.ts`)

- Max size: **50 MB**
- Allowed MIME: PDF, JPEG, PNG, WebP, MP4, MOV, DOC, DOCX
- Path layout: `{entityId}/{documentType}/{uuid}-{sanitizedName}`
- Signed URLs: 15-minute default expiry

### Storage buckets

| Bucket | Public | RLS policies | Risk |
|--------|--------|--------------|------|
| `client-documents` | **false** | `has_permission` + `can_access_client` + path folder | **Low** |
| `influencer-documents` | **false** | `has_permission` + `can_access_influencer` | **Low** |
| `group-documents` | **false** | Internal user + group access | **Low** |
| `vendor-io-documents` | **true** | Authenticated insert; public bucket flag | **High** — direct URL access if path/URL leaks |
| `client-io-documents` | **true** | Same | **High** |
| Portal uploads | Private + RLS | `20260603030000_creator_client_portals.sql` | **Medium** — verify portal isolation |

| ID | Finding | Risk | Remediation |
|----|---------|------|-------------|
| UP-01 | `vendor-io-documents` and `client-io-documents` created with `public: true` (`20260614010000`, `20260618010000`) | **High** | Set buckets private; serve via signed URLs or authenticated API only |
| UP-02 | Client-side MIME check only in app — storage bucket `allowed_mime_types` also configured | **Low** | Enforce at bucket level (already on IO buckets) |
| UP-03 | No virus/malware scanning pipeline | **Medium** | Accept for Phase 1; add ClamAV or cloud scanner for client legal docs |

---

## Risk register (prioritized)

| Rank | ID | Title | Severity |
|------|-----|-------|----------|
| 1 | ESC-01 | Profile self-update may change `role_id` | **Critical** |
| 2 | UP-01 | Public IO document buckets | **High** |
| 3 | API-01 | Unauthenticated enrich API (session-only) | **High** |
| 4 | RLS-02 | Historical permissive invoice policies | **High** (if unpatched) |
| 5 | SEC-01 | Missing `.env.example` | **Medium** |
| 6 | AUTH-02 | No MFA policy | **Medium** |
| 7 | API-03 | Report routes lack explicit permission | **Medium** |
| 8 | RLS-01 | Migration drift | **Medium** |

---

## Remediation plan (pre-production)

### Phase A — Before any production users (1–3 days)

1. **Fix profile role escalation:** DB trigger or restrictive RLS on `role_id` / `is_active` columns.
2. **Make IO buckets private;** regenerate or proxy document URLs through authenticated API routes.
3. **Add auth + permission to** `/api/vendors/platform-accounts/enrich`.
4. **Verify invoice RLS migration** applied; run audit SQL.
5. **Confirm** `SUPABASE_SERVICE_ROLE_KEY` absent from Vercel Production.

### Phase B — Before finance go-live (1 week)

6. Add `.env.example` with all variables documented.
7. Enable Supabase MFA for admin/finance.
8. Add explicit permission checks to report export and discovery API routes.
9. Rate-limit PDF generation routes (Vercel middleware or Supabase edge).

### Phase C — Ongoing

10. Separate **production Supabase project** from thinkway-dev (see `docs/DEPLOYMENT_GUIDE.md`).
11. Wire Sentry (see `docs/MONITORING_SETUP.md`).
12. Quarterly RLS policy review against new migrations.

---

## Audit conclusion

**Security posture:** Strong foundation (RLS, permission matrix, invoice hardening, private client/vendor document buckets) with **specific critical/high gaps** that must be remediated before enterprise production. Suitable for **controlled pilot** only after Phase A items are addressed.

**Cross-references:** `docs/ROLE_MATRIX.md`, `docs/DEPLOYMENT_GUIDE.md`, `docs/GO_LIVE_READINESS.md`
