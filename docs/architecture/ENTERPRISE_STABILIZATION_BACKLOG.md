# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` @ `10476a71` (docs tip `80d2e253`)  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **90 / 100** | 2026-08-03 expand | STAB-012/014/015/017 live PASS. STAB-016 tip fixed — needs **fresh Generate** (L'Oréal lines remain 0% until re-materialized). STAB-003 brands now created via UI; full journeys pending. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-016 | High | Generate produced revenue=cost, 0% margin | Plan mapper set revenue=cost | Unsellable package | L'Oréal Finance live **0.0% GP** (EGP 1.5M = 1.5M); unit test PASS | **Fixed tip** `68df94e5` — **fresh Generate soak open** (linked plans cannot rematerialize) |
| STAB-018 | High | Timeline “Assignments Completed · Done” while CIO still draft | `occurred: lineCount > 0` duplicated Created condition | Misleading journey order | L'Oréal TW-2026-0006 live | **Fixed tip** — Assignments Completed requires vendor approvals |
| STAB-003 | High | Multi-brand full journey soak incomplete | Brands present; journeys not run | Coverage gap | UI create PASS (13 brands) | Brands inventory PASS — full journeys pending (Noon Studio open) |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC | Mild | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |

---

## Resolved issues (live verified)

| ID | Severity | Title | Fix | Validated |
|---|---|---|---|---|
| STAB-001 | Critical | CIO/VIO soft-alert lock | efb1c3b3 | PASS |
| STAB-007 | Medium | Deliverables badge vs docs repo | 94e9c0c9 | PASS |
| STAB-008–011 | High/Med | List/cue contradictions | 6f87093e…19ee1272 | PASS |
| STAB-012 | High | List ignored legacy PO | c64bbdc3 | PASS live TW-2026-2 Finance/Review PO |
| STAB-014 | Medium | VIO may-continue while blocked | c64bbdc3 | PASS live |
| STAB-015 | Medium | Timeline Deliverables Upcoming vs explorer | 68df94e5 | PASS live Deliverables Uploaded · Done |
| STAB-017 | Medium | Publication Live Done with 0 pubs | 10476a71 | PASS live Publication Live · Upcoming |

---

## Soak coverage

| Brand | Inventory | Workspace soak | Full Intelligence→Close |
|---|---|---|---|
| e& | Exists | Partial (Studio open; plan draft) | Pending |
| L'Oréal | Exists | CIO/VIO PASS; commercial 0% until Generate | Fresh Generate pending |
| Tuna / TW-2026-0005 | Exists | Lifecycle PASS | — |
| Coca / TW-2026-0002 | Exists | PO Finance + Timeline PASS | — |
| Arab Bank / NBK | Exists | Not started | Pending |
| Noon | **Created UI** Bundle Plus | Not started | Pending |
| Trendyol | **Created UI** | Not started | Pending |
| Formula 1 | **Created UI** | Not started | Pending |
| Liwa Festival | **Created UI** | Not started | Pending |
| Alshaya | **Created UI** | Not started | Pending |
| FirstCry | **Created UI** | Not started | Pending |
| Dar Global | **Created UI** | Not started | Pending |

**Brand inventory (Dev, via product UI):** 13 brands — Alshaya, Arab Bank, Coca, Dar Global, E&, FirstCry, Formula 1, L'Oréal Paris, Liwa Festival, NBK Bank, Noon, Trendyol, Tuna Dolphin.

---

## Negative / cross-workspace (expand)

| Dimension | Status |
|---|---|
| Missing / partial approvals | Not complete |
| Rejected CIO / VIO | Not complete |
| Duplicate Generate | Blocked until STAB-016 fresh Generate |
| Cross-workspace sync (DC ↔ list ↔ timeline ↔ finance) | Partial (STAB-012/014/015/017) |
| Multi-user consistency | Not started |

---

## Stop condition checklist

- [x] STAB-001/007–012/014/015/017 live PASS
- [ ] STAB-016 fresh Generate soak (revenue > cost ~25% GP)
- [ ] STAB-018 Preview live (Assignments Completed vs CIO)
- [x] Soak brands present via product UI (STAB-003 inventory)
- [ ] Multi-brand full journeys (STAB-003)
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High
- [ ] Enterprise CTO Acceptance Review
- [ ] Release 2.4 may begin — **NO**
