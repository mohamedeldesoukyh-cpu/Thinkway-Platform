# Authentication & Authorization Security Audit

**Product:** Thinkway Platform  
**Date:** 24 Jul 2026  
**Type:** Static code / migration review (read-only; no code modified)  
**Scope:** Supabase Auth, session handling, middleware, protected routes, login / recovery / MFA readiness, RBAC, organization isolation, server actions, API routes, RLS policies, service-role usage, secrets exposure  

**Related docs:** [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md), [`PERMISSION_MATRIX.md`](./PERMISSION_MATRIX.md), [`RLS_MATRIX.md`](./RLS_MATRIX.md), [`API_AUDIT.md`](./API_AUDIT.md), [`SECURITY_READINESS_REPORT.md`](./SECURITY_READINESS_REPORT.md)

---

## 1. Executive Summary

Thinkway’s authentication plumbing is fundamentally sound: Supabase SSR clients, cookie session refresh via `proxy.ts` → `lib/supabase/middleware.ts`, server-side `getUser()` (not `getSession()`), public-route allowlisting, cron Bearer checks, and JSON `401` for unauthenticated API callers. Authorization uses a dual model — slug permissions (`has_permission` / `requirePermission`) plus RLS helpers (`can_access_client`, `can_access_campaign_header`, portal scopes) — and core hierarchy / invoice tables are FORCE RLS with permission scoping. Profile role self-escalation (ESC-01) is mitigated by a trigger.

The primary production risk is **not anonymous login bypass**. It is **authenticated over-authorization**:

1. Finance control tables and exchange rates have RLS policies that grant all `authenticated` roles full read/write via `USING (true)`.
2. Invite tokens are stored effectively in plaintext (`hashToken` is identity).
3. Public `/api/ready` uses the service-role client and returns infrastructure telemetry.
4. Privileged roles lack MFA; password reset / OAuth / Magic Link are not productized.

Until Critical (P0) RLS items are fixed, multi-tenant finance data must not be treated as trustworthy against any logged-in JWT (including portal roles that share the `authenticated` Postgres role).

**Verdict:** Elevated risk. Do not sign off unrestricted production finance until P0 is closed.

---

## 2. Risk Score

| Metric | Value |
|--------|--------|
| **Overall risk score** | **67 / 100** |
| Scale | Higher = worse (100 = catastrophic) |
| Residual control strength | ~33 / 100 (strong core AuthN + hierarchy RLS) |
| Expected score after P0 + P1 | ~28–35 (moderate residual) |

### Score composition (approximate weights)

| Factor | Weight |
|--------|--------|
| RLS finance / FX open write | +30 |
| Invite token storage | +12 |
| Public API / service-role readiness | +10 |
| Auth gaps (MFA, open redirect) | +9 |
| Uneven app-layer AuthZ on server actions | +8 |
| Role matrix / portal isolation gaps | +6 |
| Credit: getUser, FORCE RLS core, permission RPC, ESC-01 | baseline reduction |

### Issue counts

| Priority | Count |
|----------|-------|
| Critical (P0) | 2 |
| High (P1) | 5 |
| Medium (P2) | 7 |
| Low (P3) | 3 |
| Mitigated (reference) | 1 |

### Method limits

- Static repository review only.
- Did not probe live Supabase Auth dashboard settings (email confirm, leaked-password protection, MFA factor config).
- Did not re-run Supabase Security Advisor against a live database.
- Confirm migration apply status and Auth settings in each environment before go-live.

---

## 3. Critical Issues (P0)

### P0-01 — Finance control tables open to all authenticated users

| Field | Detail |
|-------|--------|
| **Risk** | Critical — Any logged-in JWT (staff **or** portal `authenticated` roles) can `SELECT` / `INSERT` / `UPDATE` finance documents, posting batches, ERP sync queue, document links, and client/vendor credit & debit notes. Enables financial fraud, ERP queue poisoning, and cross-tenant finance disclosure. |
| **Affected files** | `supabase/migrations/20260610010000_finance_control_architecture.sql` (policies ~L365–401); tables: `finance_documents`, `finance_posting_batches`, `erp_sync_queue`, `finance_document_links`, `client_credit_notes`, `vendor_credit_notes`, `client_debit_notes`, `vendor_debit_notes` |
| **Root cause** | Migration intentionally created placeholder policies with `USING (true)` / `WITH CHECK (true)` for `TO authenticated`, with comment “refine per role matrix in follow-up” — follow-up never shipped. |
| **Recommended fix** | Ship a hardening migration: drop permissive policies; replace with `has_permission('finance.read'/'finance.write')` (or equivalent) plus client/org scoping via `can_access_client` (or document-level ownership); explicitly deny portal roles (`client_user`, `influencer`); prefer `FORCE ROW LEVEL SECURITY`; add regression SQL tests. |
| **Estimated effort** | **3–5 days** (policy design + migration + seed permission grants + QA of finance UI/ERP paths) |

