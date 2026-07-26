# Thinkway Platform — Enterprise Security Assessment

**Assessment date:** 26 July 2026  
**Scope:** Infrastructure, authn/authz, API routes, database/RLS, Supabase, Redis, BullMQ, Vercel, Railway, secrets, uploads/storage, frontend, dependencies, CI/CD, monitoring, logging, backup & recovery  
**Method:** Read-only codebase + architecture/config review (no code changes, no remediations implemented)  
**Environments reviewed:** Local · Development (`hsxrewjcbvmbkqdlzjhs`) · Production (`ienowhwfyxoqtzbgltno`)  
**Interactive artifact:** Cursor canvas `thinkway-security-assessment.canvas.tsx`  
**Supersedes as baseline:** This document is the Production-readiness security baseline as of the assessment date. Prior reports under `docs/security/` remain historical context.

---

## Executive verdict

**Not Production-ready for unconditional external GO** until Critical/High residuals are closed on Development and re-verified. Prior P0–P4 hardening (finance RLS, IO XSS, SSRF, CSRF/headers, private IO buckets, fail-closed API classification) is substantially present and verified. Residual risk concentrates in CLI project drift, portal URL handling, creator-intelligence RLS, dual-env secret hygiene, dependency/CI gates, and serverless rate limiting.

| Severity | Count (excl. positive control) |
|----------|-------------------------------:|
| Critical | 1 |
| High | 8 |
| Medium | 9 |
| Low | 4 |
| Informational | 1 (strengths) + 1 (MFA policy) |

---

## Environment matrix (canonical)

| Surface | Host | Supabase project | Deploy policy |
|---------|------|------------------|---------------|
| Local | localhost | Dev default | `npm run dev` |
| Development | `dev.thinkwaymedia.com` | `hsxrewjcbvmbkqdlzjhs` | Branch `develop` |
| Production | `app.thinkwaymedia.com` | `ienowhwfyxoqtzbgltno` | Explicit approval only |

---

## Findings

### SEC-001 — Critical — Infrastructure / Environment

| Field | Detail |
|-------|--------|
| **Title** | Local Supabase CLI linked to undocumented project |
| **Description** | Working-tree `supabase/.temp/project-ref` is `pkozxsvdyswgmcqzohqd` (named thinkway-production), which is neither approved Development (`hsxrewjcbvmbkqdlzjhs`) nor Production (`ienowhwfyxoqtzbgltno`). Pooler URL embeds yet another project id. |
| **Risk** | Any `supabase db push`/dump/query against the linked project may hit an untracked database labeled production. |
| **Business Impact** | Accidental schema or data change on an unknown project; compliance and audit trail break. |
| **Technical Impact** | Silent target mismatch for CLI operations; policy "state which project" cannot be satisfied from CLI state alone. |
| **Affected Components** | `supabase/.temp/*` (local CLI state); all supabase CLI workflows |
| **Root Cause** | Manual `supabase link` to a project outside the documented allow-list; no preflight guard. |
| **Recommendation** | Re-link CLI to Development or Production explicitly; add a hard-fail script checking project-ref against the allow-list before any DB write. |
| **Proposed Remediation** | `scripts/verify-supabase-link.mjs` + document allow-list; reset local link; investigate what `pkozxsvdyswgmcqzohqd` is. |
| **Priority** | P0 — before any further supabase CLI DB work |

### SEC-002 — High — XSS / Open Redirect

| Field | Detail |
|-------|--------|
| **Title** | Portal `external_link` stored and rendered without scheme validation |
| **Description** | Creator deliverable and client PO portal actions persist FormData `external_link` raw; UI renders `<Link href={external_link}>`. `javascript:` or other schemes can execute in-app. |
| **Risk** | Stored XSS / malicious navigation for staff viewing portal uploads. |
| **Business Impact** | Session theft (non-HttpOnly auth cookies amplify blast radius), phishing via trusted UI. |
| **Technical Impact** | Script execution in Thinkway origin; possible token exfiltration. |
| **Affected Components** | `features/portals/actions.ts`; `creator-deliverable-row.tsx`; `client-po-upload-form.tsx` |
| **Root Cause** | No Zod/URL allowlist on write or render for `external_link`. |
| **Recommendation** | Allow only `https` URLs on write; reject non-http(s) before rendering. |
| **Proposed Remediation** | `z.string().url()` + https-only refine; defensive href guard in components. |
| **Priority** | P0 — next Development security sprint |

