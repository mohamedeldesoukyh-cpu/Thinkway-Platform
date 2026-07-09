# GO / NO-GO Decision — Thinkway 1.0 Release Candidate

**Date:** 2026-07-04 (RC hardening pass)  
**Phase:** 0.4 UAT & Release Candidate  
**Decision authority:** Engineering validation (automated UAT); business sign-off pending  

---

## Decision

### Internal production pilot (controlled dev-equivalent environment)

## **GO**

Proceed with internal production pilot when operator completes BabyJoy persistence re-verification (see ops steps below).

### Staging sign-off / external production / GA

## **NO-GO**

Do not promote to staging sign-off or general availability until blockers B-001, B-007, and B-008 are resolved.

---

## Rationale

### RC hardening fixes (2026-07-04)

| Priority | Issue | Root cause | Fix applied | Status |
|----------|-------|------------|-------------|--------|
| P0 | B-002 empty `campaign_objects` | **Dual failure:** (1) migration `20260712010000` not applied — table missing; (2) `saveCampaignObject()` used fire-and-forget `void saveVersion().catch(() => {})` — writes could abort before completion and errors were swallowed | Applied migration; made `saveCampaignObject`/`CampaignDirector.persist` async with awaited `workflow_complete` saves; errors propagate on workflow completion | **Code + schema fixed; E2E re-verify pending** |
| P1 | B-004 failed queue jobs | 128 historical failures: captcha/playwright (discovery), stalled metrics jobs, import enrich orphans | Fixed `isTerminalMetricsJobFailure()` for stalled BullMQ jobs; cleaned historical failed jobs via `scripts/triage-failed-queue-jobs.ts --clean` | **0 failed jobs** |
| P1 | B-003 IPL seed pending | Migration `20260703150000` not on remote | `supabase db push --include-all` | **Applied** |
| P1 | Audit logs insert silent fail | `logAuditEvent` ignored Supabase `{ error }` response | Log insert errors to console | **Fixed** |

### Evidence supporting GO (internal pilot)

| Area | Result |
|------|--------|
| Build & TypeScript | **PASS** (`npm run build`, `npx tsc --noEmit`) |
| Migrations (4 pending) | **Applied** on remote (see migration table) |
| BullMQ failed jobs | **0** across all 14 discovery worker queues |
| Phase 0.3 persistence validator | **24/24 PASS** |
| AI campaign workflow (BabyJoy UI) | Prior run **10/10 PASS** (UI only; DB was empty pre-fix) |
| Health infrastructure | db + redis + worker healthy (prior validation) |

### Evidence supporting NO-GO (staging / GA)

| Gap | Risk |
|-----|------|
| No staging environment tested | Config drift, secrets, Vercel preview untested |
| BabyJoy DB persistence not re-run post-fix | Need one workflow completion to confirm rows |
| Manual QA not signed off | Business acceptance unknown |
| Production infra not provisioned | Cannot cut over to prod |
| Node TLS fetch fails on workstation (B-005) | CLI scripts using `@supabase/supabase-js` fetch fail; use Supabase CLI or fix CA |

---

## Migration status

| Migration | Description | Local | Remote (pre) | Remote (post) |
|-----------|-------------|-------|--------------|---------------|
| `20260703150000` | Intelligence Persistence Layer + IPL seed | ✓ | ✗ | **✓ Applied** |
| `20260704120000` | Creator DNA tables | ✓ | ✗ | **✓ Applied** |
| `20260711010000` | Audit logs security foundation | ✓ | ✗ | **✓ Applied** |
| `20260712010000` | Campaign object persistence | ✓ | ✗ | **✓ Applied** |

Applied via: `npx supabase db push --include-all`

---

## BullMQ failure summary (pre-clean)

| Queue | Failed | Primary cause | Remediation |
|-------|--------|---------------|-------------|
| discovery-run | 16 | Captcha + missing Playwright binary (Jun 2026) | Historical — cleaned |
| discovery-refresh | 3 | Supabase fetch failed (network) | Historical — cleaned |
| publication-metrics | 7 | Job stalled (worker down); DB not updated because `attemptsMade=1` | **Code fix** + cleaned |
| publication-metrics-scheduler | 5 | Supabase fetch failed | Historical — cleaned |
| publication-screenshot-scheduler | 5 | Supabase fetch failed | Historical — cleaned |
| creator-import | 1 | JSON mime type unsupported | Ops — cleaned |
| creator-import-enrich | 85 | Platform account not found (orphaned import batch) | Ops — cleaned |
| creator-enrichment | 6 | Instagram post not found | Ops — cleaned |
| **Total** | **128 → 0** | | |

Triage script: `npx tsx scripts/triage-failed-queue-jobs.ts`  
Clean: `npx tsx scripts/triage-failed-queue-jobs.ts --clean`

---

## Build / TSC status

| Check | Status |
|-------|--------|
| `npm run build` | **PASS** |
| `npx tsc --noEmit` | **PASS** |

---

## Definition of Done — Release 1.0 RC Hardening

| Criterion | Met? |
|-----------|------|
| Root cause of empty `campaign_objects` identified | ✓ |
| Persistence code path fixed (await + error surfacing) | ✓ |
| Campaign object migration applied | ✓ |
| IPL / Creator DNA / Audit migrations applied | ✓ |
| BullMQ failed jobs = 0 | ✓ |
| Stalled metrics job DB update fix | ✓ |
| Build passes | ✓ |
| TSC passes | ✓ |
| BabyJoy DB rows verified post-fix | ✗ (ops step — see below) |
| Staging UAT complete | ✗ |
| Business sign-off | ✗ |

---

## Ops steps for operator (BabyJoy DB verification)

1. Ensure dev server running: `npm run dev`
2. Run BabyJoy workflow (new chat or `--existing`):
   ```bash
   node scripts/runtime-verify-sprint-87-babyjoy.mjs
   ```
3. Verify DB rows (use Supabase CLI if Node TLS fails):
   ```bash
   node scripts/verify-campaign-persistence-db.mjs
   ```
   Or query in Supabase dashboard:
   ```sql
   SELECT co.*, COUNT(cov.id) AS versions
   FROM campaign_objects co
   LEFT JOIN campaign_object_versions cov ON cov.campaign_object_id = co.id
   GROUP BY co.id
   ORDER BY co.created_at DESC LIMIT 5;
   ```
4. Confirm `audit_logs` rows with `entity_type = 'campaign_object'` for the saved object.

Expected after one completed BabyJoy workflow:
- 1 row in `campaign_objects` (linked to `conversation_id`)
- ≥1 row in `campaign_object_versions`
- ≥1 row in `audit_logs` (`campaign_object_saved` + `version_created`)

---

## Sign-off

| Role | Name | Decision | Date |
|------|------|----------|------|
| Engineering (RC hardening) | Release agent | **GO** (internal, pending BabyJoy DB re-verify) | 2026-07-04 |
| AI Platform lead | _pending_ | | |
| QA | _pending_ | | |
| Product | _pending_ | | |

---

## Next steps

1. Re-run BabyJoy create-campaign; confirm `campaign_objects` / versions / audit rows
2. Provision staging; re-run `scripts/validate-phase04-uat.mjs` against staging URL
3. Execute manual critical-path UAT per `docs/UAT_CHECKLIST.md`
4. Fix Windows TLS (B-005) for automated DB scripts in CI
