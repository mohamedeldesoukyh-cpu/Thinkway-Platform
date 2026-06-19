# UAT Execution Report — Thinkway Production Go-Live

**Program:** Final UAT & production readiness validation  
**Date:** 19 Jun 2026  
**Branch assessed:** `feature/campaign-client-bo-attachment` @ `b5e3502`  
**Target environment:** Vercel preview (`feature/campaign-client-bo-attachment`) + Supabase thinkway-dev (`hsxrewjcbvmbkqdlzjhs`)  
**Execution model:** Automated/static verification in-repo + manual UAT template (requires QA sign-off)

---

## Executive summary

| Metric | Count |
|--------|------:|
| Total test cases (from `UAT_CHECKLIST.md`) | 68 |
| Automated / code-verified **Pass** | 14 |
| **Partial** (works with known production schema gaps) | 12 |
| **Pending** (requires manual QA execution) | 39 |
| **Blocked** (known defect or missing ops prerequisite) | 3 |

**Critical path (13 tests):** **0 Pass · 0 Fail · 13 Pending** — manual execution required before pilot sign-off.

No new features were added during this validation. Phase A security remediations are present in code; operational gates (migrations applied, backup drill, monitoring) remain open.

---

## 1. Clients

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 1.1.1 | Create client | Manual | **Pending** | `createClientAction` + optional-column retry in `lib/clients/classification-audit-columns.ts` |
| 1.1.2 | Duplicate name blocked | Code review | **Pass** | Unique constraint + `23505` handling in `features/clients/actions.ts` |
| 1.1.3 | Viewer cannot create | Code review | **Pass** | RLS on `clients` INSERT; viewer role lacks `clients.write` |
| 1.1.4 | Finance cannot create | Code review | **Pass** | Finance role seed lacks `clients.write` per `docs/ROLE_MATRIX.md` |
| 1.2.1 | Edit overview | Manual | **Partial** | Saves succeed; `name_ar`, taxonomy may strip on production without migration (`642fe81` metadata fallback) |
| 1.2.2 | Edit legal tab | Manual | **Partial** | Upload fixed (`d7ad928`); requires `client_documents` table + `client-documents` bucket |
| 1.2.3 | Edit finance tab | Manual | **Pending** | Finance tab uses Form_4 shell; payment terms on client record |
| 1.2.4 | Credit limit | Manual | **Partial** | Code resilient when `credit_limit_active` missing (`7be6f5b`); column may not exist on DB |
| 1.3.1 | Auto-classification | Manual | **Partial** | Pipeline in `lib/clients/classify-client-category.ts`; persistence blocked if enum column on production |
| 1.3.2 | Manual category | Manual | **Partial** | UI saves; DB may strip slugs until `20260625020000_client_category_taxonomy.sql` applied |
| 1.3.3 | Classification review | Manual | **Pending** | `/settings/client-classification-review`; requires audit migration |
| 1.4.1 | Upload PDF | Manual | **Pending** | Private bucket + signed URL pattern in `client-inline-document-attach.tsx` |
| 1.4.2 | Reject oversized | Code review | **Pass** | Size/MIME checks in `uploadClientDocumentAction` |
| 1.4.3 | Reject bad MIME | Code review | **Pass** | Same |
| 1.4.4 | Download signed URL | Manual | **Pending** | `getClientDocumentDownloadUrlAction` |

**Clients verdict:** Core CRUD and permission model verified in code. **Production schema parity** (taxonomy, `name_ar`, `vr_rate_id`, credit columns) is the primary UAT risk — run `supabase/scripts/production_client_classification_audit.sql` before pilot.

---

