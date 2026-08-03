# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** STAB-021 (pending push) · STAB-020 live PASS `81c2cdbc` · STAB-016 live PASS Arab Bank TW-2026-0007 @ 25% GP  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **90 / 100** | 2026-08-03 sign-off | STAB-018/019/020/016 live PASS. STAB-021 High filed+fixed tip (PO vs revenue). Multi-brand journeys still incomplete. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-021 | High | Generate sets PO = brief cost while lines consume revenue | `poAmount = facts.budget.amount` after STAB-016 GP markup | Immediate PO exceeded blocker on fresh Generate | Arab Bank TW-2026-0007: PO 750k, consumed 1M, DC Finance block; Finance 25% GP correct | **Fixed tip** — awaiting Preview; Dev soak PO repaired to 1M |
| STAB-003 | High | Multi-brand full journey soak incomplete | Journeys not run | Coverage gap | 13 brands; Arab Bank Generate PASS | Journeys pending |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC | Mild | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |

---

## Resolved issues (live verified)

| ID | Severity | Title | Fix | Validated |
|---|---|---|---|---|
| STAB-001 | Critical | CIO/VIO soft-alert lock | efb1c3b3 | PASS |
| STAB-007–017 | Med/High | List/cue/timeline contradictions | various | PASS |
| STAB-018 | High | Assignments Completed = Created | 7e54f26f | PASS live |
| STAB-019 | High | Deliverables Uploaded from planned units | 25ea8377 | PASS live |
| STAB-020 | High | Tip missing campaignFacts / labeled brief pollution | 81c2cdbc | **PASS live** Arab Bank 100% brief; tip has brand/client/budget |
| STAB-016 | High | Generate revenue=cost 0% GP | 68df94e5 mapper | **PASS live** TW-2026-0007 · EGP 1M rev / 750k cost / **25.0% GP** |

---

## Soak coverage

| Brand | Inventory | Full Intelligence→Close |
|---|---|---|
| L'Oréal TW-2026-0006 | Exists | Partial — CIO draft; 0% GP legacy linked |
| Arab Bank TW-2026-0007 | Exists | **Generate+Finance 25% GP PASS**; CIO next; PO repaired |
| Tuna TW-2026-0005 | Exists | Lifecycle PASS |
| Coca TW-2026-0002 | Exists | PO + Timeline PASS |
| Others (9) | Exists | Pending full journey |

---

## Stop condition checklist

- [x] STAB-018/019/020/016 live PASS
- [ ] STAB-021 Preview live PASS
- [ ] Multi-brand full journeys
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High
- [ ] Enterprise QA Report
- [ ] Release 2.4 may begin — **NO**
