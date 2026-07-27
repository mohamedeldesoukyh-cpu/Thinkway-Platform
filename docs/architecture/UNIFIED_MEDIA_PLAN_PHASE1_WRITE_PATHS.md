# Unified Media Plan — Phase 1 Write-Path Report

**Branch:** `feature/unified-media-plan`  
**Date:** 2026-07-27

## Previous production write paths

| # | Path | Mechanism |
|---|---|---|
| 1 | `features/campaign-outputs/actions/update-media-plan-schedule.ts` | DnD / date moves via `applyMediaPlanScheduleChange` |
| 2 | `features/campaign-outputs/actions/update-campaign-market-intelligence.ts` | Market intelligence toggles via `applyMediaPlanScheduleChange` |
| 3 | `features/campaign-studio/services/copilot/studio-copilot.ts` → `rescheduleMediaPlan` | Copilot week weights / moves via `applyMediaPlanScheduleChange` |
| 4 | `features/campaign-studio/services/merge-campaign-brief.ts` | Direct `meta.mediaPlanSchedule = nextSchedule` for brief-derived week weights |
| 5 | `features/campaign-outputs/media-plan-schedule.ts` → `applyMediaPlanScheduleChange` | Shared low-level writer used by 1–3 |

Lock / Unlock / Approve for **Media Plan** (as distinct from Campaign Plan lifecycle) did not exist as dedicated actions.

## Now routed through Media Plan Engine

| # | Path | Engine entry |
|---|---|---|
| 1 | `updateMediaPlanScheduleAction` | `mutateMediaPlanSchedule` (`source: studio_media_plan_ui`) |
| 2 | `updateCampaignMarketIntelligenceAction` | `mutateMediaPlanSchedule` |
| 3 | Copilot `rescheduleMediaPlan` | `mutateMediaPlanSchedule` |
| 4 | `mergeBriefIntoCampaignObject` week weights | `mutateMediaPlanSchedule` |
| 5 | Copilot `regenerate_output` for `media_plan` | `prepareMediaPlanRegenerate` then output generate (schedule never mutated by generator) |
| 6 | Lock / Unlock / Approve | `lockMediaPlanOnCampaignObject` / `unlockMediaPlanOnCampaignObject` / `approveMediaPlanOnCampaignObject` + `media-plan-lifecycle-actions.ts` |

Low-level writer renamed to `applyMediaPlanScheduleChangeUnchecked` — **only** callable from `media-plan-mutations.ts` (enforced by `media-plan-write-path-audit.test.ts`).

## Remaining direct `mediaPlanSchedule` touches (allowed)

| Path | Why allowed |
|---|---|
| `media-plan-schedule.ts` (`applyMediaPlanScheduleChangeUnchecked`) | Engine-internal apply after guards |
| `media-plan-mutations.ts` (draft fork copies baseline snapshot → tip) | Engine version creation |
| `resolve-campaign-object-for-edit.ts` | Hydration merge of candidate objects — not a user schedule edit |
| `*.test.ts` fixtures | Test setup only (excluded from audit walk) |

## Explicitly not schedule mutations

| Path | Notes |
|---|---|
| `generateCampaignOutput(..., "media_plan")` | Reads schedule; writes **output registry** only |
| `regenerateStaleCampaignOutputs` | Output views only — must not fork drafts |
| Campaign Plan lifecycle (`isCampaignPlanLockedForEdits`) | Separate from Media Plan lifecycle |

## Regenerate rules (verified)

- Draft → regenerate enabled / proceeds on working tip  
- Locked → regenerate UI disabled; `prepareMediaPlanRegenerate.canRegenerateNow = false`  
- Approved → never mutates baseline snapshot; forks or continues single Working Draft; regenerate applies to draft tip only  

## Validation

```bash
npm run test:media-plan-phase1
```