---

### P0-02 — Exchange rates writable by any authenticated user

| Field | Detail |
|-------|--------|
| **Risk** | Critical — Any authenticated session can mutate `md_exchange_rates`, distorting PO / billing / GP calculations platform-wide. Combined with auth-only FX server actions, there is no app-layer gate either. |
| **Affected files** | `supabase/migrations/20260531240000_po_fx_governance_engine.sql` (`md_exchange_rates_write` ~L456–458); `features/finance/exchange-rates/actions.ts` |
| **Root cause** | FX governance migration granted `FOR ALL TO authenticated USING (true) WITH CHECK (true)` for operational convenience; never narrowed to finance roles. |
| **Recommended fix** | Replace write policy with `has_permission('finance.override')` or dedicated `fx.write`; keep SELECT limited to internal users (`is_internal_user()`); call `requireFinanceOverrideAccess()` (or equivalent) in FX upsert/delete actions. |
| **Estimated effort** | **1–2 days** |

---

## 4. High Issues (P1)

### P1-01 — Invite tokens stored without hashing

| Field | Detail |
|-------|--------|
| **Risk** | High — `user_invites.token_hash` stores the raw invite secret. DB read compromise (backup leak, overly broad SELECT, insider) enables account takeover via invite URLs. |
| **Affected files** | `features/settings/actions.ts` (`hashToken`, `inviteUserAction`); settings invite persistence / acceptance flow |
| **Root cause** | `hashToken(token)` is implemented as identity (`return token`). |
| **Recommended fix** | Hash with SHA-256 (or HMAC with server secret) before insert; compare hashes on accept; rotate/invalidate outstanding invites; never log raw invite URLs (`debugSettings`). |
| **Estimated effort** | **0.5–1 day** |

---

### P1-02 — Unauthenticated `/api/ready` uses service-role client

| Field | Detail |
|-------|--------|
| **Risk** | High — Public endpoint creates `createSupabaseAdminClient()` and returns DB/Redis/worker/Apify/queue readiness details. Enables infra fingerprinting and reconnaissance; expands blast radius if readiness logic ever queries sensitive rows. |
| **Affected files** | `app/api/ready/route.ts`; `lib/auth/routes.ts` (`PUBLIC_ROUTE_PREFIXES`); `lib/observability/health-checks.ts`; `proxy.ts` matcher exclusions |
| **Root cause** | Readiness probe was placed on the public allowlist for ops/load balancers, but implemented with full admin client + rich report payload. |
| **Recommended fix** | Keep `/api/health` public/liveness-only; protect `/api/ready` with shared secret, network ACL, or authenticated ops role; or return boolean status without service-role and without queue/Apify internals. |
| **Estimated effort** | **0.5–1 day** |

---

### P1-03 — Open redirect on `/auth/callback`

| Field | Detail |
|-------|--------|
| **Risk** | High — Post-auth redirect to `//evil.com` (passes `startsWith("/")`) enables phishing after legitimate login/PKCE exchange. |
| **Affected files** | `app/auth/callback/route.ts`; `lib/auth/routes.ts` (`sanitizeNextPath` — correct but unused here) |
| **Root cause** | Callback sanitizes with `nextParam.startsWith("/")` only; login flow uses `sanitizeNextPath()` which also blocks `//`. |
| **Recommended fix** | Use `sanitizeNextPath(nextParam)` before redirect; add unit tests for `//`, `/\evil`, absolute URLs. |
| **Estimated effort** | **1–2 hours** |

---

### P1-04 — Product role matrix incomplete vs reference §6

| Field | Detail |
|-------|--------|
| **Risk** | High (governance / least privilege) — Cannot enforce Director delete/lock or Data Entry “no financials” as specified. Staff tend to be over-permissioned as `operations` / `account_manager`. |
| **Affected files** | `supabase/seed.sql`; `docs/ROLE_MATRIX.md`; `lib/auth/permissions-server.ts`; product reference §6 |
| **Root cause** | Seeded roles (`super_admin`, `admin`, `account_manager`, `finance`, `operations`, `client_user`, `influencer`, `viewer`) diverge from Admin / Director / Manager / Account Manager / Finance / Data Entry. |
| **Recommended fix** | Either add Director / Manager / Data Entry roles + permission sets, or formally document mapping of reference roles → seed slugs and enforce via permission matrix + UI. Align RLS and `requirePermission` with that decision. |
| **Estimated effort** | **3–5 days** (roles + seed + UI + docs) |