### SEC-003 — High — Database / RLS

| Field | Detail |
|-------|--------|
| **Title** | Creator intelligence tables `SELECT USING (true)` for authenticated |
| **Description** | `creator_dna*`, `creator_intelligence`, `ipl_*`, enrichment/forecast tables grant SELECT to any authenticated role including portal users, bypassing app portal gates via PostgREST. |
| **Risk** | Direct API/SDK access to proprietary creator intelligence by portal accounts. |
| **Business Impact** | IP/competitive data leakage to clients/creators; contractual confidentiality breach. |
| **Technical Impact** | Cross-tenant/portal data disclosure via Supabase REST without app mediation. |
| **Affected Components** | Migrations `20260704120000_creator_dna.sql` and related intelligence/IPL/forecast migrations |
| **Root Cause** | RLS hardening applied to finance was not extended to creator-intelligence domain. |
| **Recommendation** | Require `is_internal_user()` + permission (e.g. `discovery.read`) on SELECT policies. |
| **Proposed Remediation** | New migration mirroring finance least-privilege pattern; `FORCE RLS` where missing. |
| **Priority** | P0 — schema change on Development first, then approved Production migrate |

### SEC-004 — High — Vercel / Secrets / Redis

| Field | Detail |
|-------|--------|
| **Title** | Dual-deployment secret isolation incomplete |
| **Description** | Preview still carries `Production, Preview` for `NEXT_PUBLIC_SUPABASE_URL`/`ANON` (develop branch overrides exist). Dedicated Development Redis for Preview/develop was not confirmed. Production `REDIS_URL` currently present again (re-added). |
| **Risk** | Non-develop Preview deploys may still resolve Production Supabase public URL; queue isolation depends on Redis split. |
| **Business Impact** | Preview environments could confuse or (if service-role residual) touch wrong data plane. |
| **Technical Impact** | Env target drift; BullMQ cross-env contamination if Redis shared. |
| **Affected Components** | Vercel env matrix; `scripts/configure-dual-deployment-env.mjs`; develop Preview |
| **Root Cause** | Historical Production+Preview shared secrets; incomplete detach during dual-deploy setup. |
| **Recommendation** | Detach Preview from Production secrets entirely; dedicated Dev Redis on develop; disable auto Production deploys from `main`. |
| **Proposed Remediation** | Vercel env audit; remove Preview from prod-shared vars; add Dev `REDIS_URL`; Vercel Production branch protection. |
| **Priority** | P0 — operational before Production readiness sign-off |

### SEC-005 — High — Redis / BullMQ

| Field | Detail |
|-------|--------|
| **Title** | Creator-import queue uses buggy `{ url }` connection shape |
| **Description** | `lib/discovery-import/queue-connection.ts` returns `{ url }`; ioredis ignores `url` and falls back to localhost. Fixed elsewhere via `createBullMqQueueConnection` but missed here. |
| **Risk** | Import jobs fail or enqueue to unreachable localhost on Vercel; silent stuck imports. |
| **Business Impact** | Broken creator-import pipeline in hosted environments. |
| **Technical Impact** | Producer/consumer Redis mismatch; availability defect. |
| **Affected Components** | `lib/discovery-import/queue-connection.ts`; `queue.ts`; `cancel-import.ts` |
| **Root Cause** | Incomplete rollout of bullmq-connection fix. |
| **Recommendation** | Use `createBullMqQueueConnection(REDIS_URL)` consistently. |
| **Proposed Remediation** | One-module fix + regression test; verify import enqueue on Dev. |
| **Priority** | P1 — Development fix immediately |

### SEC-006 — High — Dependencies

