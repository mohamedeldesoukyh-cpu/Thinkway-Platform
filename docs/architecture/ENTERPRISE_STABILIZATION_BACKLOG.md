# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** `develop` @ `10476a71`  
**Do not start Release 2.4 until stop condition met.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **90 / 100** | 2026-08-03 resume | STAB-012/014/015 live PASS. STAB-016 tip (needs fresh Generate). STAB-017 tip (Publication Live). Multi-brand brands still missing (STAB-003). |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-016 | High | Generate produced revenue=cost, 0% margin | Plan mapper set revenue=cost | Unsellable package | L'Oréal TW-2026-0006 | **Fixed tip** `68df94e5` — needs **fresh Generate** soak |
| STAB-017 | Medium | Timeline Publication Live Done with 0 publications | activePerformance used deliverableCount | Misleading journey | TW-2026-0002 after STAB-015 | **Fixed tip** `10476a71` — awaiting Preview |
| STAB-003 | High | Multi-brand full journey soak incomplete | Dev brands only: Arab Bank, Coca, E&, L'Oréal, NBK, Tuna Dolphin. Missing Noon/Trendyol/F1/Liwa/Alshaya/FirstCry/Dar; service_role cannot INSERT brands | Coverage gap | Inventory probe | Open — need UI brand create |
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

---

## Soak coverage

| Brand | Workspace soak | Full Intelligence→Close |
|---|---|---|
| e& | Partial (Studio open) | Pending |
| L'Oréal | Workspace CIO/VIO PASS; commercial FIX tip | Fresh Generate pending |
| Tuna / TW-2026-0005 | Lifecycle PASS | — |
| Coca / TW-2026-0002 | PO Finance PASS | — |
| Noon, Trendyol, F1, Liwa, Alshaya, FirstCry, Dar | No brand | Blocked STAB-003 |

---

## Stop condition checklist

- [x] STAB-001/007–012/014/015 live PASS
- [ ] STAB-016 fresh Generate soak
- [ ] STAB-017 Preview live
- [ ] Multi-brand full journeys (STAB-003)
- [ ] Enterprise CTO Acceptance Review
- [ ] Release 2.4 may begin — **NO**
