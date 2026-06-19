# Production Deployment Checklist — Thinkway

**Purpose:** Gate checklist before production deployment or domain cutover (`app.thinkway.com`).  
**Branch:** `feature/campaign-client-bo-attachment` @ `b5e3502` (merge to `main` before production deploy)  
**Date:** 19 Jun 2026

Complete every section. Do not cut over DNS until §1–§7 are green.

---

## 1. Code & build

| # | Item | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1.1 | Merge go-live branch to `main` | Dev | ☐ | Includes Phase A + UAT fixes |
| 1.2 | `npm run build` passes on CI/Vercel | Dev | ☑ | Verified @ `b5e3502` |
| 1.3 | No open Critical/High security findings in code | Security | ☑ | Phase A remediated — see `PHASE_A_SECURITY_SIGNOFF.md` |
| 1.4 | Git tag release | Dev | ☐ | e.g. `v1.0.0-pilot` |
| 1.5 | `/api/build-info` returns expected SHA after deploy | Ops | ☐ | `gitSha` matches tag |

---

## 2. Supabase project

| # | Item | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 2.1 | Dedicated production project (recommended) OR confirmed dev pilot | Ops | ☐ | Current ref: `hsxrewjcbvmbkqdlzjhs` (thinkway-dev) |
| 2.2 | All migrations applied | DBA | ☐ | `npx supabase migration list --linked` — local = remote |
| 2.3 | **Phase A security migrations** | DBA | ☐ | `20260629010000_profile_role_escalation_guard.sql` |
| | | | ☐ | `20260629020000_io_document_buckets_private.sql` |
| 2.4 | Invoice RLS hardening | DBA | ☐ | `20260531620000_billing_invoice_rls_hardening.sql` |
| 2.5 | Client taxonomy / schema patch | DBA | ☐ | `supabase/scripts/production_client_classification_audit.sql` |
| 2.6 | PostgREST schema cache reloaded | DBA | ☐ | Supabase Dashboard → Settings → API → Reload schema |
| 2.7 | RLS audit spot-check | DBA | ☐ | `supabase/debug/invoice_line_items_rls_audit.sql` |
| 2.8 | Daily backups enabled, retention ≥ 30 days | Ops | ☐ | Screenshot logged |
| 2.9 | PITR enabled (if plan supports) | Ops | ☐ | |

---

## 3. Environment variables (Vercel Production)

| # | Variable | Required | Set | Verified |
|---|----------|----------|:---:|:--------:|
| 3.1 | `NEXT_PUBLIC_SUPABASE_URL` | Yes | ☐ | ☐ |
| 3.2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ☐ | ☐ |
| 3.3 | `NEXT_PUBLIC_APP_URL` | Yes | ☐ | Must match production domain |
| 3.4 | `OPENAI_API_KEY` (classification) | If using AI classify | ☐ | ☐ |
| 3.5 | `SERPER_API_KEY` or search alternative | If using AI classify | ☐ | ☐ |
| 3.6 | Email provider vars (Resend/SMTP) | If Client IO email | ☐ | ☐ |
| 3.7 | `REDIS_URL` | Only if Discovery enabled | ☐ | ☐ |
| 3.8 | **No** `SUPABASE_SERVICE_ROLE_KEY` in Vercel | Security | ☐ | Service role scripts only |

**Never commit:** `.env`, `.env.local`, service role keys.

---

## 4. Storage buckets

| Bucket | Private | Policies | Phase A | Verified |
|--------|---------|----------|---------|:--------:|
| `client-documents` | Yes | Path-scoped RLS | Pre-Phase A | ☐ |
| `influencer-documents` | Yes | Path-scoped RLS | Pre-Phase A | ☐ |
| `vendor-io-documents` | **Yes** (was public) | Authenticated read | `20260629020000` | ☐ |
| `client-io-documents` | **Yes** (was public) | Authenticated read | `20260629020000` | ☐ |
| `group-documents` | Yes | Per migration | | ☐ |

