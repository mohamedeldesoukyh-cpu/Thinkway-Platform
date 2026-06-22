# Backup & Disaster Recovery Drill Plan

**Purpose:** Operational runbook if production data is lost. Execute once before pilot launch and quarterly thereafter.  
**RTO target:** Platform operational within **24 hours**  
**RPO target:** **24 hours** (daily backup) or **minutes** (PITR, if enabled)  
**Owner:** Ops / DBA

---

## Direct answer

> **If the production database is deleted tomorrow, can the platform be fully recovered?**

| Today (before drill) | After drill + proper config |
|----------------------|----------------------------|
| **Partially — not guaranteed** | **Yes — with documented steps and ≤24h RTO** |

**Conditions for full recovery:**

1. Supabase **daily backups enabled** with ≥30-day retention (or PITR on Pro+)
2. **Storage objects** recoverable (mirror export OR regenerate IO PDFs from DB)
3. **Vercel env vars** backed up in encrypted vault
4. **Git** tag at pilot release (`e0c77d6` or later)
5. This drill **executed and logged** at least once

---

## What is backed up automatically

| Asset | Supabase auto-backup | Notes |
|-------|:--------------------:|-------|
| PostgreSQL schema + data | ✅ (plan-dependent) | Includes `auth.users` |
| RLS policies | ✅ | Part of DB backup |
| Storage files (IO PDFs, legal docs) | ❌ | Separate from DB backup |
| Vercel application | ✅ (Git) | Redeploy from tag |

---

## Recovery time estimates

| Scenario | RTO (target) | RPO | Confidence |
|----------|:------------:|:---:|------------|
| Bad migration / table drop | **4 hours** | PITR: minutes; Daily: 24h | High if PITR enabled |
| Full project deletion | **8–12 hours** | Last daily backup | Medium — depends on Supabase support window |
| Storage bucket loss (DB intact) | **4–8 hours** | Last mirror or regenerate | Medium |
| Vercel outage only | **2 hours** | 0 | High — redeploy |
| Complete loss (DB + storage + no backups) | **Not recoverable** | — | — |

---

## DRILL 1 — Database recovery (required before pilot)

### Prerequisites

- [ ] Supabase project identified: ref `________________`
- [ ] Backup retention confirmed in Dashboard → Database → Backups
- [ ] Maintenance window communicated (drill uses **staging clone**, not production delete)

### Recommended approach: Restore to **new test project** (non-destructive)

| Step | Action | Owner | Time est. |
|------|--------|-------|-----------|
| 1 | Supabase Dashboard → Database → Backups | DBA | 5 min |
| 2 | Note latest backup timestamp: `________________` | DBA | 2 min |
| 3 | Restore backup to **new** Supabase project (or use PITR to new project) | DBA | 30–90 min |
| 4 | Record new project ref: `________________` | DBA | 1 min |
| 5 | Point **staging** Vercel env to restored project | Ops | 15 min |
| 6 | Redeploy `e0c77d6` to staging | Ops | 10 min |
| 7 | Run smoke tests (§Verification below) | QA | 30 min |
| 8 | Document result in §Drill log | DBA | 10 min |
| 9 | Delete test project (or keep as DR standby) | DBA | 5 min |

**Total estimated time:** 2–4 hours

### Verification after DB restore

```
☐ Login as admin works
☐ /clients list shows expected count
☐ /campaigns list loads
☐ Open one campaign → Assignments tab
☐ Invoice list in Finance loads
☐ /api/build-info → schema probes pass when signed in
```

### If production DB is actually deleted (emergency)

| Step | Action |
|------|--------|
| 1 | **Stop writes** — pause Vercel production deployments; post maintenance notice |
| 2 | Contact Supabase support immediately if project deleted (retention window limited) |
| 3 | Restore latest backup to **new** project |
| 4 | Update Vercel Production env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 5 | Verify migrations: run `MIGRATION_VERIFICATION.md` queries |
| 6 | Reload PostgREST schema cache |
| 7 | Run full smoke + critical path UAT (abbreviated) |
| 8 | Restore storage (Drill 2) or regenerate IO PDFs |
| 9 | Resume traffic |

