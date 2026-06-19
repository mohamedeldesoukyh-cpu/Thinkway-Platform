# Monitoring Gap Analysis — Phase A

**Scope:** Sentry, Vercel, Supabase alerts for pilot go-live  
**Date:** Jun 2026  
**Baseline:** `docs/MONITORING_SETUP.md`

---

## Current state

| Capability | Status | Risk for pilot |
|------------|--------|----------------|
| Sentry (`@sentry/nextjs`) | **Not installed** | **High** — blind to production 500s |
| Vercel function monitoring | Dashboard only, no alerts | **Medium** |
| Supabase Auth/DB alerts | Not configured | **Medium** |
| Uptime synthetic | Not configured | **High** — no external health check |
| Structured logging | Dev-only (`lib/platform/logger.ts`) | **Medium** |
| `/api/build-info` probe | Implemented | **Low** — usable as minimum uptime check |

---

## Critical gaps (address before steady-state production)

### 1. No error tracking

**Impact:** PDF generation failures, IO send errors, invoice pipeline exceptions go unnoticed until user reports.

**Recommendation:**

```bash
npx @sentry/wizard@latest -i nextjs
```

Instrument priority routes:

- `app/api/vendor-ios/[id]/document/route.ts`
- `app/api/client-ios/[id]/document/route.ts`
- `app/api/invoices/[id]/document/route.ts`
- `features/io/actions.ts` (send/generate failures)

**Alert:** >5 errors / 15 min on `production` environment.

### 2. No uptime monitoring

**Impact:** Complete outage undetected until manual check.

**Minimum viable (pilot condition 6 in go-live readiness):**

- UptimeRobot / Better Stack synthetic GET on `/api/build-info` every 5 min
- Alert on non-200 or missing `productionReady: true` in response

### 3. No Supabase backup failure alerts

**Impact:** Silent backup gaps — see `docs/BACKUP_VERIFICATION.md`.

**Recommendation:** Supabase Dashboard → Project Settings → enable backup notifications; weekly manual verification.

---

## High-priority alert recommendations

| Signal | Source | Threshold | Channel |
|--------|--------|-----------|---------|
| API 5xx rate | Sentry + Vercel | >1% / 15 min | Slack `#ops` |
| PDF timeout (`maxDuration` exceeded) | Vercel logs | Any in prod | Slack |
| Auth failure spike | Supabase Auth logs | >20 / 5 min / IP | Email security |
| Role change | `access_logs` action `role_changed` | Any | Email admin |
| Invoice sequence collision | Postgres unique violation | Immediate | Pager |
| Migration drift | CI job `supabase migration list` | Local ≠ Remote | Block deploy |

---

## Vercel-specific

| Item | Action |
|------|--------|
| Enable Log Drain | Ship to Axiom/Datadog for search |
| Function duration alerts | Watch PDF routes (60s limit in `vercel.json`) |
| Deploy notifications | Slack on production deploy |
| Security headers | Add CSP/HSTS in `vercel.json` (Phase B) |

---

## Supabase-specific

| Item | Action |
|------|--------|
| Connection pool usage | Alert >80% |
| RLS denial spike (`42501`) | Unusual increase may indicate attack or misconfiguration |
| Storage egress spike | May indicate IO document scraping attempt |
| Database size growth | Weekly review |

---

## Phase A security monitoring additions

After Phase A deploy, monitor:

1. **Profile trigger denials** — Postgres logs for `Insufficient privileges to modify role or account status`
2. **401 rate on enrich API** — expect increase if clients lacked permission (validates fix)
3. **Signed URL 403/404** — storage access after bucket privatization

---

## Pilot minimum (week 1)

| # | Action | Effort |
|---|--------|--------|
| 1 | Uptime check on `/api/build-info` | 30 min |
| 2 | Supabase backup notification enabled | 15 min |
| 3 | Vercel deploy + 5xx email alert | 30 min |
| 4 | Sentry Phase 1 (errors only) | 2–4 hours |

Full Sentry + log drains + custom dashboards = Phase B (see `docs/MONITORING_SETUP.md`).

---

## Cross-references

- `docs/MONITORING_SETUP.md` — detailed implementation guide
- `docs/GO_LIVE_READINESS.md` — monitoring verdict
- `docs/PHASE_A_SECURITY_SIGNOFF.md`
