# Thinkway Platform — Production Infrastructure Readiness Report

**Assessment date:** 26 July 2026  
**Mode:** Read-only (no infrastructure changes, deployments, secret rotation, or database modifications)  
**Related:** `ENVIRONMENT_ISOLATION_AUDIT_2026-07-26.md` · `ENTERPRISE_SECURITY_ASSESSMENT_2026-07-26.md` · `CREATOR_INTELLIGENCE_RLS_VALIDATION_2026-07-26.md`

---

## Executive verdict

**Not ready for unconditional external Production GO.**

Canonical Production app (`app.thinkwaymedia.com`) is aligned to Production Supabase (`ienowhwfyxoqtzbgltno`) with live security headers and Ops Center primitives. Blocking gaps: incomplete environment isolation, soft Production deploy gate, in-memory rate limits, stubbed error monitoring, unproven backup/restore, thin CI security, and Redis/worker durability unverified.

| Metric | Value |
|--------|------:|
| **Production Readiness Score** | **54 / 100** |
| Critical findings | 2 |
| High findings | 11 |
| Medium findings | 10 |
| Low / Informational | 8 |

**Score interpretation:** &lt;60 = not ready for broad external traffic; 60–79 = limited pilot with compensating controls; ≥80 = Production-ready with residual backlog.

---

## Production Readiness Score (by area)

| Area | Score | Weight | Weighted | Notes |
|------|------:|-------:|---------:|-------|
| Vercel / deploy controls | 50 | 12% | 6.0 | Hosts aligned; Preview leak; Prod Git still deploys |
| Supabase (authz/RLS/config) | 68 | 14% | 9.5 | Dual projects OK; CI RLS on Dev; Prod CI migrate pending; PITR unknown |
| Redis | 42 | 10% | 4.2 | Prod `REDIS_URL` present; Dev Redis missing; persistence unproven |
| Railway workers | 52 | 8% | 4.2 | Dockerfile/ON_FAILURE; Railway env not verified; DLQ partial |
| Storage | 65 | 8% | 5.2 | IO private; avatars public; MIME empty-type gap |
| DNS & SSL | 78 | 8% | 6.2 | `app`/`dev` → 76.76.21.21; HSTS live; apex NS still GoDaddy |
| Monitoring | 38 | 10% | 3.8 | Ops Center yes; Sentry stubbed; no uptime product |
| Logging | 55 | 6% | 3.3 | Structured + audit; no SIEM; redaction denylist incomplete |
| Backups & recovery | 28 | 10% | 2.8 | Docs exist; drill log empty; storage mirror missing |
| CI/CD | 40 | 7% | 2.8 | Functional gates; no audit/Dependabot/secret scan |
| Security headers | 72 | 4% | 2.9 | Full set live; CSP unsafe-inline/eval |
| Rate limiting | 35 | 3% | 1.1 | Wired categories; in-memory on serverless |
| **Total** | | **100%** | **54** | |

---

## Evidence highlights (live)

### Build alignment

| Surface | environment | supabaseProjectRef | aligned | gitShaShort |
|---------|-------------|-------------------:|:-------:|-------------|
| `app.thinkwaymedia.com` | production | `ienowhwfyxoqtzbgltno` | true | `c5803af` |
| `dev.thinkwaymedia.com` | development | `hsxrewjcbvmbkqdlzjhs` | true | `1f1c096` |

### Security headers (Production response)

Observed on `GET /api/build-info` via Vercel:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Content-Security-Policy: … script-src 'self' 'unsafe-inline' 'unsafe-eval' …`

### DNS

- `app.thinkwaymedia.com` → `76.76.21.21` (Vercel)
- `dev.thinkwaymedia.com` → `76.76.21.21` (Vercel)
- Apex `thinkwaymedia.com` nameservers still **GoDaddy** (`domaincontrol.com`), not Vercel NS

### Vercel env associations

- Shared `Production+Preview` (no branch): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REDIS_URL`: Production only (no Preview/`develop`)
- Recent list shows multiple **Ready Production** deployments from Git history

---

## Findings register

### Critical

