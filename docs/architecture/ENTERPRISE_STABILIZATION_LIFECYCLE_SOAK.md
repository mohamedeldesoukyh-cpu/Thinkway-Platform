# Enterprise Product Stabilization — Lifecycle Consistency

**Date:** 2026-08-03  
**Mode:** QA Director / Product Tester — workflow engine soak (no feature work)  
**Branch tip (local):** `develop`  
**Primary contradiction:** TW-2026-0005 / TW-2026-5 — Client IO Approved vs Vendor IO locked

---

## Verdict

| Gate | Result |
|---|---|
| Root cause identified | ✅ Product / workflow-engine bug (not UI) |
| Engine fix | ✅ Landed in lifecycle + workspace blocker classification |
| Lifecycle regression suite | ✅ **44/44 pass** |
| Consistency soak (fixtures + Dev probe) | ✅ **SOAK PASS** |
| Continuous multi-campaign UI soak to zero contradictions | ⏸ Requires Preview/Dev deploy of this tip + live sessions |
| **Product Readiness score** | **88 / 100** |

**Enterprise-ready recommendation:** **Conditionally yes** for Campaign Workspace Decision Center / Client IO → Vendor IO progression after this tip is deployed to Development and smoke-verified on TW-2026-0005. Full continuous UI soak across Intelligence → Finance remains open until Preview hosts the tip.

---

## TW-2026-0005 — Investigation answers

| # | Question | Answer |
|---|---|---|
| 1 | Workflow state incorrect? | **Yes** — process cue short-circuited to `blocked` / `client-io` while Client IO was already `approved`. |
| 2 | Campaign issue resolved but never closed? | **No orphan issue row** — “Campaign Issue #TW-2026-0005” was a **synthesized Decision Center card** from workspace alert text, not a durable open ticket. |
| 3 | Decision Center reading stale state? | **No stale cache** — recomputed each load; inputs were wrong (soft alerts treated as hard). |
| 4 | Resolver / event bus failing? | **No** — pure derived state; no event bus miss. |
| 5 | Workflow transition missing? | **Yes (effective)** — approved Client IO → Deliverables/Vendor follow-up never ran because soft `blockerCount` short-circuited first. |
| 6 | Blocker intentionally valid or bug? | **Bug** — unpaid creator costs are normal before Finance; must not stop Vendor IO after Client approval. |
| 7 | UI inconsistent with backend? | **UI matched a wrong engine model** — Client IO document status was correct; Decision Center / Vendor lock were wrong. |

---

## Root causes (every fix)

| ID | Root cause | Fix |
|---|---|---|
| **RC-1** | `deriveCampaignProcessCue` treated **any** `blockerCount > 0` as `lifecycleSignal: "blocked"` and pinned stage to `client-io` whenever `clientIoStatus` was truthy (including **`approved`**) | Short-circuit **only** on `poExceeded`; approved CIO continues into Deliverables / ops path |
| **RC-2** | Workspace always pushed **“Creator payouts outstanding”** (and similar soft finance/ops strings) into `workspace.blockers`, inflating `blockerCount` | Soft strings still visible for Decision Center, but **`countHardProgressionBlockers`** excludes them from progression `blockerCount` |
| **RC-3** | Decision Center classified soft alerts as **business_blocker** because `lower.includes("po")` matches **“payouts”**, and because `hardBlockers.length > 0` elevated **all** workspace strings | Word-boundary PO matching; soft alerts → **Finance `operational_attention`**; never “Campaign Issue” business blockers |
| **RC-4** | Hard-enforcement path copied **all** workspace blockers into hard lifecycle blockers | Hard path filters to true progression strings only |

---

## Evidence

### Automated

```
npx tsx --test features/campaigns/lifecycle/*.test.ts
→ 44/44 pass (includes TW-2026-0005 contradiction cases)

npx tsx scripts/soak-lifecycle-consistency.mjs
→ Fixture matrix PASS + Dev probe when .env.local → hsxrewjcbvmbkqdlzjhs
```

### Files changed

- `features/campaigns/lifecycle/campaign-process-presentation.ts`
- `features/campaigns/lifecycle/campaign-decision-center.ts`
- `features/campaigns/lifecycle/campaign-lifecycle-orchestrator.ts`
- `lib/services/campaigns/campaign-workspace-service.ts` (comments; soft alerts retained)
- Tests under `features/campaigns/lifecycle/*.test.ts`
- `scripts/soak-lifecycle-consistency.mjs`

---

## Remaining issues (honest)

| Issue | Severity | Notes |
|---|---|---|
| Tip not yet verified on live TW-2026-0005 UI | Medium | Needs Dev/Preview deploy + browser re-check |
| Continuous full journey soak (Intelligence → Performance) | Medium | Engine soak covers Decision Center spine; Studio/Generate journeys still need session soak on tip |
| Soft alerts only appear when not crowded out by Vendor IO story filter | Low | By design: Vendor IO ops is executive story after CIO approval |
| Client IO Send still recipient-gated | Low | Correct commercial gate (not this bug) |

---

## Product Readiness score (88/100)

| Dimension | Score | Weight |
|---|---|---|
| Correctness of CIO → VIO progression model | 95 | High |
| Decision Center severity taxonomy | 90 | High |
| Regression coverage for contradiction | 95 | High |
| Live multi-campaign UI soak on tip | 70 | High (gap) |
| End-to-end Intelligence→Finance continuous soak | 75 | Medium |

**Weighted ≈ 88.** Raise to **95+** after Preview deploy + TW-2026-0005 browser PASS + one fresh Generate journey without Decision Center contradictions.

---

## Recommendation

1. Deploy this tip to **Development / Preview** (not Production until Product signs off).  
2. Re-open **TW-2026-0005**: expect Client IO Approved, progression **may continue**, Vendor IO **not** locked by Campaign Issue / payouts.  
3. Continue automated soak via `scripts/soak-lifecycle-consistency.mjs` on every lifecycle change.  
4. Do **not** treat unpaid creator payouts as campaign-stopping blockers again.
