# Backup & Recovery Strategy — Thinkway Platform

**Scope:** Documentation-only recovery strategy for production go-live. No infrastructure implementation in this phase.  
**Goal:** Recover operational capability within **24 hours** of a major incident.  
**Stack:** Supabase (PostgreSQL + Storage) · Vercel (stateless app)

---

## 1. Recovery objectives

| Tier | RTO (max downtime) | RPO (max data loss) | Scope |
|------|-------------------|---------------------|-------|
| **Tier 1 — Database** | 4 hours | 24 hours (daily backup) | All transactional data |
| **Tier 2 — File storage** | 8 hours | 24 hours | Documents, IO PDFs, attachments |
| **Tier 3 — Application** | 2 hours | 0 (git/Vercel) | Next.js deployment |
| **Overall program target** | **24 hours** | **24 hours** | Full platform restore |

---

## 2. Database backup

### Current Supabase capabilities

Supabase Pro/Team plans include:

- **Daily automatic backups** (retention varies by plan: 7 days default; configurable up to 30+ on Enterprise)
- **Point-in-time recovery (PITR)** on eligible plans (fine-grained restore)

**Current project reference in codebase:** `hsxrewjcbvmbkqdlzjhs` (thinkway-dev per `lib/deploy/build-info.ts`). Production go-live should use a **dedicated production project** with backup policy enabled.

### Recommended production policy

| Setting | Value |
|---------|-------|
| Backup frequency | Daily automatic + enable PITR if available |
| Retention | **30 days** minimum |
| Backup region | Same as primary (document in runbook) |
| Pre-migration snapshot | Manual backup before each `supabase db push` to production |

### What is backed up

All PostgreSQL schemas including:

- `public` — clients, brands, campaigns, lines, assignments, invoices, vendor_ios, client_ios, approvals, audit_logs, document_sequences
- `intelligence` — warehouse tables (if ETL loaded)
- Auth schema — `auth.users` (managed by Supabase; included in project backup)

### Manual backup procedure

1. Supabase Dashboard → **Project → Database → Backups**
2. Click **Create backup** (or use CLI/API if on Enterprise)
3. Record: backup ID, timestamp, migration version (`npx supabase migration list --linked`)
4. Store note in ops channel / ticket

**Alternative (logical dump for portability):**

```bash
# Requires linked project and pg_dump access (Supabase CLI or direct connection)
npx supabase db dump -f backup-YYYY-MM-DD.sql
```

Store dump in encrypted object storage (S3/Azure Blob) separate from Supabase.

---

## 3. File storage backup

### Buckets in use

| Bucket | Content | Public | Criticality |
|--------|---------|--------|-------------|
| `client-documents` | Trade license, VAT, contracts | Private | **High** |
| `influencer-documents` | Vendor KYC, bank letters | Private | **High** |
| `group-documents` | Group-level legal | Private | Medium |
| `vendor-io-documents` | Generated Vendor IO HTML/PDF | Public flag | **High** |
| `client-io-documents` | Generated Client IO HTML/PDF | Public flag | **High** |
| Portal uploads | Client/creator portal files | Private | Medium |

Paths referenced in DB columns: `client_documents.storage_path`, `vendor_ios.generated_pdf_url`, `client_ios.generated_html_url`, etc.

### Backup strategy

Supabase Storage does **not** replace cross-region backup. Recommended approach:

| Method | Frequency | Retention |
|--------|-----------|-----------|
| **Supabase storage sync to S3** (Enterprise / custom job) | Daily | 30 days |
| **Manual bucket export** via `supabase storage` CLI or script listing all objects | Weekly | 30 days |
| **Regeneration fallback** for IO PDFs | On demand | N/A — regenerate from DB HTML templates if source HTML stored |

**Priority order for restore:**

1. Client legal documents (`client-documents`) — cannot regenerate
2. Influencer bank/KYC (`influencer-documents`)
3. IO PDFs — regenerate via `/api/vendor-ios/[id]/document?format=pdf` if DB rows intact
4. Portal uploads

### Storage backup script (ops — not in repo)

Document for ops team:

```bash
# Pseudocode — implement as scheduled GitHub Action or cron with service role
# 1. List all buckets
# 2. For each object, copy to s3://thinkway-backups/storage/{bucket}/{path}
# 3. Log manifest with checksums
```

---

## 4. Application / configuration backup

