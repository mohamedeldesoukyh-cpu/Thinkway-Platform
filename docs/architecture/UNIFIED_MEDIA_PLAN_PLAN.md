# Unified Media Plan — Architecture Plan

**Branch:** `feature/unified-media-plan`  
**Engine:** `lib/media-plan`  
**Status:** Media Planning v1 feature complete (approved 2026-07-27)  
**Release decisions:** **Superseded** by the production readiness report (kept as design principles / history — not deleted).

> **Canonical implementation & production readiness SSOT:**  
> [`docs/architecture/MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`](./MEDIA_PLANNING_V1_PRODUCTION_READINESS.md)

## Goal

One Media Plan capability for Studio, Campaign, Client Portal, Performance, and Reporting — with an immutable Current Approved Baseline, at most one Working Draft, and Actual/Remaining derived only from the approved baseline.

## Non-negotiable principles

1. **Current Approved Baseline + Working Draft** — distinct concepts; ≤1 draft; baseline immutable.
2. **Actual / Remaining** — always from Current Approved Baseline + Performance; never from draft (optional future Preview Mode).
3. **Media Plan Engine** — sole business-logic owner (`lib/media-plan`).
4. **Regenerate** — visible always; enabled only for Draft; never mutates approved versions.
5. **Comparison Mode** — baseline vs draft diff (engine + Campaign UI).
6. **Campaign Timeline** — Media Plan lifecycle events feed campaign history via `audit_logs`.
7. **Output ownership** — Outputs consume Media Plan; must never mutate/regenerate schedule.
8. **Acceptance** — see Media Planning v1 production readiness report.

## SSOT mapping

| Concept | Storage |
|---|---|
| Media Plan id | Shared with `campaign_objects.id` (Studio ↔ Campaign) |
| Schedule slots | `meta.mediaPlanSchedule`; Engine domain: `MediaPlanItem[]` per version |
| Versions / lifecycle | `campaign_object_versions` + `meta.mediaPlanLifecycle` |
| Actual source | Assignment / performance live dates |
| Remaining | Baseline items − completed performance facts |

**Do not** introduce a parallel editable Media Plan table set that forks Studio state.

## Phased delivery (v1 complete)

| Phase | Scope | Doc |
|---|---|---|
| **0** | Engine + invariants + tests | this plan + engine tests |
| **1** | Studio writes via Engine bridge | `UNIFIED_MEDIA_PLAN_PHASE1_WRITE_PATHS.md` |
| **2** | Campaign full-page workspace | `UNIFIED_MEDIA_PLAN_PHASE2_REPORT.md` |
| **3** | Timeline + Comparison + Approval | `UNIFIED_MEDIA_PLAN_PHASE3_REPORT.md` |
| **4** | Client Portal Original + portal decisions | `UNIFIED_MEDIA_PLAN_PHASE4_REPORT.md` |
| **v1** | Production readiness / release SSOT | **`MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`** |

## Tests

```bash
npm run test:media-plan-engine
npm run test:media-plan-phase1
npm run test:media-plan-phase2
npm run test:media-plan-phase3
npm run test:media-plan-phase4
```

## Release 2

See §9 in `MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`. Do not start new Media Planning features unless requested.
