# Backup Verification — Can We Recover If the DB Is Deleted Tomorrow?

**Phase:** Go-Live Phase A  
**Date:** Jun 2026  
**Question:** If the Supabase database were deleted tomorrow, can Thinkway recover?

---

## Short answer

| Environment | Can we recover? | Confidence |
|-------------|-----------------|------------|
| **thinkway-dev** (`hsxrewjcbvmbkqdlzjhs`) | **Partially** — if Supabase daily backups enabled on plan | Medium — not verified in this sprint |
| **Dedicated production (not yet created)** | **Yes, if configured** — daily backup + 30-day retention + drill | Pending ops setup |
| **Full platform (DB + storage + app)** | **Within 24h RTO** per strategy | Requires backup drill proof |

**Verdict:** Strategy exists (`docs/BACKUP_AND_RECOVERY.md`); **operational proof is still pending**. Do not claim full recovery capability until a restore drill is logged.

---

## What Supabase backs up automatically

On Pro/Team plans, Supabase provides:

- **Daily automatic database backups** (retention 7–30+ days depending on plan)
- **Point-in-time recovery (PITR)** on eligible plans
- **Auth schema** (`auth.users`) included in project backup

**Storage objects are NOT fully covered** by DB backup alone. IO PDFs, client legal docs, and influencer KYC files live in Storage buckets separately.

---

## Recovery tiers

| Tier | Asset | Mechanism | RPO | RTO |
|------|-------|-----------|-----|-----|
| 1 | PostgreSQL (all transactional data) | Supabase daily backup / PITR | 24h (daily) or minutes (PITR) | 4h |
| 2 | Storage buckets | Manual mirror or regeneration | 24h–7d | 8h |
| 3 | Application | Git + Vercel redeploy | 0 | 2h |

---

## Current setup gaps

| Gap | Severity | Owner | Action |
|-----|----------|-------|--------|
| Codebase references thinkway-dev ref for prod alignment | **High** | Ops | Create dedicated production Supabase project |
| Backup policy not confirmed in dashboard | **High** | Ops | Enable daily backup + 30-day retention; screenshot/log |
| No completed restore drill | **High** | Ops/DBA | Quarterly drill per `BACKUP_AND_RECOVERY.md` |
| Storage not mirrored off-site | **High** | Ops | Weekly bucket export or S3 sync |
| IO docs now private — regeneration fallback available | Medium | Dev | Regenerate via API if DB rows + templates intact |

---

## If DB deleted tomorrow — step-by-step

### Scenario A: Accidental table drop / bad migration

1. Stop writes (maintenance mode / pause Vercel deploys)
2. Supabase Dashboard → Database → Backups → Restore to new project or PITR
3. Verify migration version: `npx supabase migration list --linked`
4. Run RLS audit SQL: `supabase/debug/invoice_line_items_rls_audit.sql`
5. Smoke test: login, campaign workspace, invoice list

### Scenario B: Full project deletion

1. Contact Supabase support immediately (backup retention window)
2. Restore from latest daily backup to new project
3. Update Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, anon key
4. Re-link Supabase CLI; verify all `202606*` migrations including Phase A security migrations
5. Restore storage from off-site mirror OR regenerate IO PDFs from DB HTML templates

### Scenario C: Storage bucket loss (DB intact)

1. Client/influencer legal docs — **cannot regenerate** — restore from mirror only
2. IO PDFs — regenerate via `/api/vendor-ios/[id]/document?format=pdf` and client IO equivalent
3. Update signed URL references if paths changed

---

## Pre go-live backup checklist

- [ ] Production Supabase project created (separate from dev)
- [ ] Daily backups enabled; retention ≥ 30 days
- [ ] PITR enabled if plan supports it
- [ ] Manual pre-migration snapshot before each production `db push`
- [ ] Vercel env vars exported to encrypted vault
- [ ] Git tag at release (`v1.0.0-pilot`)
- [ ] Restore drill completed and logged (date, backup ID, tester, result)
- [ ] Storage manifest export scheduled (weekly)

---

## Phase A impact on backup posture

- IO buckets moved to **private** — URLs in DB may be storage paths; recovery depends on bucket contents, not public CDN cache
- Role escalation trigger — included in DB backup once migration applied
- No change to backup tooling — documentation only

---

## Cross-references

- `docs/BACKUP_AND_RECOVERY.md` — full strategy
- `docs/DEPLOYMENT_GUIDE.md` — production project separation
- `docs/PHASE_A_SECURITY_SIGNOFF.md`