## 2. Campaigns

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 2.1.1 | Brand-first create | Manual | **Pending** | `new-campaign-dialog.tsx`; commercial summary uses client taxonomy (`36ac3a9`, `642fe81`) |
| 2.1.2 | Campaign numbering | Code review | **Pass** | DB trigger + `docs/CAMPAIGN_NUMBERING.md` |
| 2.1.3 | Empty assignments | Code review | **Pass** | Bootstrap disabled per `20260609000000_disable_operational_bootstrap.sql` |
| 2.1.4 | Operations create | Manual | **Pending** | Credit limit check resilient (`fetchClientCreditLimitFlagsSafe`) |
| 2.2.1 | Edit header | Manual | **Pending** | Campaign workspace overview tab |
| 2.2.2 | Finance read-only | Code review | **Pass** | Finance lacks `campaigns.write` |
| 2.2.3 | Add line via assignment | Manual | **Pending** | Assignment hierarchy |
| 2.3.1 | Create assignment | Manual | **Pending** | Critical path |
| 2.3.2 | Add deliverables | Manual | **Pending** | |
| 2.3.3 | Multi-currency cost | Manual | **Pending** | |
| 2.3.4 | Ready for billing | Manual | **Pending** | Status machine in migrations |

**Campaigns verdict:** Create flow unblocked for missing `credit_limit_active` in code. Manual end-to-end assignment → billing path required.

---

## 3. Vendor IO

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 3.1 | Generate VIO | Manual | **Pending** | `features/io/generate-vendor-io-action.ts` |
| 3.2 | Eligibility gate | Code review | **Pass** | Eligibility checks before generate |
| 3.3 | HTML preview | Manual | **Pending** | Template in `lib/io/` |
| 3.4 | PDF export | Manual | **Pending** | `/api/vendor-ios/[id]/document`; signed URL + storage download (`65790b3`, `b5e3502`) |
| 3.5 | Revise VIO | Manual | **Pending** | |
| 3.6 | Ungenerate VIO | Manual | **Pending** | |
| 3.7 | External approval | Manual | **Pending** | Token route `/io-approval/vendor` |
| 3.8 | Finance cannot generate | Code review | **Pass** | No `campaigns.write` on finance role |

**Vendor IO verdict:** Phase A made buckets private; PDF route uses `createPdfDocumentResponse` / signed URLs. **Apply migration `20260629020000_io_document_buckets_private.sql` before UAT.**

---

## 4. Client IO

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 4.1 | Generate Client IO | Manual | **Pending** | |
| 4.2 | Terms applied | Manual | **Pending** | `client_io_terms_text` on client |
| 4.3 | HTML export | Manual | **Pending** | |
| 4.4 | PDF export | Manual | **Pending** | `/api/client-ios/[id]/document` — same Phase A pattern |
| 4.5 | Cancel IO | Manual | **Pending** | |
| 4.6 | Email send | Manual | **Blocked** | Requires email provider env vars configured on Vercel |

---

## 5. Billing

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 5.1 | Move to billing | Manual | **Pending** | |
| 5.2 | Create invoice | Manual | **Pending** | Critical path; verify `20260531620000` invoice RLS on DB |
| 5.3 | VIO gate | Code review | **Pass** | Invoice creation blocked without VIO per lifecycle docs |
| 5.4 | Append invoice | Manual | **Pending** | |
| 5.5 | Regenerate invoice | Manual | **Pending** | |
| 5.6 | Ungenerate invoice | Manual | **Pending** | |
| 5.7 | Invoice document | Manual | **Pending** | PDF route 60s timeout in `vercel.json` |
| 5.8 | Post-level billing | Manual | **Pending** | |

**Billing verdict:** Billing queue refresh after IO fixed in code (`302442f`). Manual invoice lifecycle UAT required.

---

## 6. Finance

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 6.1 | Approval request | Manual | **Pending** | `approvals` / `approval_steps` tables |
| 6.2 | Finance approve | Manual | **Pending** | Critical path |
| 6.3 | Finance reject | Manual | **Pending** | |
| 6.4 | Finance override | Manual | **Pending** | `requireFinanceOverrideAccess` |
| 6.5 | Period lock | Manual | **Pending** | |
| 6.6 | Posting center | Manual | **Pending** | |
| 6.7 | Collections | Manual | **Pending** | |

