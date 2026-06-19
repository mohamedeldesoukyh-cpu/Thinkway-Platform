# Monitoring Setup — Thinkway Production

**Scope:** Recommendations and implementation guidance for production observability. No full implementation in this phase (Sentry not currently wired).  
**Reviewed:** Jun 2026

---

## 1. Current state

| Capability | Status | Evidence |
|------------|--------|----------|
| Sentry / error tracking | **Not implemented** | No `@sentry/*` in codebase |
| Structured logging | **Partial** | `lib/platform/logger.ts` — dev-only console |
| Vercel Analytics | **Unknown** | Not referenced in repo — enable in dashboard |
| Supabase Dashboard metrics | **Available** | DB connections, API requests, Auth |
| Uptime monitoring | **Not configured** | No health check cron in repo |
| Alert routing | **Not configured** | — |
| Billing/IO failure alerts | **Not configured** | Debug flags in dev only (`OPERATIONAL_BILLING_TRACE`) |

**Existing probe:** `/api/build-info` — deploy verification, optional RLS schema probe when authenticated.

---

## 2. Recommended monitoring stack

| Layer | Tool | Purpose |
|-------|------|---------|
| **Errors & performance** | [Sentry](https://sentry.io) (`@sentry/nextjs`) | Uncaught exceptions, API 500s, PDF timeout |
| **Hosting** | Vercel Monitoring + Log Drains | Function duration, cold starts, bandwidth |
| **Database** | Supabase Dashboard + optional Logflare | Slow queries, connection pool, Auth failures |
| **Uptime** | Better Stack / Pingdom / UptimeRobot | External synthetic checks |
| **Logs** | Vercel Log Drain → Datadog/Axiom | Centralized search |

---

## 3. Alert categories

### 3.1 Failed logins / auth anomalies

| Signal | Source | Threshold | Action |
|--------|--------|-----------|--------|
| Auth failure rate spike | Supabase Auth logs | >20 failures / 5 min from single IP | Email/Slack ops |
| MFA bypass attempts | Supabase (when MFA enabled) | Any | Security review |
| New admin role assignment | `access_logs` / audit | Any `role_id` change | Finance + security notify |

**Implementation:**

1. Supabase → **Logs → Auth** — configure log drain
2. Sentry — tag auth errors in `/login` server actions
3. Optional: Edge function counting failures per IP

### 3.2 API failures

| Signal | Source | Threshold |
|--------|--------|-----------|
| 5xx rate on `/api/*` | Sentry + Vercel | >1% over 15 min |
| PDF generation timeout | Vercel function logs | `maxDuration` exceeded |
| 503 from Puppeteer | `vendor-io-pdf.ts` | Any in production |

**Implementation (Sentry):**

```typescript
// next.config.ts — after @sentry/nextjs wizard
// instrumentation.ts — register Sentry for App Router
// Wrap API routes: captureException in catch blocks
```

Priority routes to instrument:

- `app/api/vendor-ios/[id]/document/route.ts`
- `app/api/invoices/[id]/document/route.ts`
- `app/api/client-ios/[id]/document/route.ts`
- `app/api/reports/*/document/route.ts`

### 3.3 Database failures

| Signal | Source | Threshold |
|--------|--------|-----------|
| Connection pool exhausted | Supabase metrics | >80% pool usage |
| RLS denial spike | Postgres logs (`42501`) | Unusual increase |
| Migration drift | Scheduled `migration list` job | Local ≠ Remote |
| Slow queries | Supabase Query Performance | p95 > 2s on campaign workspace |

**Implementation:**

- Enable Supabase **Database Webhooks** for critical table errors (optional)
- Weekly automated check: curl build-info + compare migration list in CI

### 3.4 Invoice / IO generation failures

| Signal | Source | Threshold |
|--------|--------|-----------|
| VIO generate action failure | Sentry breadcrumb on `generateVendorIosFromLinesAction` | Any user-facing failure |
| Invoice create pipeline failure | `repair-invoice-create-pipeline.ts` errors | Any |
| PDF render failure | `renderHtmlToPdf` 503 responses | >3/hour |
| IO approval token errors | RPC `approve_vendor_io_by_token` exceptions | Spike may indicate abuse |
| Sequence collision | `document_sequences` unique violations | Immediate page |

**Implementation:**

- Add Sentry `captureMessage` in:
  - `features/io/generate-vendor-io-action.ts` (failure return paths)
  - `features/billing/actions.ts` (invoice create failures)
  - `lib/io/vendor-io-pdf.ts` (Puppeteer errors)
- Tag events: `{ module: "billing" | "vendor_io" | "client_io" }`

---

## 4. Sentry implementation steps

### Phase 1 — Install (1–2 hours)

```bash
npx @sentry/wizard@latest -i nextjs
```

Creates:

- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Updates `next.config.ts` with `withSentryConfig`

### Phase 2 — Configure

| Env var (Vercel) | Purpose |
|------------------|---------|
| `SENTRY_DSN` | Project DSN |
| `SENTRY_AUTH_TOKEN` | Source map upload (CI) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side (if needed) |
| `SENTRY_ENVIRONMENT` | `production` / `preview` |

**Settings:**

- `tracesSampleRate: 0.1` in production (adjust cost)
- `beforeSend` — scrub PII (emails, tokens)
- Ignore `NEXT_NOT_FOUND` and auth redirect noise

### Phase 3 — Server actions

Wrap critical server actions:

```typescript
import * as Sentry from "@sentry/nextjs";

try {
  // ... mutation
} catch (error) {
  Sentry.captureException(error, { tags: { action: "createInvoiceFromLines" } });
  throw error;
}
```

### Phase 4 — Alerts in Sentry

| Alert rule | Condition | Notify |
|------------|-----------|--------|
| Production errors | `environment:production`, new issue | #ops-alerts Slack |
| Billing regression | `tags.module:billing`, >5 events/hr | Finance + dev |
| PDF failures | message contains `Puppeteer` or status 503 | Dev |

---

## 5. Vercel monitoring

### Enable in dashboard

1. **Vercel → Project → Analytics** — Web Vitals
2. **Vercel → Project → Monitoring** (Pro) — function metrics
3. **Log Drain** → Axiom/Datadog for retention beyond 1 hour

### Key metrics

| Metric | Warning | Critical |
|--------|---------|----------|
| Function duration (PDF routes) | >45s | >58s (timeout imminent) |
| Error rate | >0.5% | >2% |
| Edge middleware latency | >200ms p95 | >500ms |

### Synthetic check (UptimeRobot)

```
GET https://app.thinkway.com/api/build-info
Expected: HTTP 200, body contains "thinkway-platform"
Interval: 5 minutes
```

Optional authenticated check — store session cookie in vault (advanced).

---

## 6. Supabase monitoring

### Dashboard widgets

- Database CPU / memory
- Active connections
- Auth MAU
- Storage egress (IO PDF bandwidth)

### Log drains

Configure in Supabase → **Logs → Log Drains**:

- Postgres logs (RLS violations, deadlocks)
- Auth logs (failed sign-in)
- API gateway (REST/Realtime abuse)

### Recommended alerts (Supabase / external)

| Alert | Condition |
|-------|-----------|
| DB down | Health check fails 3× |
| Disk >80% | Email ops |
| Auth email rate limit | Unusual spike |

---

## 7. Dashboards (recommended)

### Executive / ops (weekly review)

- Uptime %
- Error count by module
- Invoice generation success rate
- VIO generation count vs failures

### Finance ops (daily during go-live)

- Invoice create/regenerate failures
- Pending financial approvals count
- Document sequence gaps

**Data source:** Mix of Sentry, Supabase SQL (scheduled report), and app analytics tables.

---

## 8. Implementation priority

| Priority | Item | Effort | Owner |
|----------|------|--------|-------|
| P0 | Uptime check on `/api/build-info` | 30 min | Ops |
| P0 | Supabase backup alert (built-in email) | 15 min | Ops |
| P1 | Sentry Next.js integration | 4 hr | Dev |
| P1 | Sentry alerts for billing/IO tags | 2 hr | Dev |
| P2 | Vercel log drain | 2 hr | Ops |
| P2 | Supabase auth failure log drain | 2 hr | Ops |
| P3 | Custom finance dashboard | 1 week | Dev + Finance |

---

## 9. Runbook links

| Incident | First check |
|----------|-------------|
| Site down | UptimeRobot + Vercel status |
| Login broken | Supabase Auth logs |
| PDF export fails | Vercel function logs + Sentry |
| Invoice won't create | Sentry `billing` tag + `OPERATIONAL_BILLING_TRACE` in staging |
| Wrong data shown | RLS audit SQL + user role in `profiles` |

---

## Cross-references

- `docs/SECURITY_AUDIT.md` — API exposure, auth
- `docs/DEPLOYMENT_GUIDE.md` — build-info verification
- `docs/BACKUP_AND_RECOVERY.md` — incident recovery
- `docs/GO_LIVE_READINESS.md` — monitoring gate