| Field | Detail |
|-------|--------|
| **Title** | `xlsx@0.18.5` unpatched CVEs on untrusted uploads |
| **Description** | SheetJS npm `xlsx` 0.18.5 has known prototype-pollution/ReDoS with no npm fix; used near discovery/metrics import of user files. `exceljs` archiver chain also shows High advisories. |
| **Risk** | Malicious spreadsheet DoS or pollution during parse. |
| **Business Impact** | Availability impact on import paths; potential secondary RCE classes depending on pollution gadgets. |
| **Technical Impact** | Server-side parse of attacker-controlled XLSX. |
| **Affected Components** | `package.json` xlsx; discovery-import / metrics import / ETL scripts |
| **Root Cause** | Dependency on unmaintained npm distribution of SheetJS. |
| **Recommendation** | Parse with ExcelJS (already present) or official patched SheetJS build; CI `npm audit` gate. |
| **Proposed Remediation** | Replace parse path; add Dependabot + audit job. |
| **Priority** | P1 |

### SEC-007 — High — CI/CD

| Field | Detail |
|-------|--------|
| **Title** | No dependency vulnerability scanning in CI |
| **Description** | `.github/workflows/validate.yml` runs typecheck/build/tests only — no `npm audit`, Dependabot, or Renovate. |
| **Risk** | High/Critical CVEs land unnoticed in Next/React/Supabase/sharp/puppeteer stack. |
| **Business Impact** | Delayed response to supply-chain/security patches. |
| **Technical Impact** | Unknown exploitable transitive deps in Production. |
| **Affected Components** | `.github/workflows/validate.yml`; package ecosystems root + discovery-worker |
| **Root Cause** | CI focused on functional gates only. |
| **Recommendation** | Weekly `npm audit --omit=dev`; Dependabot security updates. |
| **Proposed Remediation** | Add workflow job + `dependabot.yml`. |
| **Priority** | P1 |

### SEC-008 — High — Abuse prevention

| Field | Detail |
|-------|--------|
| **Title** | In-memory rate limiter ineffective on serverless |
| **Description** | `lib/security/rate-limit.ts` uses process-local `Map`; Vercel multi-instance bypasses login/MFA/AI/export limits. |
| **Risk** | Credential stuffing and cost/CPU exhaustion (PDF exports, OpenAI). |
| **Business Impact** | Account takeover risk and infra cost spikes. |
| **Technical Impact** | Configured limits are N× instance count. |
| **Affected Components** | `lib/security/rate-limit.ts`; proxy request guard; auth/AI/export routes |
| **Root Cause** | Pilot-era limiter never migrated to Redis. |
| **Recommendation** | Redis/Upstash-backed counters using existing `REDIS_URL`. |
| **Proposed Remediation** | Shared rate-limit store; per-account lockout for auth. |
| **Priority** | P1 — before external Production traffic growth |

### SEC-009 — High — CI/CD / Secrets

| Field | Detail |
|-------|--------|
| **Title** | CI Discovery browse step uses service-role key |
| **Description** | `validate.yml` injects `SUPABASE_SERVICE_ROLE_KEY` for `measure:discovery-browse-pool` on push/PR. |
| **Risk** | CI compromise or malicious dep exposes full RLS-bypass key. |
| **Business Impact** | Potential full database read/write if runner/supply-chain compromised. |
| **Technical Impact** | Service-role in GitHub Actions secret scope for PR builds (internal). |
| **Affected Components** | `.github/workflows/validate.yml`; `scripts/measure-discovery-browse-pool.ts` |
| **Root Cause** | Convenience measurement using admin client. |
| **Recommendation** | Use anon+RLS or read-only DB role; restrict to develop pushes; assert project ref. |
| **Proposed Remediation** | Workflow tighten + least-privilege DB credential. |
| **Priority** | P1 |

### SEC-010 — Medium — Authorization / Service role

| Field | Detail |
|-------|--------|
| **Title** | CIP elevated update skips brand re-validation |
| **Description** | `elevatedUpdateCampaignIntelligenceProfile` can patch `brandId` via admin client without `assertAccessibleBrandId` (create path checks). |
| **Risk** | Re-parent own CIP profile to inaccessible brand (RLS bypass write). |
| **Business Impact** | Cross-brand data association / confidentiality breach. |
| **Technical Impact** | Least-privilege residual on service-role path. |
| **Affected Components** | `features/campaign-intelligence-profile/services/profile-repository-elevated.ts` |
| **Root Cause** | Asymmetric validation between create and update. |
| **Recommendation** | `assertAccessibleBrandId` whenever `brandId` present in patch. |
| **Proposed Remediation** | Code fix + unit test; already noted in `SERVICE_ROLE_AUDIT.md`. |
| **Priority** | P2 |