| ID | Category | Description | Evidence | Risk |
|----|----------|-------------|----------|------|
| INF-C01 | Backups & Recovery | No executed restore drill; drill log empty | `docs/BACKUP_DRILL_PLAN.md` | Unverified RTO/RPO; catastrophic recovery unproven |
| INF-C02 | Env isolation | Preview association still shares Production public Supabase URL/anon | `vercel env ls` | Non-develop Preview can hit Production PostgREST |

### High

| ID | Category | Description | Evidence | Risk |
|----|----------|-------------|----------|------|
| INF-H01 | Vercel / Deploy | Production Git deploys complete without hard approval | `vercel list` Ready Production; soft `ignoreCommand` | Unapproved Production releases |
| INF-H02 | Redis | No dedicated Development Redis on Preview/`develop` | env ls | Queue/worker isolation incomplete on Dev host |
| INF-H03 | Rate limiting | In-memory Map on serverless | `lib/security/rate-limit.ts` | Auth/AI/export limits ineffective under scale |
| INF-H04 | Monitoring | Sentry/SDK not installed; error reporter no-ops for DSN | `error-reporter.ts`, `package.json` | Silent Production failures |
| INF-H05 | CSP | `unsafe-inline` + `unsafe-eval` on scripts | Live CSP header | Amplifies XSS impact |
| INF-H06 | CI/CD | No dependency/secret scanning in CI | `.github/workflows/validate.yml` | Supply-chain CVEs land unnoticed |
| INF-H07 | Backups | Storage objects not mirrored off-provider | `BACKUP_AND_RECOVERY.md` | Permanent loss of KYC/legal docs |
| INF-H08 | Backups | PITR availability on Prod Supabase not verified | Docs “plan-dependent” | Up to 24h data loss if daily-only |
| INF-H09 | Redis durability | Persistence/AOF/RDB for Prod Redis not verified | Handover DR notes | Queue/job loss on Redis wipe |
| INF-H10 | Workers | Railway Production env binding not verified this audit | No Railway CLI | Possible wrong-env worker |
| INF-H11 | Secrets | Preview/`develop` missing `SUPABASE_SERVICE_ROLE_KEY` | env ls | Dev admin paths broken / inconsistent |

### Medium

| ID | Category | Description | Evidence |
|----|----------|-------------|----------|
| INF-M01 | Rate limit | Identity is IP-only (no userId post-auth) | `request-guard.ts` |
| INF-M02 | Storage | Empty Content-Type bypasses app MIME allowlist | `lib/supabase/storage.ts` |
| INF-M03 | Storage | Public `creator-avatars` bucket | migration `20260630100000_*` |
| INF-M04 | Storage | App allows video MIME; some bucket policies omit video | storage.sql vs storage.ts |
| INF-M05 | CI/CD | Workflow may inject service-role for browse measure | `validate.yml` |
| INF-M06 | CI/CD | No `permissions:` least-privilege on workflow | validate.yml |
| INF-M07 | Workers | DLQ only for creator-enrichment; other queues log-only | worker code |
| INF-M08 | Logging | Structured logger lacks secret-key denylist | prior SEC-018 |
| INF-M09 | DNS | Apex NS not on Vercel (subdomains OK via A) | domain inspect |
| INF-M10 | Headers | `applySecurityHeaders` skips overwrite if header present | security-headers.ts |

### Low / Informational

| ID | Category | Description |
|----|----------|-------------|
| INF-L01 | Headers | Full baseline header set implemented and live |
| INF-L02 | Ops | Ops Center + `/api/ready` + `/api/build-info` usable |
| INF-L03 | Storage | IO document buckets private (migration applied) |
| INF-L04 | Workers | Railway `ON_FAILURE` restart ×10; Dockerfile present |
| INF-L05 | Redis | Web BullMQ path enables TLS for `rediss:` |
| INF-L06 | RLS | Creator Intelligence least-privilege applied on **Development** (Prod migrate pending approval) |
| INF-L07 | URL security | Safe external URL utility shipped (app deploy pending) |
| INF-I01 | Dual path | Headers in `next.config` + proxy guard |

---

## Updated Risk Register (infrastructure)