---

### P1-05 — No MFA for privileged roles

| Field | Detail |
|-------|--------|
| **Risk** | High — Password compromise of `admin` / `super_admin` / `finance` yields full `requirePermission` bypass and (today) Critical RLS write surfaces. |
| **Affected files** | Auth product surface (`features/auth/*`, `app/login/*`); Supabase Auth project config (dashboard); no `mfa.*` usage in app TypeScript |
| **Root cause** | MFA called out as future work; no enroll/challenge UI or AAL2 enforcement in app. |
| **Recommended fix** | Enable Supabase MFA (TOTP); require AAL2 for settings/finance/admin routes and privileged server actions; document enrollment runbook. |
| **Estimated effort** | **3–5 days** (Auth config + UI + enforcement) |

---

## 5. Medium Issues (P2)

### P2-01 — Many write server actions are auth-only (RLS-only defense)

| Field | Detail |
|-------|--------|
| **Risk** | Medium — Defense-in-depth gap. If RLS is misapplied on a new table, any logged-in user can mutate core entities. Middleware never redirects Server Action POSTs, so actions must self-enforce. |
| **Affected files** | `features/clients/actions.ts`; `features/vendors/actions.ts`; `features/groups/actions.ts`; `features/brands/actions.ts`; `features/campaigns/actions.ts`; `features/billing/actions.ts`; `features/io/actions.ts`; `features/finance/adjustments/actions.ts`; `features/finance/exchange-rates/actions.ts`; contrast strong patterns in `features/settings/actions.ts`, `features/planning/actions.ts`, `features/quotations/actions.ts` |
| **Root cause** | Historical pattern: `requireRequestUser()` + rely on RLS; Phase B `requirePermission()` rollout incomplete. |
| **Recommended fix** | Add `requirePermission("<domain>.write")` (or domain-specific helpers) on all mutating actions; keep RLS as second layer. |
| **Estimated effort** | **3–4 days** across modules |

---

### P2-02 — `addToShortlistAction` skips explicit auth check

| Field | Detail |
|-------|--------|
| **Risk** | Medium — Inconsistent with sibling discovery actions; relies entirely on RLS for an unauthenticated-callable server action path. |
| **Affected files** | `features/discovery/actions.ts` (`addToShortlistAction` ~L88–98) |
| **Root cause** | Action creates a server client and inserts without `requireRequestUser` / `requirePermission`. |
| **Recommended fix** | Use `requireRequestUser()` + `discovery.write` (or shortlist ownership check) before insert. |
| **Estimated effort** | **1–2 hours** |

---

### P2-03 — Quotation export lacks permission gate

| Field | Detail |
|-------|--------|
| **Risk** | Medium — Any authenticated user who can read a quotation via RLS can export PDF/Excel; docs historically expected a permission slug. Privilege consistency gap vs other export routes. |
| **Affected files** | `app/api/quotations/[id]/export/route.ts` (~L50–56) |
| **Root cause** | Route checks `getUser()` only; no `requireApiPermission`. |
| **Recommended fix** | Wrap with `requireApiPermission(..., "quotations.read")` (or the permission documented in product matrix). |
| **Estimated effort** | **1–2 hours** |

---

### P2-04 — Broad authenticated SELECT on intelligence / DNA / IPL / forecast

| Field | Detail |
|-------|--------|
| **Risk** | Medium — Sensitive creator analytics readable by any `authenticated` JWT, including portal users if policies do not further filter. Weakens portal isolation. |
| **Affected files** | Migrations including `20260704120000_creator_dna.sql`, `20260703150000_intelligence_persistence_layer.sql`, `20260704020000_creator_enrichment.sql`, `20260713120100_creator_intelligence_projection.sql`, `20260720120000_forecast_data_foundation.sql`; related RLS fix migrations under `20260714*` |
| **Root cause** | Convenience `USING (true)` SELECT policies for internal tooling; portal JWTs share `authenticated`. |
| **Recommended fix** | Scope SELECT via `is_internal_user()`, `intelligence.can_read_intelligence()`, or permission slugs; deny portal roles by default. |
| **Estimated effort** | **2–3 days** |

---

### P2-05 — Password reset / signup / email verification not in product