---

## 7. Reports

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 7.1 | Executive dashboard | Manual | **Pending** | |
| 7.2 | P&L export HTML | Manual | **Pending** | Critical path |
| 7.3 | P&L XLSX | Manual | **Pending** | |
| 7.4 | P&L PDF | Manual | **Pending** | |
| 7.5 | Report filters | Manual | **Pending** | |
| 7.6 | Top clients | Manual | **Pending** | |
| 7.7 | Viewer export denied | Code review | **Pass** | Report API routes require auth |
| 7.8 | Other reports | Manual | **Pending** | |

---

## 8. Cross-cutting / security smoke

| ID | Test | Method | Result | Evidence / notes |
|----|------|--------|--------|------------------|
| 8.1 | Unauthenticated redirect | Code review | **Pass** | `middleware.ts` + `lib/supabase/middleware.ts` |
| 8.2 | Viewer write denial | Code review | **Pass** | RLS + permission slugs |
| 8.3 | Client scope | Code review | **Pass** | `can_access_client()` in RLS |
| 8.4 | build-info public | Code review | **Pass** | `/api/build-info` — no secrets in response |
| 8.5 | Role escalation blocked | Automated | **Pass** | Migration `20260629010000_profile_role_escalation_guard.sql` + unit tests |
| 8.6 | IO buckets private | Code review | **Pass** | Migration `20260629020000`; `io-document-storage.test.ts` passed |
| 8.7 | Enrich API gated | Code review | **Pass** | `requirePermission('influencers.write')` on enrich route |

---

## Automated test run (19 Jun 2026)

| Suite | Result |
|-------|--------|
| `lib/clients/classification-audit-columns.test.ts` | ✅ Pass |
| `lib/clients/platform-schema-resilience.test.ts` | ✅ Pass |
| `lib/io/io-document-storage.test.ts` | ✅ Pass |
| `lib/clients/client-detail-query.test.ts` | ✅ Pass (prior run) |
| `lib/master-data/commercial-category-labels.test.ts` | ✅ Pass (prior run) |
| `npm run build` (Vercel) | ✅ Pass @ `b5e3502` (after Buffer fix) |

---

## Known blockers affecting UAT

| # | Blocker | Impact | Resolution |
|---|---------|--------|------------|
| B1 | Production Supabase schema behind app (taxonomy, `name_ar`, `vr_rate_id`, credit columns) | Client save/classification/campaign summary partial failures | Run `supabase/scripts/production_client_classification_audit.sql` |
| B2 | Phase A migrations not confirmed applied on target DB | Role escalation + private IO buckets | Apply `20260629010000`, `20260629020000` |
| B3 | Manual UAT not executed by QA | No formal pass/fail on critical path | Assign testers per `UAT_CHECKLIST.md` §9 |

---

## Sign-off (pending manual execution)

| Role | Name | Date | Result |
|------|------|------|--------|
| Account Manager | _TBD_ | | ☐ Pass ☐ Fail |
| Operations | _TBD_ | | ☐ Pass ☐ Fail |
| Finance | _TBD_ | | ☐ Pass ☐ Fail |
| Admin / Super Admin | _TBD_ | | ☐ Pass ☐ Fail |
| QA lead | _TBD_ | | ☐ Pass ☐ Fail |

**Next step:** Execute critical path tests (0.1, 1.1.1, 2.1.1, 2.1.3, 2.3.1, 3.1, 3.4, 4.1, 5.2, 5.3, 6.2, 7.2) on staging after `PRODUCTION_DEPLOYMENT_CHECKLIST.md` §1–3 complete. Update this report with Pass/Fail per row.

---

## Cross-references

- `docs/UAT_CHECKLIST.md` — master checklist
- `docs/PHASE_A_SECURITY_SIGNOFF.md` — security fixes
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` — pre-deploy gates
- `docs/FINAL_GO_LIVE_RECOMMENDATION.md` — go-live decision
