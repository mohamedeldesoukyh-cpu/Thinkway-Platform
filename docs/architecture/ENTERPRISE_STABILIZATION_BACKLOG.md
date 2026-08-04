# Release 2.3 — Enterprise Stabilization Backlog

**Living document** — update on every investigate → fix → soak cycle.  
**Tip under soak:** **`a8843f08`** · STAB-032–035 live PASS  
**Do not start Release 2.4 until stop condition met.**  
**Do not optimize for readiness score — optimize for enterprise trust.**

---

## Product Readiness (current)

| Score | As of | Justification |
|---|---|---|
| **95 / 100** | 2026-08-04 soak | No open Critical. STAB-032–035 live PASS. Noon + Arab Bank Closed. Multi-brand remaining + negative testing open. |

Score is evidence-based — not optimized.

---

## Open issues

| ID | Severity | Title | Root cause | Business impact | Evidence | Status |
|---|---|---|---|---|---|---|
| STAB-023 | Medium | CIO send to `@example.com` fails Resend | Provider rejects example.com | Soak friction; status still advances via token | Send history failed; approval still PASS | Open — use thinkway test inbox |
| STAB-024 | Low | Email preview Agreed Amount EGP 0.00 | Preview vs document rollup | Mild commercial confusion | Arab Bank CIO preview | Open |
| STAB-025 | Medium | “Viewing Client/Vendor IO while work is in …” | process guidance vs stage | Mild lifecycle contradiction | Noon + Arab Bank | Open |
| STAB-003 | High | Multi-brand full journey soak incomplete | Journeys not run | Coverage gap | Noon+Arab Closed; 11 brands pending | In progress |
| STAB-006 | Low | Breadcrumb Waiting Operations vs Finance owner | waitingFor vs DC | Mild | TW-2026-0005 | Open |
| STAB-005 | Low | Soft finance alerts story-filtered | selectStoryBlockers | Monitor | By design | Deferred |
| STAB-031 | Medium | Studio approval UI stale after Submit/Approve | Client context not refreshed after server action | Operator retries | Noon CIP | Open — hard refresh recovers |

---

## Resolved issues (live verified)

| ID | Severity | Title | Fix | Validated |
|---|---|---|---|---|
| STAB-001 | Critical | CIO/VIO soft-alert lock | efb1c3b3 | PASS |
| STAB-007–017 | Med/High | List/cue/timeline contradictions | various | PASS |
| STAB-018–022 | Med/High | Lifecycle / Finance / Posted | various | PASS live |
| STAB-026–030 | Med/High | KPIs / pubs / Generate readiness | various | PASS live |
| STAB-016/021 | High | GP / PO vs revenue | mapper + PO sizing | PASS live Noon |
| STAB-032 | Critical | Closed Done before Invoice Paid | tip `c70d3d52`/`f50bdd7` | PASS live Noon unpaid/repay |
| STAB-033 | High | Process rail Upcoming after Closed | tip `08fd1607` all stages Completed | PASS live Noon |
| STAB-034 | Medium | DC Next Collections for payouts | tip `08fd1607` Next Finance | PASS live Noon/Arab |
| STAB-035 | High | Invoice Paid Done while lines unbilled | tip `a8843f08` `fullyInvoiced` gate | PASS live Arab Bank break/restore |

---

## Soak coverage

| Brand | Inventory | Full Intelligence→Close |
|---|---|---|
| Noon TW-2026-0008 | Exists | **PASS** Intelligence→Close (Paid+Closed+rail Completed) |
| Arab Bank TW-2026-0007 | Exists | **PASS** through Close (after invoicing remaining 9 lines + STAB-035) |
| L'Oréal TW-2026-0006 | Exists | Partial — CIO draft; 0% GP legacy |
| Tuna TW-2026-0005 | Exists | Lifecycle PASS (historical) |
| Coca TW-2026-0002 | Exists | PO + Timeline PASS (historical) |
| e&, Trendyol, F1, Liwa, Alshaya, FirstCry, Dar Global, NBK | Brands exist | Pending full Intelligence→Close |

---

## Stop condition checklist

- [x] STAB-018–022 / 026–030 / 016/021 live PASS
- [x] STAB-032 Critical fix live PASS
- [x] STAB-033 High fix live PASS
- [x] STAB-035 High fix live PASS
- [ ] Multi-brand full journeys (13) — Noon + Arab Bank Closed; others pending
- [ ] Negative testing complete
- [ ] Cross-workspace consistency verified
- [ ] Discovery Mode: no new Critical/High
- [ ] Enterprise QA Report
- [ ] Release 2.4 may begin — **NO**