| Field | Detail |
|-------|--------|
| **Risk** | Medium — Ops rely on Supabase dashboard or out-of-band password resets; increases insecure workarounds (shared passwords, reused admin resets). |
| **Affected files** | `features/auth/actions.ts`; `app/login/*`; `app/auth/callback/route.ts` (PKCE only) |
| **Root cause** | Product implements password sign-in only; no `resetPasswordForEmail`, `signUp`, or verification UX. |
| **Recommended fix** | Ship forgot-password + update-password pages using Supabase recovery flow; document invite-only signup policy; confirm email verification settings in Auth dashboard. |
| **Estimated effort** | **2–3 days** |

---

### P2-06 — IO approval tokens hashed with MD5

| Field | Detail |
|-------|--------|
| **Risk** | Medium — Public `/io-approval/*` depends on token secrecy; MD5 is weak vs modern guidance; long TTL (14 days) increases exposure window. |
| **Affected files** | `supabase/migrations/20260603001000_thinkway_io_system.sql` (`generate_io_approval_token`, `hash_io_approval_token` ~L131–145); `app/io-approval/*`; `lib/auth/routes.ts` (public prefix) |
| **Root cause** | Token RPCs use `md5(...)` for generation/hashing; intentional anon-granted approve RPCs for external vendors/clients. |
| **Recommended fix** | Migrate to `digest(..., 'sha256')` or HMAC; keep single-use clear-on-approve; add edge rate limiting; consider shorter TTL. |
| **Estimated effort** | **1–2 days** (incl. migration of outstanding tokens / force re-issue) |

---

### P2-07 — Public version / build-info disclosure

| Field | Detail |
|-------|--------|
| **Risk** | Medium (info disclosure) — Exposes git SHA, environment, Supabase project-ref alignment hints (including hardcoded thinkway-dev ref), aiding targeted attacks. |
| **Affected files** | `app/api/version/route.ts`; `app/api/build-info/route.ts`; `lib/auth/routes.ts`; `proxy.ts` |
| **Root cause** | Deploy diagnostics intentionally public for ops; payload richer than needed for anonymous callers. |
| **Recommended fix** | Restrict to authenticated ops/admin in production, or strip project ref / architecture hints from unauthenticated responses. |
| **Estimated effort** | **0.5 day** |

---

## 6. Low Issues (P3)

### P3-01 — Admin / super_admin bypass all permission checks

| Field | Detail |
|-------|--------|
| **Risk** | Low — Intentional privileged bypass; risk is over-issued admin accounts and lack of audit on bypass. |
| **Affected files** | `lib/auth/permissions-server.ts` (`requirePermission` ~L36–39) |
| **Root cause** | App-layer short-circuit for `super_admin` / `admin` before `has_permission` RPC. |
| **Recommended fix** | Keep bypass; minimize admin count; audit log privileged bypass; optionally require MFA (ties to P1-05). |
| **Estimated effort** | **0.5–1 day** (audit logging) |

---

### P3-02 — Cron open when `CRON_SECRET` unset in development

| Field | Detail |
|-------|--------|
| **Risk** | Low in local/dev; **High if mis-deployed** — Missing secret allows cron routes when `NODE_ENV === "development"`. |
| **Affected files** | `lib/auth/routes.ts` (`authorizeCronRequest`); `app/api/cron/*`; admin campaign-performance dual-auth routes |
| **Root cause** | Dev ergonomics allow cron without secret. |
| **Recommended fix** | Fail closed unless secret set, even in development; enforce `CRON_SECRET` in Vercel production env checks / CI. |
| **Estimated effort** | **1–2 hours** |

---

### P3-03 — `NEXT_PUBLIC_DEBUG_*` flags in client bundle

| Field | Detail |
|-------|--------|
| **Risk** | Low — Debug/trace flags advertise instrumentation surfaces in the browser. |
| **Affected files** | `.env.example`; Vercel env usage referenced by build-info; various `NEXT_PUBLIC_DEBUG_*` / browse-trace flags |
| **Root cause** | Debug toggles exposed via `NEXT_PUBLIC_` for client visibility. |
| **Recommended fix** | Prefer server-only debug env vars; remove legacy assignment debug envs from production. |
| **Estimated effort** | **0.5 day** |

---

## 7. Mitigated (reference)

### M-01 — ESC-01 profile role escalation guarded

| Field | Detail |
|-------|--------|
| **Status** | Mitigated in repo |
| **Risk if missing on env** | Critical privilege escalation |
| **Affected files** | `supabase/migrations/20260629010000_profile_role_escalation_guard.sql` |
| **Root cause (original)** | `profiles` self-update RLS allowed changing `role_id` without column restriction. |
| **Recommended action** | Verify trigger applied on all environments (`Local = Remote` migrations). |
| **Estimated effort** | **30 minutes** verification |