| Risk ID | Severity | Status | Owner theme | Residual if unfixed |
|---------|----------|--------|-------------|---------------------|
| INF-C01 | Critical | Open | DR | Cannot certify recovery |
| INF-C02 | Critical | Open | Isolation | Prod data via Preview |
| INF-H01 | High | Open | Release | Uncontrolled Prod ship |
| INF-H02–H04 | High | Open | Abuse / Observability | Stuffing, blind ops |
| INF-H05–H06 | High | Open | AppSec / Supply chain | XSS amplify, CVE lag |
| INF-H07–H09 | High | Open | Durability | Data/job loss |
| INF-H10–H11 | High | Open | Workers / Dev ops | Wrong-env / broken Dev |
| SEC-003 Prod | High | Open | RLS | Portal CI read on Prod until migrate |
| SEC-001 | Critical (ops) | Open | CLI | Wrong CLI target locally |

---

## Remediation plan (phased — not executed)

### P0 — before external Production traffic

1. Detach Preview from shared Production `NEXT_PUBLIC_SUPABASE_*` (ENV-01 / INF-C02).  
2. Structurally disable auto Production deploys from `main` in Vercel UI (INF-H01).  
3. Provision dedicated Development Redis; set Preview/`develop` `REDIS_URL` only (INF-H02).  
4. Add Dev `SUPABASE_SERVICE_ROLE_KEY` on Preview/`develop` only (INF-H11).  
5. Confirm Production Supabase **PITR** enabled; run and **log Drill 1** restore (INF-C01, INF-H08).  
6. Apply Creator Intelligence RLS migration to Production **only with approval** (SEC-003).  

### P1 — within 2 weeks of pilot

7. Redis-backed rate limiting (INF-H03).  
8. Install `@sentry/nextjs`; set DSN on Dev + Prod (INF-H04).  
9. CI: `npm audit` job + Dependabot + workflow `permissions` (INF-H06, INF-M05–M06).  
10. Verify Railway worker → Prod Supabase + Prod Redis only; document (INF-H10).  
11. Confirm Redis persistence (AOF/RDB) and snapshot policy (INF-H09).  
12. Weekly storage export to independent object store (INF-H07).  

### P2 — hardening backlog

13. CSP nonce / drop `unsafe-eval` (INF-H05).  
14. MIME magic-byte validation; bucket/app allowlist parity (INF-M02–M04).  
15. Expand DLQ / failed-job terminal status for all queues (INF-M07).  
16. Logger secret denylist (INF-M08).  
17. Post-auth rate-limit by userId (INF-M01).  
18. Align apex DNS NS or keep explicit A/CNAME docs (INF-M09).  

---

## Area assessments (summary)

### 1. Vercel
Dual-host model works for `develop`/`app`. Preview isolation and Production approval are the main failures.

### 2. Supabase
Dedicated Prod project exists and is live. Auth/RLS program advanced (finance + CI RLS on Dev). Prod PITR, connection limits, and extension inventory not dashboard-verified in this read-only pass.

### 3. Redis
Production URL present. Dev dedicated instance missing. Auth/TLS assumed via managed `rediss://` (not re-probed). Persistence/backup unknown.

### 4. Railway workers
Repo config is sound (Docker, retries, restart). Runtime secret isolation **not inspected**. DLQ incomplete across queues.

### 5. Storage
IO buckets private; avatars public by design. Upload validation gaps remain. Signed URLs used with long email TTLs.

### 6. DNS & SSL
`app`/`dev` resolve to Vercel; HSTS preload-class max-age live. Apex NS still third-party.

### 7. Monitoring
Ops Center + build-info/ready. No Sentry, no external uptime product evidenced.

### 8. Logging
Structured logs + `audit_logs`. No centralized SIEM retention policy evidenced.

### 9. Backups & recovery
Documentation complete; **execution incomplete**.

### 10. CI/CD
Functional quality gates only; security scanning absent.

### 11. Security headers
Implemented and confirmed live; CSP not load-bearing against XSS.

### 12. Rate limiting
Categories mapped via proxy; ineffective under multi-instance without Redis.

---

## Constraints honored

- Read-only assessment  
- No infrastructure changes  
- No deployments  
- No secret rotation  
- No database modifications  

---

## Next gate

Re-score after P0 items close. Target score **≥ 80** before unconditional Production GO for external/client-facing traffic.
