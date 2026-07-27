# Unified Media Plan — Architecture Plan

**Branch:** `feature/unified-media-plan`  
**Engine:** `lib/media-plan` (Phase 0)  
**Status:** Approved principles; Phase 0 foundations landed

## Goal

One Media Plan capability for Studio, Campaign, Client Portal, Performance, and Reporting — with an immutable Current Approved Baseline, at most one Working Draft, and Actual/Remaining derived only from the approved baseline.

## Non-negotiable principles

1. **Current Approved Baseline + Working Draft** — distinct concepts; ≤1 draft; baseline immutable.
2. **Actual / Remaining** — always from Current Approved Baseline + Performance; never from draft (optional future Preview Mode).
3. **Media Plan Engine** — sole business-logic owner (`lib/media-plan`).
4. **Regenerate** — visible always; enabled only for Draft; never mutates approved versions.
5. **Comparison Mode** — future-ready baseline vs draft diff (engine API exists).
6. **Campaign Timeline** — Media Plan lifecycle events feed campaign history.
7. **Output ownership** — Outputs consume Media Plan; must never mutate/regenerate schedule.
8. **Acceptance criteria** — see engine tests + checklist below.

## SSOT mapping

| Concept | Storage (target) |
|---|---|
| Media Plan id | Shared with `campaign_objects.id` (Studio ↔ Campaign) |
| Schedule slots | Today: `meta.mediaPlanSchedule`; Engine domain: `MediaPlanItem[]` per version |
| Versions | `campaign_object_versions` + engine version records |
| Actual source | `assignment_deliverables.live_date` (and post schedule) |
| Remaining | Baseline items − completed performance facts |

**Do not** introduce a parallel editable Media Plan table set that forks Studio state.

## Module layout (Phase 0)

```
lib/media-plan/
  media-plan-engine.ts   # facade consumed by all modules
  versioning.ts          # baseline / draft invariants
  regenerate-policy.ts   # regenerate UI + prepareRegenerate
  projections.ts         # Actual / Remaining
  compare.ts             # baseline vs draft diff
  ownership.ts           # outputs must not mutate schedule
  timeline-events.ts     # campaign timeline event shapes
  status.ts / types.ts / config.ts
  media-plan-engine.test.ts
```

## Status model

| Status | Editable | Regenerate |
|---|---|---|
| Draft | Yes | Enabled |
| Locked | No | Disabled + message |
| Approved by Client | No (immutable) | Disabled + message |
| Approved on Behalf of Client | No (immutable) | Disabled + message |
| Pending Approval | No | Disabled + message |

Disabled regenerate message:

> This Media Plan is locked or approved and cannot be regenerated. Create or continue a draft revision to make changes.

## Phased delivery

| Phase | Scope |
|---|---|
| **0** | Engine + invariants + tests + this plan *(current)* |
| **1** | Persist version pointers on Campaign Object; Campaign full-page workspace reusing Studio calendar |
| **2** | Wire schedule mutations / regenerate / lock / approve through engine guards |
| **3** | Actual / Remaining UI views from Performance facts |
| **4** | Client Portal Original read-only + approvals |
| **5** | Timeline feed, comparison UI, regression matrix |

## Acceptance checklist

- [x] Exactly one Current Approved Baseline (engine invariant)
- [x] At most one Working Draft; reopen continues draft
- [x] Approved versions immutable
- [x] Same `mediaPlanId` / `campaignObjectId` contract for Studio + Campaign
- [x] Regenerate never modifies approved version
- [x] Actual / Remaining from approved baseline only
- [ ] Existing Studio UI wired through engine (Phase 1–2)
- [ ] No duplicate APIs/components/scheduling logic (enforce in Phase 1–2 review)

## Test

```bash
npm run test:media-plan-engine
```

## Environment

Development only (`hsxrewjcbvmbkqdlzjhs`). No Production schema or deploy in Phase 0.
