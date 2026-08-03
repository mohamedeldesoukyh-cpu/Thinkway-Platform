# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` @ STAB-020 (pending push) · STAB-019 live PASS `25ea8377` · STAB-018 live PASS `7e54f26f`  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **86 / 100** | 2026-08-03 sign-off | STAB-018/019 live PASS. STAB-020 High filed+fixed tip (facts race + labeled brief). STAB-016 still needs fresh Generate after STAB-020 deploys. Multi-brand incomplete. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-020 | High | Studio tip missing campaignFacts / planning 0% despite complete brief | (1) Task autosave race overwrote workflow_complete tip without facts (2) Single-line labeled briefs polluted brand/client/objective → QA Repeated fact loop | Intelligence→Studio unusable; Generate blocked | Dar Global `1681df17…` msg has facts, DB tip v9 has none; Noon same; extract polluted `Dar Global. Brand` | **Fixed tip** — awaiting Preview live |
| STAB-016 | High | Generate produced revenue=cost, 0% margin | Plan mapper set revenue=cost | Unsellable package | L'Oréal Finance 0.0% GP; unit test PASS; **no rematerialize** on linked | Needs **fresh** Generate after STAB-020 |
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
| STAB-019 | High | Timeline Deliverables Uploaded Done from planned units | 25ea8377 | **PASS live** L'Oréal · Uploaded Upcoming |

---

## Soak coverage

| Brand | Inventory | Full Intelligence→Close |
|---|---|---|
| L'Oréal | Exists | Partial — CIO draft; STAB-018/019 PASS; 0% GP until rematerialize N/A |
| e& | Exists | Partial Studio |
| Tuna TW-2026-0005 | Exists | Lifecycle PASS |
| Coca TW-2026-0002 | Exists | PO + Timeline PASS |
| Arab Bank / NBK | Exists | Pending |
| Noon–Dar (7 new) | UI created | Dar/Noon tips empty facts (STAB-020) — fresh soak after tip |

---

## Stop condition checklist

- [x] STAB-018 live PASS
- [x] STAB-019 Preview live PASS
- [ ] STAB-020 Preview live PASS
- [ ] STAB-016 fresh Generate (~25% GP)
- [ ] Multi-brand full journeys
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High
- [ ] Enterprise QA Report
- [ ] Release 2.4 may begin — **NO**
