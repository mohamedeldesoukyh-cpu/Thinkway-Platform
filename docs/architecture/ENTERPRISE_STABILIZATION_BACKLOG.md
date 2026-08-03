# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `43aef07` live · STAB-028 tip pending push · STAB-016/018–022/026/027 live PASS  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **90 / 100** | 2026-08-03 soak | Arab Bank through Posted + Deliverables Uploaded Done. STAB-028 found: Publication Live incorrectly Done with 0 Performance publications. Multi-brand incomplete. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-028 | **High** | Publication Live Done with Performance 0 publications | `activePerformance` / Publication Live used Posted upload count — same as Deliverables Uploaded | Ops told publications are live while Performance register empty | Arab Bank after Atkins Posted: Timeline Publication Live Done; Performance 0 records | **Fix local** — `publication_count` SSOT |
| STAB-021 | High | Generate sets PO = brief cost while lines consume revenue | `poAmount = facts.budget.amount` after STAB-016 GP markup | Immediate PO exceeded on fresh Generate | Arab Bank TW-2026-0007 repaired to 1M | **Fixed tip** `0ab3d8aa` — await fresh Generate live |
| STAB-023 | Medium | CIO send to `@example.com` fails Resend | Provider rejects example.com | Soak friction; status still advances via token | Send history failed; approval still PASS | Open — use thinkway test inbox |
| STAB-024 | Low | Email preview Agreed Amount EGP 0.00 | Preview vs document rollup | Mild commercial confusion | Arab Bank CIO preview | Open |
| STAB-025 | Medium | “Viewing Client/Vendor IO while work is in Deliverables/Performance” | process guidance vs stage | Mild lifecycle contradiction | Arab Bank post-CIO | Open |
| STAB-003 | High | Multi-brand full journey soak incomplete | Journeys not run | Coverage gap | Arab Bank advanced; 12 brands pending | In progress |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC | Mild | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |

---

## Resolved issues (live verified)

| ID | Severity | Title | Fix | Validated |
|---|---|---|---|---|
| STAB-001 | Critical | CIO/VIO soft-alert lock | efb1c3b3 | PASS |
| STAB-007–017 | Med/High | List/cue/timeline contradictions | various | PASS |
| STAB-018 | High | Assignments Completed = Created | 7e54f26f | PASS live (Arab Bank Done) |
| STAB-019 | High | Deliverables Uploaded from planned units | 25ea8377 | PASS live |
| STAB-020 | High | Tip missing campaignFacts / labeled brief pollution | 81c2cdbc | PASS live |
| STAB-016 | High | Generate revenue=cost 0% GP | 68df94e5 mapper | PASS live TW-2026-0007 25% GP |
| STAB-022 | Medium | Finance Unlock always Complete Client IO | tip `43aef07` DC blocker reason | PASS live — Unlock: Creator payouts outstanding |
| STAB-026 | Medium | Overview Posted KPI counts planned live_date | tip `43aef07` workflow only | PASS live — Posted 1 · Pending 16 |
| STAB-027 | High | Draft→Posted does not persist; timeline stuck | tip `43aef07` saveMeta + upload SSOT | PASS live — Atkins Posted; Deliverables Uploaded Done |

---

## Soak coverage

| Brand | Inventory | Full Intelligence→Close |
|---|---|---|
| Arab Bank TW-2026-0007 | Exists | CIO+VIO+Posted PASS; Publication Live false-positive (STAB-028); Invoice/Close pending |
| L'Oréal TW-2026-0006 | Exists | Partial — CIO draft; 0% GP legacy |
| Tuna TW-2026-0005 | Exists | Lifecycle PASS |
| Coca TW-2026-0002 | Exists | PO + Timeline PASS |
| Others (9) | Exists | Pending full journey |

---

## Stop condition checklist

- [x] STAB-018/019/020/016 live PASS
- [x] STAB-022/026/027 live PASS (tip `43aef07`)
- [ ] STAB-028 tip + live (Publication Live ↔ Performance register)
- [ ] STAB-021 Preview live PASS (fresh Generate)
- [ ] Multi-brand full journeys
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High
- [ ] Enterprise QA Report
- [ ] Release 2.4 may begin — **NO**
