# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** **`6f5c18a4`** (STAB-030) · STAB-029/021 live PASS on Noon TW-2026-0008  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **94 / 100** | 2026-08-03 soak | Noon fresh Generate: PO=revenue (666667), cost 500k, **25% GP**. STAB-029/030/021 live. Multi-brand Close + negative still open. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-023 | Medium | CIO send to `@example.com` fails Resend | Provider rejects example.com | Soak friction; status still advances via token | Send history failed; approval still PASS | Open — use thinkway test inbox |
| STAB-024 | Low | Email preview Agreed Amount EGP 0.00 | Preview vs document rollup | Mild commercial confusion | Arab Bank CIO preview | Open |
| STAB-025 | Medium | “Viewing Client/Vendor IO while work is in Deliverables/Performance/Finance” | process guidance vs stage | Mild lifecycle contradiction | Arab Bank post-CIO | Open |
| STAB-003 | High | Multi-brand full journey soak incomplete | Journeys not run | Coverage gap | Noon at CIO; Arab Bank invoice; 11 brands pending Close | In progress |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC | Mild | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |
| STAB-031 | Medium | Studio approval UI stale after Submit/Approve (no toast; shows Draft while DB in_review/approved) | Client context not refreshed after server action | Operator retries; confusing “Only draft…” error | Noon `cbae2928` | Open — hard refresh recovers |

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
| STAB-029 | High | Duplicate-fact polish → INPUT REQUIRED blocks Generate | tip `a96c927` WARNING + no polish pause | PASS live — Noon CIP `cbae2928` built with **no** INPUT REQUIRED |
| STAB-030 | High | Brand-only briefs block Client readiness / Generate | tip `6f5c18a4` brand-as-client | PASS live — Noon Ready→Submit→Approve→Generate TW-2026-0008 |
| STAB-021 | High | Generate PO = brief cost vs line revenue | tip `0ab3d8aa` PO sized to revenue | PASS live — Noon PO 666667 = Σ revenue; cost 500k; **25% GP** |
| STAB-016 | High | Generate revenue=cost 0% GP | mapper | PASS live again on Noon TW-2026-0008 **25% GP** |

---

## Soak coverage

| Brand | Inventory | Full Intelligence→Close |
|---|---|---|
| Arab Bank TW-2026-0007 | Exists | Through **Invoice Generated** (`INV-2026-00003`); Invoice Paid / Close pending |
| Noon TW-2026-0008 | Exists | Fresh Intelligence→Generate PASS (STAB-029/030/021/016); at **Client IO** (`CIO-2026-0008`) |
| L'Oréal TW-2026-0006 | Exists | Partial — CIO draft; 0% GP legacy |
| Tuna TW-2026-0005 | Exists | Lifecycle PASS (historical) |
| Coca TW-2026-0002 | Exists | PO + Timeline PASS (historical) |
| e&, Trendyol, F1, Liwa, Alshaya, FirstCry, Dar Global, NBK | Brands exist | Pending full Intelligence→Close |

---

## Stop condition checklist

- [x] STAB-018/019/020/016/021/022/026/027/028/029/030 live PASS
- [ ] Multi-brand full journeys (13) — Noon + Arab Bank advanced; others pending
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High (STAB-031 Medium logged)
- [ ] Enterprise QA Report
- [ ] Release 2.4 may begin — **NO**