| Asset | Backup mechanism | Notes |
|-------|------------------|-------|
| Application code | Git (`main` branch) | Tag releases at go-live |
| Vercel env vars | Export from Vercel dashboard quarterly | **Secrets — encrypted store** |
| Supabase migrations | Git `supabase/migrations/` | Source of truth for schema |
| Document templates | Git `lib/io/`, HTML templates | Version-controlled |
| Discovery worker | Git `services/discovery-worker/` | Separate deploy |

Vercel is stateless — redeploy from git SHA restores application. Verify with `/api/build-info` (`gitSha` field).

---

## 5. Recovery procedures

### Scenario A — Database corruption / bad migration

**Detection:** App-wide 500s, RLS errors, missing columns.

| Step | Action | Owner | ETA |
|------|--------|-------|-----|
| 1 | Stop writes — enable maintenance mode (Vercel env flag or status page) | Ops | 15 min |
| 2 | Identify last good backup / PITR timestamp | DBA | 30 min |
| 3 | Restore via Supabase Dashboard (Restore backup or PITR) | DBA | 1–3 hr |
| 4 | Re-apply migrations if restoring to empty project | Dev | 1 hr |
| 5 | Verify RLS: run `supabase/debug/invoice_line_items_rls_audit.sql` | Dev | 30 min |
| 6 | Smoke test UAT checklist (critical paths) | QA | 2 hr |
| 7 | Resume traffic | Ops | — |

### Scenario B — Storage bucket data loss

| Step | Action | ETA |
|------|--------|-----|
| 1 | Identify affected bucket(s) from user reports / logs | 30 min |
| 2 | Restore from S3 mirror manifest | 2–4 hr |
| 3 | For IO docs — batch regenerate PDFs from API if DB intact | 2–4 hr |
| 4 | Re-link URLs in `vendor_ios` / `client_ios` if paths changed | 1 hr |

### Scenario C — Full region / project loss

| Step | Action | ETA |
|------|--------|-----|
| 1 | Provision new Supabase project (production tier, backups on) | 1 hr |
| 2 | Restore latest DB backup | 2–4 hr |
| 3 | Restore storage from off-site mirror | 4–8 hr |
| 4 | Update Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, anon key | 15 min |
| 5 | Redeploy app; verify `supabaseAligned` on build-info | 30 min |
| 6 | Full UAT regression | 4–8 hr |

**24-hour target:** Achievable if backups tested quarterly and runbook rehearsed.

### Scenario D — Accidental invoice / sequence corruption

| Step | Action |
|------|--------|
| 1 | Do **not** reseed `document_sequences` without finance sign-off |
| 2 | Use repair migrations as reference (`20260612010000_invoice_sequence_repair.sql`) |
| 3 | Restore single-table from logical dump if isolated |

---

## 6. Recovery testing

### Quarterly drill (required before go-live sign-off)

| Test | Pass criteria |
|------|---------------|
| Restore DB backup to **staging** Supabase project | App connects; login works; sample campaign loads |
| Restore 10 random storage objects from mirror | Checksums match |
| Regenerate one Vendor IO PDF post-restore | PDF matches pre-loss |
| Measure elapsed time | ≤ 24 hours end-to-end |
| Document gaps | Update this runbook |

### Pre go-live checklist

- [ ] Production Supabase project on plan with **≥30-day backup retention**
- [ ] PITR enabled (if budget allows)
- [ ] Off-site storage mirror configured OR regeneration runbook accepted for IO buckets
- [ ] Vercel env vars exported to secure vault
- [ ] On-call contact list for Supabase + Vercel
- [ ] First drill completed and logged

---

## 7. Roles & responsibilities

| Role | Responsibility |
|------|----------------|
| **Super Admin** | Authorize restore; communicate downtime |
| **Finance** | Validate invoice/sequence integrity post-restore |
| **Dev/Ops** | Execute restore; migration re-apply |
| **QA** | Run UAT checklist post-restore |

---

## 8. Known gaps (current state)

| Gap | Risk | Mitigation until implemented |
|-----|------|------------------------------|
| No automated storage mirror in repo | Medium | Weekly manual export; IO regeneration path |
| Single Supabase project (dev ref in prod docs) | **High** | Create prod project before go-live |
| No formal maintenance mode | Low | Vercel password protection or DNS pause |
| Intelligence warehouse large — separate restore | Low | Re-run ETL from source after DB restore |

---

## Cross-references

- `docs/DEPLOYMENT_GUIDE.md` — production Supabase project setup
- `docs/SECURITY_AUDIT.md` — public IO bucket risk (backup + access)
- `docs/PRODUCTION_MANDATORY_DEPLOY.md` — migration ordering
- `docs/GO_LIVE_READINESS.md` — overall readiness