**Emergency RTO:** 8–12 hours (experienced ops team)

---

## DRILL 2 — Storage recovery

### Inventory (private buckets)

| Bucket | Regenerable? | Recovery method |
|--------|:------------:|-----------------|
| `vendor-io-documents` | ✅ Yes | Regenerate PDF via `/api/vendor-ios/{id}/document?format=pdf` |
| `client-io-documents` | ✅ Yes | Regenerate via client IO API |
| `client-documents` | ❌ No | **Must restore from mirror** — legal uploads irreplaceable |
| `influencer-documents` | ❌ No | **Must restore from mirror** |
| `group-documents` | Partial | Depends on content |

### Preventive action (before pilot)

| Step | Action | Frequency |
|------|--------|-----------|
| 1 | Enable weekly Supabase Storage export OR S3 sync script | Weekly |
| 2 | Log manifest: bucket, object count, total size | Weekly |
| 3 | Store manifest off-platform (encrypted) | Weekly |

### Storage loss recovery steps

| Step | Action | Time est. |
|------|--------|-----------|
| 1 | Confirm DB intact (vendor_ios / client_ios rows exist) | 15 min |
| 2 | Regenerate all IO PDFs from API (script or manual sample) | 2–4 hours |
| 3 | Restore `client-documents` + `influencer-documents` from mirror | 2–8 hours |
| 4 | Verify signed URL download for each bucket type | 30 min |

---

## DRILL 3 — Application recovery (Vercel)

| Step | Action | Time est. |
|------|--------|-----------|
| 1 | Confirm Git tag `v1.0.0-pilot` (or `e0c77d6`) exists | 5 min |
| 2 | Vercel → New deployment from tag | 10 min |
| 3 | Restore env vars from vault | 15 min |
| 4 | `/api/build-info` smoke | 5 min |

**RTO:** ~2 hours

---

## DRILL 4 — Configuration backup

Export and store encrypted copies of:

| Item | Location | Backed up ☐ |
|------|----------|:-----------:|
| Vercel env vars (Production) | 1Password / vault | ☐ |
| Supabase anon key + URL | Vault | ☐ |
| DNS records | Registrar export | ☐ |
| Migration verification log | `MIGRATION_VERIFICATION.md` §4 | ☐ |

**Never store** `SUPABASE_SERVICE_ROLE_KEY` in Vercel — only in secure vault for break-glass scripts.

---

## Drill log (complete before pilot)

| Drill | Date | Participants | Backup used | Result | RTO achieved | Notes |
|-------|------|--------------|-------------|--------|:------------:|-------|
| DB restore to test project | | | | ☐ Pass ☐ Fail | | |
| Storage manifest export | | | | ☐ Pass ☐ Fail | | |
| Vercel redeploy from tag | | | | ☐ Pass ☐ Fail | | |
| Config vault export | | | | ☐ Pass ☐ Fail | | |

---

## Remaining risks (if drill not completed)

| Risk | Impact |
|------|--------|
| No restore drill logged | Cannot claim 24h RTO |
| Storage not mirrored | Legal documents lost irrecoverably if bucket deleted |
| Shared thinkway-dev for pilot | DR conflates dev and pilot data |
| No PITR | 24h data loss on daily backup restore |

---

## Sign-off

| Role | Name | Date | Drill complete |
|------|------|------|:--------------:|
| DBA / Ops | | | ☐ |
| Engineering | | | ☐ |
| Sponsor | | | ☐ |

**Pilot gate:** DB restore drill (Drill 1) must be **Pass** OR explicitly waived by sponsor with written risk acceptance.

---

## Cross-references

- `docs/BACKUP_AND_RECOVERY.md` — strategy
- `docs/BACKUP_VERIFICATION.md` — assessment
- `docs/PILOT_LAUNCH_CHECKLIST.md` — launch gates
