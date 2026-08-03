# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `efb1c3b3` on `develop`  
**Do not start Release 2.4 until stop condition met.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **88 / 100** | 2026-08-03 (engine tip) | CIO→VIO progression bug fixed + 44/44 lifecycle tests. Live Preview browser soak on tip pending. |

Score drops only with explicit issues below.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-002 | High | Live Preview not yet re-validated for TW-2026-0005 after tip | Deploy lag | Cannot claim UI PASS until browser evidence | Awaiting Preview @ `efb1c3b3` | Open |
| STAB-003 | High | Continuous multi-brand journey soak incomplete on tip | Not started on tip | Enterprise confidence incomplete | Soak mandate | Open |
| STAB-004 | Medium | Dev probe: TW-2026-0005 `client_ios` link returned none via header join | Possible schema/query path mismatch in soak harness | Harness blind spot | `soak-lifecycle-consistency.mjs` INFO | Open |
| STAB-005 | Medium | Soft finance alerts hidden when Vendor IO story filter wins | `selectStoryBlockers` one-family rule | Finance ops may be less visible mid-campaign | By design; revisit if Product wants dual inbox | Deferred (monitor) |

---

## Resolved issues

| ID | Severity | Title | Root cause | Fix | Validated |
|---|---|---|---|---|---|
| STAB-001 | Critical | TW-2026-0005: CIO Approved but Vendor IO locked / Campaign Issue payouts | Soft alerts → `blockerCount` short-circuit + `"po"` in `"payouts"` | `efb1c3b3` lifecycle engine | Unit/soak PASS; **live UI pending STAB-002** |

---

## Soak coverage log

| Cycle | Tip | Brands / campaigns | Journey | Result | Notes |
|---|---|---|---|---|---|
| S0 | `c23a3a0e` | e& TW-2026-0002 Prod | Full to VIO | PASS (R2.3 close) | Pre-stabilization tip |
| S1 | `efb1c3b3` | Fixture TW-2026-0005-like | Cue + Decision Center | PASS | Automated |
| S2 | `efb1c3b3` | Live TW-2026-0005 Preview | Workspace DC/VIO | Pending | After deploy |
| S3+ | tip | e& · L'Oréal · Noon · … | Full journey | Pending | Continuous |

---

## Stop condition checklist

- [ ] No workflow contradictions (live)
- [ ] No stale lifecycle (live)
- [ ] No orphan blockers (live)
- [ ] No inconsistent Decision Center (live)
- [ ] No broken handoffs (live multi-campaign)
- [ ] No incorrect commercial calculations (sampled)
- [ ] All mandated brand journeys soak PASS
- [ ] Product Readiness ≥ 95 with evidence
