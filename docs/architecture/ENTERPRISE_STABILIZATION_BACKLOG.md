# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` (see latest commit)  
**Do not start Release 2.4 until stop condition met.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **84 / 100** | 2026-08-03 STAB-010 found on L'Oréal | STAB-001 live PASS; STAB-008/009 tip pushed. Score dipped after discovering draft CIO still labeled “Generate Client IO” (misleading enterprise workflow). Recovers after STAB-010 Preview live PASS + multi-brand soaks. |

Score changes only with explicit issues below.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-010 | **High** | Draft CIO exists (`#CIO-2026-0006`) but Decision Center / cues say **Generate Client IO** | `draft` conflated with missing CIO in cue + DC blockers | Operators think no IO exists; contradicts Open #CIO + composer | Live L'Oréal TW-2026-0006 Preview | **Fixed in tip** — awaiting Preview + browser recheck |
| STAB-009 | Medium | List “Performance” vs workspace Deliverables for Active campaigns | `activePerformance: status==="active"` | Portfolio stage lie | TW-2026-5 list | **Fixed** `9a8aeccf` — Preview recheck pending |
| STAB-003 | High | Continuous multi-brand full journey soak incomplete | Incomplete session coverage | Enterprise confidence incomplete | Mandate | Open |
| STAB-006 | Low | Breadcrumb “Waiting Operations” while Decision Center owner is Finance | `waitingFor` from process cue owner vs Decision Center primary | Mild label inconsistency | TW-2026-0005 breadcrumb vs DC | Open |
| STAB-007 | Medium | Deliverables tab badge **84** vs Documentation repository **0 records** | Badge = `assignment_deliverables`; table = documentation repository assets | Misleading empty-state vs counter | TW-2026-0005 Deliverables | Open |
| STAB-005 | Low | Soft finance alerts may be story-filtered behind Vendor IO | `selectStoryBlockers` one-family | Finance ops less visible mid-campaign | By design; monitor | Deferred |

---

## Resolved issues

| ID | Severity | Title | Root cause | Fix | Validated |
|---|---|---|---|---|---|
| STAB-001 | Critical | TW-2026-0005 CIO Approved but Vendor IO locked / Campaign Issue payouts | Soft alerts → blockerCount short-circuit + `"po"` in `"payouts"` | `efb1c3b3` | ✅ Preview live: Deliverables ✓ May continue · Operational Attention Finance · Vendor IO 32 unlocked · Client Accepted |
| STAB-002 | High | Live Preview re-validate TW-2026-0005 | Deploy lag | Preview @ develop | ✅ Closed by STAB-001 live PASS |
| STAB-008 | High | Portfolio list Generate Client IO despite CIO Approved | List signals hardcoded no CIO | `6f87093e` enrich `client_ios`/`vendor_ios` | ✅ Live list: TW-2026-5 no longer Generate Client IO |
| STAB-004 | Medium | Soak harness service-role denied on `client_ios` | Grants / RLS for service role | Use app session / authenticated path for CIO probe | Noted; not product defect |

---

## Soak coverage log

| Cycle | Tip | Campaigns | Journey | Result | Notes |
|---|---|---|---|---|---|
| S0 | `c23a3a0e` | e& TW-2026-0002 Prod | Full to VIO | PASS | R2.3 close |
| S1 | `efb1c3b3` | Fixture TW-2026-0005-like | Cue + DC | PASS | Automated |
| S2 | `efb1c3b3` | TW-2026-0005 Preview | Workspace DC/VIO/Timeline | **PASS** | May continue; CIO Accepted; VIO 32 |
| S3 | `6f87093e` | `/campaigns` list | Portfolio cues | **PASS** | STAB-008 fixed live for TW-2026-5 |
| S4 | tip | L'Oréal TW-2026-0006 | Workspace CIO draft | **FAIL→FIX** | STAB-010 Generate vs Complete |
| S5+ | next tip | Multi-brand full journeys | Full spine | Pending | Continuous |

---

## Stop condition checklist

- [x] STAB-001 workspace contradiction closed (live)
- [x] Portfolio list matches workspace for approved CIO (STAB-008 live)
- [ ] STAB-010 draft CIO messaging Preview validated
- [ ] STAB-009 list Performance lie Preview validated
- [ ] No counter contradictions (STAB-007)
- [ ] Multi-brand full journeys PASS
- [ ] Product Readiness ≥ 95 with evidence