### SEC-011 — Medium — Session / CSP

| Field | Detail |
|-------|--------|
| **Title** | Non-HttpOnly auth cookies + weak CSP amplify XSS |
| **Description** | Supabase browser cookies `httpOnly:false`; CSP allows `unsafe-inline`/`unsafe-eval`. |
| **Risk** | Any future XSS becomes full session theft with weak CSP mitigation. |
| **Business Impact** | Account takeover multiplier for residual XSS. |
| **Technical Impact** | Client-readable session tokens; CSP not load-bearing. |
| **Affected Components** | `lib/security/cookie-options.ts`; `security-headers.ts`; `next.config.ts` |
| **Root Cause** | Supabase browser client hydration trade-off; Next inline scripts. |
| **Recommendation** | Plan HttpOnly BFF/session; CSP nonces; drop `unsafe-eval`. |
| **Proposed Remediation** | Phased auth architecture + CSP Report-Only rollout. |
| **Priority** | P2 |

### SEC-012 — Medium — Rate limiting

| Field | Detail |
|-------|--------|
| **Title** | `X-Forwarded-For` first hop trusted for auth rate-limit identity |
| **Description** | `getClientIp` uses first XFF value; auth category keys solely on IP. |
| **Risk** | Spoofed XFF resets buckets if ever reachable outside trusted edge. |
| **Business Impact** | Brute-force protection bypass under mis-proxy conditions. |
| **Technical Impact** | Per-request fresh rate-limit identity. |
| **Affected Components** | `lib/auth/api-auth.ts`; `lib/security/rate-limit-policy.ts` |
| **Root Cause** | No trusted-proxy hop policy; no per-account lockout. |
| **Recommendation** | Use platform connecting IP; add per-account lockout. |
| **Proposed Remediation** | Trusted hop config + dual counters. |
| **Priority** | P2 |

### SEC-013 — Medium — API Authorization

| Field | Detail |
|-------|--------|
| **Title** | Quotations export missing permission + audit parity |
| **Description** | `quotations/[id]/export` only `getUser()`; siblings use `requireApiPermission` + audit. Relies on RLS alone. |
| **Risk** | Defense-in-depth gap; future RLS regression exposes margin data; no export audit trail. |
| **Business Impact** | Weaker governance for commercial exports. |
| **Technical Impact** | Inconsistent API security pattern. |
| **Affected Components** | `app/api/quotations/[id]/export/route.ts` |
| **Root Cause** | Pattern drift vs shortlists/invoices exports. |
| **Recommendation** | `requireApiPermission(discovery.read)` + `logAuditEvent`. |
| **Proposed Remediation** | Align with shortlists export route. |
| **Priority** | P2 |

### SEC-014 — Medium — Authorization architecture

| Field | Detail |
|-------|--------|
| **Title** | `admin_only` classification advisory for internal staff |
| **Description** | `authorizeWorkspacePath` does not deny internal staff on `admin_only`; relies on per-route checks. |
| **Risk** | New `admin_only` route missing in-route check is silently allowed by middleware. |
| **Business Impact** | Privilege escalation via incomplete new endpoints. |
| **Technical Impact** | Fail-closed claim not middleware-enforced for staff. |
| **Affected Components** | `lib/security/workspace-auth.ts`; `workspace-classification-registry.ts` |
| **Root Cause** | Classification used as documentation for staff actors. |
| **Recommendation** | Enforce admin role set at middleware for `admin_only`. |
| **Proposed Remediation** | Extend `authorizeWorkspacePath` + registry tests. |
| **Priority** | P2 |

### SEC-015 — Medium — Upload validation

| Field | Detail |
|-------|--------|
| **Title** | Empty Content-Type bypasses MIME allowlist |
| **Description** | `uploadEntityDocument`/`uploadCreatorImportFile` skip MIME checks when Content-Type empty; no magic-byte sniffing. |
| **Risk** | Malicious binaries uploaded under blank MIME into document buckets. |
| **Business Impact** | Malware hosting in trusted storage; staff download risk. |
| **Technical Impact** | Validation gap on storage write path. |
| **Affected Components** | `lib/supabase/storage.ts` |
| **Root Cause** | Allowlist only when MIME present. |
| **Recommendation** | Require MIME + magic-byte verification; reject empty type. |
| **Proposed Remediation** | Shared upload validator; unit tests. |
| **Priority** | P2 |

