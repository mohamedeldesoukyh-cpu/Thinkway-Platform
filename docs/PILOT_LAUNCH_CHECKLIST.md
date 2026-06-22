# Pilot Launch Checklist — Remaining Blockers Only

**Target commit:** `e0c77d6`  
**Assessment date:** 19 Jun 2026  
**Purpose:** Single page of **open gates only**. Check each box when complete.

---

## Current status

# NOT READY FOR PILOT

All items below must be checked before changing status to **READY FOR PILOT**.

---

## P0 — Launch blockers (must complete)

### Database & migrations

| ☐ | Action | Owner | Doc |
|---|--------|-------|-----|
| ☐ | Run `MIGRATION_VERIFICATION.md` §3 SQL queries — all Pass | DBA | `MIGRATION_VERIFICATION.md` |
| ☐ | Apply `20260629010000_profile_role_escalation_guard.sql` if missing | DBA | §3.1 |
| ☐ | Apply `20260629020000_io_document_buckets_private.sql` if missing | DBA | §3.2 |
| ☐ | Apply client taxonomy patch (`production_client_classification_audit.sql` or individual `20260625*`–`20260628*` migrations) | DBA | §3.3 |
| ☐ | Confirm `20260531620000_billing_invoice_rls_hardening.sql` applied | DBA | §3.6 |
| ☐ | Reload PostgREST schema cache | DBA | Dashboard → API |

### Deployment

| ☐ | Action | Owner | Doc |
|---|--------|-------|-----|
| ☐ | Deploy commit `e0c77d6` (or later) to pilot Vercel environment | Dev/Ops | `DEPLOYMENT_VERIFICATION.md` §1 |
| ☐ | `/api/build-info` → `gitShaShort: e0c77d6` | Ops | §1.1 |
| ☐ | `NEXT_PUBLIC_SUPABASE_URL` + anon key set correctly | Ops | §2 |
| ☐ | `NEXT_PUBLIC_APP_URL` matches pilot browser URL | Ops | §2 |
| ☐ | Confirm `SUPABASE_SERVICE_ROLE_KEY` **not** in Vercel | Security | §2 |

### Security verification

| ☐ | Action | Owner | Doc |
|---|--------|-------|-----|
| ☐ | IO buckets `public = false` (SQL §3.2) | DBA | `MIGRATION_VERIFICATION.md` |
| ☐ | Vendor IO PDF via signed URL (not public URL) | QA | `DEPLOYMENT_VERIFICATION.md` §5 |
| ☐ | Client IO PDF via signed URL | QA | §5 |
| ☐ | Role escalation blocked (non-admin cannot change role) | Admin/DBA | §7.1 |
| ☐ | Unauthenticated `/campaigns` redirects to login | QA | §6.1 |

### UAT sign-off

| ☐ | Action | Owner | Doc |
|---|--------|-------|-----|
| ☐ | Sales section complete — Pass | Sales lead | `UAT_EXECUTION_GUIDE.md` |
| ☐ | Operations section complete — Pass | Ops lead | § Operations |
| ☐ | Finance section complete — Pass | Finance lead | § Finance |
| ☐ | Admin section complete — Pass | Admin | § Admin |
| ☐ | Critical path CP1–CP10 all Pass | QA lead | § Critical path |

### Monitoring (pilot minimum)

| ☐ | Action | Owner | Doc |
|---|--------|-------|-----|
| ☐ | Uptime synthetic monitor on `/api/build-info` (5 min interval) | Ops | `MONITORING_GAP_ANALYSIS.md` |
| ☐ | Vercel 5xx / deploy failure alert configured | Ops | § Vercel |
| ☐ | Supabase backup notification enabled | Ops | § Supabase |

---

## P1 — Strongly recommended before pilot (waivable with sign-off)

| ☐ | Action | Owner | Waiver signed |
|---|--------|-------|:-------------:|
| ☐ | DB restore drill completed and logged | DBA | ☐ |
| ☐ | Weekly storage manifest export scheduled | Ops | ☐ |
| ☐ | Git tag `v1.0.0-pilot` created at `e0c77d6` | Dev | ☐ |
| ☐ | Test accounts created for all 4 roles | Admin | ☐ |
| ☐ | Email provider configured (if Client IO email needed) | Ops | ☐ |

---

## When all P0 boxes are checked

1. Update this section:

```
## Current status

# READY FOR PILOT

Pilot authorized: _____________ (name) Date: _____________
Environment URL: ___________________________________________
```

2. Notify pilot users with `UAT_EXECUTION_GUIDE.md` link (for reference only — UAT already passed).

3. Monitor daily for first week: uptime alert, user-reported errors, Supabase dashboard.

---

## Explicitly out of scope for pilot launch

These do **not** block pilot (documented for post-pilot):

- Dedicated production Supabase project (separate from thinkway-dev)
- Sentry error tracking
- Custom domain `app.thinkway.com` cutover
- MFA for admin/finance
- Full 68-case UAT (critical path only required)
- Security headers (CSP/HSTS)

---

## Quick reference

| Document | Use when |
|----------|----------|
| `MIGRATION_VERIFICATION.md` | Applying / verifying DB |
| `DEPLOYMENT_VERIFICATION.md` | After Vercel deploy |
| `UAT_EXECUTION_GUIDE.md` | Business user testing |
| `BACKUP_DRILL_PLAN.md` | Before pilot + quarterly |
| `FINAL_GO_LIVE_RECOMMENDATION.md` | Overall program context |
| `PHASE_A_SECURITY_SIGNOFF.md` | Security fixes applied in code |

---

## Sign-off (complete when P0 all checked)

| Gate | Approver | Date | Signature |
|------|----------|------|-----------|
| Migrations verified | DBA | | |
| Deployment verified | Ops | | |
| UAT passed | QA / Product | | |
| Monitoring live | Ops | | |
| **Pilot authorized** | Sponsor | | |

---

**Last updated:** 19 Jun 2026 · Commit `e0c77d6` · Status: **NOT READY FOR PILOT**
