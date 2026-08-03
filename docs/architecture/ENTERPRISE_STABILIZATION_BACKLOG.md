# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` @ `68df94e5`  
**Do not start Release 2.4 until stop condition met.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **89 / 100** | 2026-08-03 STAB-012/014 live; STAB-015/016 tip | STAB-012/014 live PASS (TW-2026-0002 list+workspace Finance PO). STAB-015/016 pushed — await Preview. Multi-brand full journeys still incomplete (STAB-003). |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-015 | Medium | Timeline “Deliverables Uploaded” Upcoming while ops explorer has rows | Signals used legacy `deliverables` only | Misleading journey progress | TW-2026-0002 Timeline | **Fixed in tip** `68df94e5` — awaiting Preview |
| STAB-016 | High | Generate produced revenue=cost, 0% margin | Plan mapper set revenue=cost; no GP | Unsellable commercial package | L'Oréal TW-2026-0006 | **Fixed in tip** `68df94e5` — needs fresh Generate soak |
| STAB-003 | High | Multi-brand full journey soak incomplete | Noon/Trendyol/F1/Liwa/Alshaya/FirstCry/Dar missing; brand seed RLS | Enterprise coverage incomplete | Brand inventory | Open |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC primary | Mild label | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |

---

## Resolved issues

| ID | Severity | Title | Root cause | Fix | Validated |
|---|---|---|---|---|---|
| STAB-001 | Critical | CIO Approved / VIO locked / payouts Campaign Issue | Soft alerts + po-in-payouts | efb1c3b3 | PASS |
| STAB-008 | High | List Generate CIO despite approved | Hardcoded list signals | 6f87093e | PASS |
| STAB-009 | Medium | List Performance for Active | status===active | 9a8aeccf | PASS |
| STAB-010 | High | Draft CIO labeled Generate | draft conflated with missing | e6f41b7a | PASS |
| STAB-011 | High | VIO drafts ready with 0 | Hardcoded banner | 19ee1272 | PASS |
| STAB-007 | Medium | Deliverables 84 vs empty docs | Wrong tab surface | 94e9c0c9 | PASS |
| STAB-012 | High | List ignored legacy PO exceeded | List required governance PO>0 | c64bbdc3 | **PASS live** TW-2026-2 Finance / Review PO Limit |
| STAB-014 | Medium | VIO banner “may continue” while blocked | Ignored progressionAllowed | c64bbdc3 | **PASS live** “progression is blocked” |
| STAB-004 | Medium | Soak harness client_ios denied | RLS | Auth path | Noted |

---

## Soak coverage log

| Cycle | Tip | Campaigns | Journey | Result | Notes |
|---|---|---|---|---|---|
| S0–S7 | prior | TW-2026-0005/6 | Lifecycle | PASS | STAB-001..011 |
| S8 | c64bbdc3 | TW-2026-0002 | List+DC PO | PASS | STAB-012/014 live |
| S8 | tip | TW-2026-0006 | Commercial | FAIL→FIX | STAB-016 tip |
| S9 | 68df94e5 | TW-2026-0002 Timeline | Deliverables milestone | Pending Preview | STAB-015 |
| S10+ | next | Multi-brand full spine | Intelligence→Close | Pending | STAB-003 |

---

## Stop condition checklist

- [x] STAB-001/007–012/014 live PASS
- [ ] STAB-015 Preview live validated
- [ ] STAB-016 fresh Generate soak validated
- [ ] Multi-brand full journeys PASS (STAB-003)
- [ ] Enterprise CTO Acceptance Review
