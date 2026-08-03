# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` (see latest commit)  
**Do not start Release 2.4 until stop condition met.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **86 / 100** | 2026-08-03 STAB-012/014/015/016 found | Score dipped after portfolio PO lie (TW-2026-0002) and commercial 0% margin on L'Oréal. Prior lifecycle fixes remain live PASS. Score rises only after STAB-012 Preview live + progress on multi-brand soaks. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-012 | **High** | Portfolio shows Deliverables/Vendor IO while workspace DC is Finance PO exceeded | List `poExceeded` required governance budget>0; ignored legacy line PO fallback | Operators miss hard finance blocker | TW-2026-0002 list vs workspace | **Fixed in tip** — awaiting Preview |
| STAB-014 | Medium | Vendor IO banner says “Campaign may continue” while DC Cannot advance | Banner ignored `progressionAllowed` | Contradictory guidance | TW-2026-0002 Vendor IO | **Fixed in tip** — awaiting Preview |
| STAB-015 | Medium | Timeline “Deliverables Uploaded” Upcoming while operational explorer has rows | Timeline uses `workspace.deliverables` (legacy fetch) not assignment deliverables | Misleading journey progress | TW-2026-0002 Timeline | Open |
| STAB-016 | High | L'Oréal Generate produced revenue=cost, 0% margin, agency_fee=0 | Generate path hardcodes agency_fee_percent:0; seeds may omit markup/VR | Unsellable commercial package | TW-2026-0006 lines | Open |
| STAB-003 | High | Multi-brand full journey soak incomplete | Brands Noon/Trendyol/F1/Liwa/Alshaya/FirstCry/Dar missing; service_role cannot INSERT brands | Enterprise coverage incomplete | Dev brand inventory = 6 | Open |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC primary | Mild label inconsistency | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |

---

## Resolved issues

| ID | Severity | Title | Root cause | Fix | Validated |
|---|---|---|---|---|---|
| STAB-001 | Critical | CIO Approved but Vendor IO locked / payouts Campaign Issue | Soft alerts + po-in-payouts | efb1c3b3 | PASS Preview |
| STAB-008 | High | List Generate Client IO despite CIO Approved | Hardcoded list signals | 6f87093e | PASS |
| STAB-009 | Medium | List Performance for Active | status===active | 9a8aeccf | PASS |
| STAB-010 | High | Draft CIO labeled Generate | draft conflated with missing | e6f41b7a | PASS |
| STAB-011 | High | Vendor IO drafts ready with 0 | Hardcoded banner | 19ee1272 | PASS |
| STAB-007 | Medium | Deliverables 84 vs empty docs repo | Wrong tab surface | 94e9c0c9 | PASS |
| STAB-004 | Medium | Soak harness client_ios denied | RLS | Auth path | Noted |

---

## Soak coverage log

| Cycle | Tip | Campaigns | Journey | Result | Notes |
|---|---|---|---|---|---|
| S0–S7 | prior | TW-2026-0005/6 + list | Lifecycle | PASS | STAB-001..011 |
| S8 | tip | TW-2026-0002 | List vs DC PO | FAIL→FIX | STAB-012 |
| S8 | tip | TW-2026-0002 | VIO banner | FAIL→FIX | STAB-014 |
| S8 | tip | TW-2026-0006 | Commercial GP | FAIL | STAB-016 0% margin |
| S8 | tip | Commercial probe | All headers | PASS | GP arithmetic OK |
| S9+ | next | e& Intelligence + missing brands | Full spine | Pending | Continuous |

---

## Stop condition checklist

- [x] Prior STAB-001/007–011 live PASS
- [ ] STAB-012 Preview live validated
- [ ] STAB-014 Preview live validated
- [ ] STAB-015 timeline deliverables fixed + live
- [ ] STAB-016 commercial margin Generate fixed + live
- [ ] Multi-brand full journeys PASS (STAB-003)
- [ ] Enterprise CTO Acceptance Review
