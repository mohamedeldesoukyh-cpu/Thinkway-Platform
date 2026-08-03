# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` @ `25ea8377` (STAB-019) · STAB-018 live PASS `7e54f26f`  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **88 / 100** | 2026-08-03 sign-off | STAB-018 live PASS. STAB-019 tip (Deliverables Uploaded). STAB-016 still needs fresh Generate. Multi-brand journeys incomplete. Score down slightly vs prior while High STAB-016/003 open — evidence-based. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-016 | High | Generate produced revenue=cost, 0% margin | Plan mapper set revenue=cost | Unsellable package | L'Oréal Finance 0.0% GP; unit test PASS; **no rematerialize path** | **Fixed tip** — needs **fresh** approved plan → Generate (Dar Global soak started) |
| STAB-019 | High | Timeline Deliverables Uploaded Done from planned units | `occurred: deliverableCount > 0` after STAB-015 | Lifecycle contradiction vs draft CIO | L'Oréal after STAB-018 | **Fixed tip** `25ea8377` — uploaded = posted/approved only |
| STAB-003 | High | Multi-brand full journey soak incomplete | Journeys not run | Coverage gap | 13 brands in inventory | Inventory PASS — journeys pending |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC | Mild | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |

---

## Resolved issues (live verified)

| ID | Severity | Title | Fix | Validated |
|---|---|---|---|---|
| STAB-001 | Critical | CIO/VIO soft-alert lock | efb1c3b3 | PASS |
| STAB-007 | Medium | Deliverables badge vs docs repo | 94e9c0c9 | PASS |
| STAB-008–011 | High/Med | List/cue contradictions | 6f87093e…19ee1272 | PASS |
| STAB-012 | High | List ignored legacy PO | c64bbdc3 | PASS |
| STAB-014 | Medium | VIO may-continue while blocked | c64bbdc3 | PASS |
| STAB-015 | Medium | Timeline Deliverables vs explorer | 68df94e5 | PASS |
| STAB-017 | Medium | Publication Live from units | 10476a71 | PASS |
| STAB-018 | High | Assignments Completed = Created | 7e54f26f | **PASS live** L'Oréal · Completed Upcoming |

---

## Soak coverage

| Brand | Inventory | Full Intelligence→Close |
|---|---|---|
| L'Oréal | Exists | Partial — CIO draft; STAB-018 PASS; 0% GP until rematerialize N/A |
| e& | Exists | Partial Studio |
| Tuna TW-2026-0005 | Exists | Lifecycle PASS |
| Coca TW-2026-0002 | Exists | PO + Timeline PASS |
| Arab Bank / NBK | Exists | Pending |
| Noon–Dar (7 new) | UI created | Dar Global fresh soak **in progress** for STAB-016 |

---

## Stop condition checklist

- [x] STAB-018 live PASS
- [ ] STAB-019 Preview live
- [ ] STAB-016 fresh Generate (~25% GP)
- [ ] Multi-brand full journeys
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High
- [ ] Enterprise QA Report
- [ ] Release 2.4 may begin — **NO**