### SEC-016 — Medium — Backup & Recovery

| Field | Detail |
|-------|--------|
| **Title** | No executed restore drill; no storage offsite mirror |
| **Description** | `BACKUP_DRILL_PLAN` unfilled; storage buckets holding KYC/legal docs have no automated offsite mirror script in repo. |
| **Risk** | Unverified RTO/RPO; single-provider dependency for non-regenerable files. |
| **Business Impact** | Prolonged outage or permanent document loss after catastrophic failure. |
| **Technical Impact** | DR readiness incomplete for Production certification. |
| **Affected Components** | `docs/BACKUP_*`; storage buckets; missing export job |
| **Root Cause** | DR docs exist; implementation/drill not completed. |
| **Recommendation** | Run Drill 1; implement weekly storage export to independent object store. |
| **Proposed Remediation** | Logged drill + scheduled storage mirror. |
| **Priority** | P2 — Production readiness gate |

### SEC-017 — Medium — Monitoring

| Field | Detail |
|-------|--------|
| **Title** | No Sentry/error monitoring enabled |
| **Description** | `SENTRY_DSN` unset by default; error reporter no-ops; `RISK_REPORT` MON-01 still open. |
| **Risk** | Production exceptions without alerting/aggregation. |
| **Business Impact** | Slow incident detection; silent security failures. |
| **Technical Impact** | Only raw Vercel logs. |
| **Affected Components** | lib observability/error-reporter; Vercel env |
| **Root Cause** | Optional Sentry not wired for Production. |
| **Recommendation** | Install `@sentry/nextjs`; set DSN on Dev and Prod. |
| **Proposed Remediation** | Wizard + env + alert routing. |
| **Priority** | P2 |

### SEC-018 — Medium — Logging

| Field | Detail |
|-------|--------|
| **Title** | Structured logger lacks secret redaction denylist |
| **Description** | Logger spreads arbitrary fields into JSON without key denylist for token/secret/authorization. |
| **Risk** | Future call sites can persist secrets into log drains/SIEM. |
| **Business Impact** | Credential leakage via ops tooling. |
| **Technical Impact** | No structural guardrail at log sink. |
| **Affected Components** | `lib/observability/structured-logger.ts`; `lib/platform/logger.ts` |
| **Root Cause** | Trust that callers never pass secrets. |
| **Recommendation** | Denylist redact in `buildPayload`; appsec test for env interpolation. |
| **Proposed Remediation** | Shared redact helper + tests. |
| **Priority** | P2 |

### SEC-019 — Low — Auth / Secrets

| Field | Detail |
|-------|--------|
| **Title** | Cron/ready secret compare not timing-safe |
| **Description** | `CRON_SECRET`/`READY_API_SECRET` compared with `===`; invite tokens use `timingSafeEqual`. |
| **Risk** | Theoretical remote timing side-channel. |
| **Business Impact** | Low practical; consistency gap. |
| **Technical Impact** | Non-constant-time secret compare. |
| **Affected Components** | `lib/auth/routes.ts`; `ready-auth.ts`; cron route local copies |
| **Root Cause** | Duplicated `authorizeCron` without shared helper. |
| **Recommendation** | Shared `timingSafeEqual` helper; consolidate cron auth. |
| **Proposed Remediation** | Refactor + tests. |
| **Priority** | P3 |

### SEC-020 — Low — Authorization / Server Actions

| Field | Detail |
|-------|--------|
| **Title** | Discovery-import actions auth-only before storage write |
| **Description** | upload/cancel/pause/resume call `requireAuthUser` only; storage write before RLS-backed DB insert. |
| **Risk** | Any authenticated user can burn storage quota (rollback cleans object). |
| **Business Impact** | Abuse/cost; not direct data disclosure. |
| **Technical Impact** | Permission check after expensive upload. |
| **Affected Components** | `features/discovery-import/actions.ts` |
| **Root Cause** | SA-01 residual pattern. |
| **Recommendation** | `requirePermission(discovery.write)` before storage. |
| **Proposed Remediation** | Gate at action entry. |
| **Priority** | P3 |