**Post-deploy test:** Generate VIO → open PDF inline → confirm signed URL (not public URL). Repeat for Client IO.

---

## 5. Authentication & authorization

| # | Item | Status | Verification |
|---|------|--------|--------------|
| 5.1 | Login / logout / session refresh | ☐ | Sign in as admin, refresh page |
| 5.2 | Unauthenticated redirect to `/login` | ☐ | Open `/campaigns` logged out |
| 5.3 | Role escalation trigger active | ☐ | Non-admin cannot change own `role_id` (see `ROLE_ESCALATION_FIX.md`) |
| 5.4 | Finance cannot create campaigns | ☐ | UAT 2.2.2 |
| 5.5 | Viewer read-only | ☐ | UAT 1.1.3, 8.2 |
| 5.6 | IO document routes require auth | ☐ | 401 without session on `/api/vendor-ios/.../document` |
| 5.7 | Enrich API requires `influencers.write` | ☐ | 403 for unauthorized role |

---

## 6. Domain & HTTPS (cutover)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | Domain added in Vercel (`app.thinkway.com`) | ☐ | |
| 6.2 | DNS CNAME/A configured | ☐ | |
| 6.3 | TLS certificate active (auto) | ☐ | Vercel Let's Encrypt |
| 6.4 | `platform.thinkway.com` redirect to primary | ☐ | Optional |
| 6.5 | `NEXT_PUBLIC_APP_URL` updated to production domain | ☐ | IO approval links depend on this |
| 6.6 | Preview deployments restricted (optional) | ☐ | Vercel → Deployment Protection |
| 6.7 | Security headers (CSP, HSTS) | ☐ | Phase B — document in `DEPLOYMENT_GUIDE.md` §6 |

---

## 7. Email functionality

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7.1 | Email provider configured in Vercel | ☐ | |
| 7.2 | Client IO send test | ☐ | Check `io_notifications` table |
| 7.3 | Vendor IO approval email (if used) | ☐ | |
| 7.4 | Invite / password reset (Supabase Auth) | ☐ | Supabase → Auth → URL configuration |

---

## 8. Monitoring (pilot minimum)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8.1 | Uptime synthetic on `/api/build-info` | ☐ | UptimeRobot / Better Stack — 5 min interval |
| 8.2 | Vercel deploy + 5xx alert | ☐ | |
| 8.3 | Supabase backup failure notification | ☐ | |
| 8.4 | Sentry (recommended) | ☐ | Not installed — see `MONITORING_GAP_ANALYSIS.md` |

---

## 9. Post-deploy smoke (15 minutes)

Run immediately after production deploy:

```
☐ GET /api/build-info → 200, productionReady: true (or documented exception)
☐ Login as super_admin
☐ Open /clients → list loads
☐ Open /campaigns → list loads
☐ Open one campaign workspace → Assignments tab loads
☐ Generate test VIO (or open existing) → PDF opens via signed URL
☐ Billing tab reflects IO without hard refresh
☐ Finance → one report HTML export
```

---

## 10. Sign-off

| Gate | Approver | Date | Approved |
|------|----------|------|:--------:|
| Engineering | | | ☐ |
| DBA / Ops | | | ☐ |
| Security | | | ☐ |
| Product / QA | | | ☐ |

**Deployment authorized only when:** §1–§7 complete, §8.1 minimum monitoring live, §9 smoke pass, `UAT_EXECUTION_REPORT.md` critical path signed off.

---

## Cross-references

- `docs/DEPLOYMENT_GUIDE.md` — detailed Vercel + Supabase setup
- `docs/PRODUCTION_MANDATORY_DEPLOY.md` — lifecycle migration sequence
- `docs/BACKUP_VERIFICATION.md` — recovery capability
- `docs/FINAL_GO_LIVE_RECOMMENDATION.md` — overall decision
