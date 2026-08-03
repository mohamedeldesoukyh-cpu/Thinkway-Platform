# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` (see latest commit)  
**Do not start Release 2.4 until stop condition met.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **87 / 100** | 2026-08-03 STAB-010 live PASS; STAB-011 tip | STAB-001/008/009/010 live-validated on Preview. STAB-011 Vendor IO “drafts ready” lie fixed in tip (await Preview). Remaining: STAB-007 counters, STAB-006 labels, multi-brand full journeys. |

Score changes only with explicit issues below.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-011 | **High** | Vendor IO banner says **drafts are ready** while Orders **0 records** | Hardcoded `whatHappened` ignored `vendorIoCount` | Misleading operational state | L'Oréal TW-2026-0006 Vendor IO tab | **Fixed in tip** — awaiting Preview |
| STAB-003 | High | Continuous multi-brand full journey soak incomplete | Incomplete session coverage | Enterprise confidence incomplete | Mandate | Open |
| STAB-006 | Low | Breadcrumb “Waiting Operations” while Decision Center owner is Finance | `waitingFor` from process cue owner vs Decision Center primary | Mild label inconsistency | TW-2026-0005 breadcrumb vs DC | Open |
| STAB-007 | Medium | Deliverables tab badge **84** vs Documentation repository **0 records** | Badge = `assignment_deliverables`; table = documentation repository assets | Misleading empty-state vs counter | TW-2026-0005 Deliverables | Open |
| STAB-005 | Low | Soft finance alerts may be story-filtered behind Vendor IO | `selectStoryBlockers` one-family | Finance ops less visible mid-campaign | By design; monitor | Deferred |

---

## Resolved issues

| ID | Severity | Title | Root cause | Fix | Validated |
|---|---|---|---|---|---|
| STAB-001 | Critical | TW-2026-0005 CIO Approved but Vendor IO locked / Campaign Issue payouts | Soft alerts → blockerCount + `"po"` in `"payouts"` | `efb1c3b3` | ✅ Preview live |
| STAB-002 | High | Live Preview re-validate TW-2026-0005 | Deploy lag | Preview @ develop | ✅ |
| STAB-008 | High | Portfolio list Generate Client IO despite CIO Approved | List signals hardcoded no CIO | `6f87093e` | ✅ Live list |
| STAB-009 | Medium | List Performance vs workspace Deliverables for Active | `activePerformance: status==="active"` | `9a8aeccf` | ✅ TW-2026-5 → Deliverables / Open Deliverables |
| STAB-010 | High | Draft CIO labeled Generate Client IO | `draft` conflated with missing | `e6f41b7a` | ✅ L'Oréal: Complete #CIO… / list Complete Client IO / Composition |
| STAB-004 | Medium | Soak harness service-role denied on `client_ios` | Grants / RLS | Auth path for CIO probe | Noted; not product |

---

## Soak coverage log

| Cycle | Tip | Campaigns | Journey | Result | Notes |
|---|---|---|---|---|---|
| S0 | `c23a3a0e` | e& TW-2026-0002 Prod | Full to VIO | PASS | R2.3 close |
| S1–S2 | `efb1c3b3` | TW-2026-0005 | Workspace | PASS | STAB-001 |
| S3 | `6f87093e` | `/campaigns` | Portfolio | PASS | STAB-008 |
| S4 | `9a8aeccf` | TW-2026-5 list | Stage | PASS | STAB-009 |
| S5 | `e6f41b7a` | L'Oréal TW-2026-0006 | CIO draft | PASS | STAB-010 |
| S6 | tip | L'Oréal Vendor IO | Banner vs 0 | FAIL→FIX | STAB-011 |
| S7+ | next | Multi-brand full journeys | Full spine | Pending | Continuous |

---

## Stop condition checklist

- [x] STAB-001 workspace contradiction closed (live)
- [x] Portfolio list matches workspace for approved CIO (STAB-008 live)
- [x] STAB-009 list Performance lie Preview validated
- [x] STAB-010 draft CIO messaging Preview validated
- [ ] STAB-011 Vendor IO drafts banner Preview validated
- [ ] No counter contradictions (STAB-007)
- [ ] Multi-brand full journeys PASS
- [ ] Product Readiness ≥ 95 with evidence
