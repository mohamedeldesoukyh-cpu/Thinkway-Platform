# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** **`7037d311`** live (STAB-028) · STAB-016/018–022/026/027 live PASS  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **92 / 100** | 2026-08-03 soak | Arab Bank through Invoice Generated (`INV-2026-00003`). STAB-028 live PASS. Multi-brand full journeys + negative + STAB-021 fresh Generate still open. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-021 | High | Generate sets PO = brief cost while lines consume revenue | `poAmount = facts.budget.amount` after STAB-016 GP markup | Immediate PO exceeded on fresh Generate | Arab Bank TW-2026-0007 repaired to 1M | **Fixed tip** `0ab3d8aa` — await fresh Generate live |
| STAB-023 | Medium | CIO send to `@example.com` fails Resend | Provider rejects example.com | Soak friction; status still advances via token | Send history failed; approval still PASS | Open — use thinkway test inbox |
| STAB-024 | Low | Email preview Agreed Amount EGP 0.00 | Preview vs document rollup | Mild commercial confusion | Arab Bank CIO preview | Open |
| STAB-025 | Medium | “Viewing Client/Vendor IO while work is in Deliverables/Performance/Finance” | process guidance vs stage | Mild lifecycle contradiction | Arab Bank post-CIO | Open |
| STAB-003 | High | Multi-brand full journey soak incomplete | Journeys not run | Coverage gap | Arab Bank advanced through Invoice; 12 brands pending full path | In progress |
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
| STAB-020 | High | Tip missing campaignFacts / labeled brief pollution | 81c2cdbc | PASS live |
| STAB-016 | High | Generate revenue=cost 0% GP | 68df94e5 mapper | PASS live TW-2026-0007 25% GP |
| STAB-022 | Medium | Finance Unlock always Complete Client IO | tip `43aef07` | PASS live — Unlock: Creator payouts outstanding |
| STAB-026 | Medium | Overview Posted KPI counts planned live_date | tip `43aef07` | PASS live — Posted 1 · Pending 16 |
| STAB-027 | High | Draft→Posted does not persist | tip `43aef07` | PASS live — Atkins Posted; Deliverables Uploaded Done |
| STAB-028 | High | Publication Live Done with 0 Performance pubs | tip `7037d311` `publication_count` SSOT | PASS live — Upcoming until Add publication; then Done + DC Performance |

---

## Soak coverage

| Brand | Inventory | Full Intelligence→Close |
|---|---|---|
| Arab Bank TW-2026-0007 | Exists | Through **Invoice Generated** (`INV-2026-00003`); Media Plan workspace OK; Invoice Paid / Close pending |
| L'Oréal TW-2026-0006 | Exists | Partial — CIO draft; 0% GP legacy |
| Tuna TW-2026-0005 | Exists | Lifecycle PASS (historical) |
| Coca TW-2026-0002 | Exists | PO + Timeline PASS (historical) |
| e&, Noon, Trendyol, F1, Liwa, Alshaya, FirstCry, Dar Global, NBK | Brands exist | Pending full Intelligence→Close |

---

## Stop condition checklist

- [x] STAB-018/019/020/016/022/026/027/028 live PASS
- [ ] STAB-021 Preview live PASS (fresh Generate PO=revenue)
- [ ] Multi-brand full journeys (13)
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High
- [ ] Enterprise QA Report
- [ ] Release 2.4 may begin — **NO**