---

## 8. Positive controls (summary)

| Control | Location | Assessment |
|---------|----------|------------|
| Server `getUser()` (not `getSession()`) | `lib/supabase/server.ts`, middleware | Strong |
| Middleware session refresh + route gate | `lib/supabase/middleware.ts`, `proxy.ts` | Strong |
| API JSON 401 for unauthenticated callers | middleware | Strong |
| Permission helpers / API wrappers | `lib/auth/permissions*.ts`, `lib/auth/api-auth.ts` | Strong (when used) |
| Client / campaign / invoice RLS + FORCE RLS | `supabase/policies.sql`, hierarchy/billing migrations | Strong |
| Service-role client not imported in client components | `lib/supabase/admin.ts` | Strong |
| No hardcoded live API keys in app source | repo scan | Strong |
| `.env.example` separates public vs server secrets | `.env.example` | Strong |

---

## 9. Prioritized remediation plan

| Phase | Items | Target outcome |
|-------|-------|----------------|
| **P0 (immediate)** | P0-01, P0-02 | Finance/FX RLS least privilege restored |
| **P1 (before go-live)** | P1-01 … P1-05 | Invite secrecy, readiness lockdown, redirect fix, MFA + role decision |
| **P2 (next sprint)** | P2-01 … P2-07 | Defense-in-depth, export/auth UX, intelligence SELECT scope, IO token crypto |
| **P3 (hardening)** | P3-01 … P3-03 | Audit admin bypass, fail-closed cron, strip debug public envs |

### Suggested order of work

1. Finance + FX RLS migrations + smoke tests  
2. Invite token hashing + invite rotation  
3. `/api/ready` lockdown + auth callback `sanitizeNextPath`  
4. Quotation export + discovery shortlist auth consistency  
5. MFA for privileged roles + password-reset UX  
6. Broader `requirePermission` rollout + intelligence SELECT scoping  
7. Role matrix alignment + residual hardening  

---

## 10. Authentication surface inventory

| Capability | Status | Notes |
|------------|--------|-------|
| Password sign-in | Implemented | `features/auth/actions.ts` |
| Sign-out | Implemented | Same |
| Session refresh / cookies | Implemented | Middleware SSR |
| Protected routes | Implemented | Redirect to `/login?next=` |
| Auth callback (PKCE) | Implemented | Open-redirect gap (P1-03) |
| Password reset | Not in app | P2-05 |
| Signup | Not in app | Invite / ops driven |
| Email verification UX | Not in app | Dashboard-dependent |
| OAuth login providers | Not implemented | `oauth_verified` is creator data, not Auth |
| Magic Link login | Not implemented | Test script only |
| MFA | Not ready | P1-05 |
| External IO approval tokens | Implemented | Public `/io-approval/*`; MD5 (P2-06) |

---

## 11. Authorization surface inventory

| Capability | Status | Notes |
|------------|--------|-------|
| Slug RBAC | Implemented | `roles` / `permissions` / `role_permissions` |
| Admin bypass | Implemented | Intentional (P3-01) |
| Finance override helper | Implemented | `requireFinanceOverrideAccess` |
| Client / campaign scope helpers | Implemented | RLS `can_access_*` |
| Portal scope | Implemented | Creator / client portal membership |
| Org isolation on finance control tables | **Broken** | P0-01 |
| Director / Manager / Data Entry | Missing | P1-04 |

---

## 12. Public / weakly gated API routes

| Route | Gate | Notes |
|-------|------|-------|
| `/api/health` | Public | Liveness — acceptable |
| `/api/ready` | Public + service role | P1-02 |
| `/api/version` | Public | P2-07 |
| `/api/build-info` | Public | P2-07 |
| `/api/cron/*` | `CRON_SECRET` (open in dev if unset) | P3-02 |
| `/api/quotations/[id]/export` | Session only | P2-03 |
| Most other `/api/**` | Session + `requireApiPermission` | Preferred pattern |

---

## 13. Secrets findings

| Finding | Severity | Notes |
|---------|----------|-------|
| No hardcoded live API keys / service JWTs in app source | OK | Placeholders only in docs/tests |
| `SUPABASE_SERVICE_ROLE_KEY` server-only | OK | Not `NEXT_PUBLIC_` |
| Invite tokens stored raw | High | P1-01 |
| Public readiness uses service role | High | P1-02 |
| IO token MD5 | Medium | P2-06 |
| `NEXT_PUBLIC_DEBUG_*` | Low | P3-03 |

---

*End of report. Generated from static analysis of the Thinkway Platform repository on 24 Jul 2026.*