### SEC-021 — Low — CSRF / Availability

| Field | Detail |
|-------|--------|
| **Title** | Side-effecting GET exports under SameSite=Lax |
| **Description** | PDF/export GETs perform heavy work; CSRF skips GET; top-level cross-site nav sends cookies. |
| **Risk** | Forced export generation / rate-limit burn (not cross-origin data read). |
| **Business Impact** | Availability/cost abuse via lured links. |
| **Technical Impact** | Unaudited CSRF gap on GET side effects. |
| **Affected Components** | Export/document API routes; `csrf.ts` |
| **Root Cause** | Exports implemented as GET for download UX. |
| **Recommendation** | POST exports or custom header CSRF for GET exports. |
| **Proposed Remediation** | API redesign or header gate. |
| **Priority** | P3 |

### SEC-022 — Low — Storage ops

| Field | Detail |
|-------|--------|
| **Title** | `storage.sql` outside migrations path |
| **Description** | Bucket/object policies in `supabase/storage.sql` not applied by migration up alone. |
| **Risk** | Fresh envs missing intended storage RLS. |
| **Business Impact** | Misprovisioned environments. |
| **Technical Impact** | Policy drift on bootstrap. |
| **Affected Components** | `supabase/storage.sql` vs `migrations/` |
| **Root Cause** | Historical layout outside timestamped migrations. |
| **Recommendation** | Fold into migration or CI-required bootstrap step. |
| **Proposed Remediation** | Migration or provision script gate. |
| **Priority** | P3 |

### SEC-023 — Informational — MFA policy

| Field | Detail |
|-------|--------|
| **Title** | MFA required only for admin/finance/super_admin |
| **Description** | Director/Account Manager and other privileged ops roles not AAL2-gated. |
| **Risk** | Broader blast radius on password compromise for commercial approvers. |
| **Business Impact** | Policy gap vs enterprise MFA expectations. |
| **Technical Impact** | Partial MFA coverage. |
| **Affected Components** | `lib/auth/mfa-policy.ts` |
| **Root Cause** | Phased MFA rollout. |
| **Recommendation** | Extend `MFA_REQUIRED_ROLE_SLUGS` to Director/AM as appropriate. |
| **Proposed Remediation** | Policy + enrollment UX. |
| **Priority** | P3 |

### SEC-024 — Informational — Positive controls

| Field | Detail |
|-------|--------|
| **Title** | Mature baseline controls verified present |
| **Description** | Fail-closed API classification, `has_permission` RLS, MFA for admin/finance, CSRF+headers, SSRF allowlist+private IP block, sanitize-html SafeHtml for IO terms, CSV formula neutralization, prompt isolation, profile privilege trigger, private IO buckets in migrations. |
| **Risk** | N/A — strengths to preserve. |
| **Business Impact** | Strong foundation vs median SaaS; prior Critical XSS/finance RLS remediated. |
| **Technical Impact** | Defense-in-depth exists; residuals are gaps not absence of program. |
| **Affected Components** | `lib/security/*`; proxy; migrations `2026072415*`; SafeHtml; `ssrf.ts` |
| **Root Cause** | Prior P0–P4 hardening sprints. |
| **Recommendation** | Keep `docs/security/*` synchronized with code; treat this assessment as baseline. |
| **Proposed Remediation** | Documentation refresh; track SEC-* IDs to closure. |
| **Priority** | Maintain |

---

## Production readiness gate (recommended)

Close or accept-with-risk (documented) before unconditional Production GO:

1. **P0:** SEC-001, SEC-002, SEC-003, SEC-004  
2. **P1:** SEC-005, SEC-006, SEC-007, SEC-008, SEC-009  
3. **P2 gates:** SEC-016 (DR drill), SEC-017 (monitoring) strongly recommended for external traffic  

All remediations: **Development first**; Production schema/deploy only with explicit approval.

---

## Out of scope / not modified

- No application code changes  
- No dependency upgrades  
- No Vercel/Railway/Supabase configuration writes as part of this assessment  
- No Production database access beyond configuration observation already established in prior ops work
