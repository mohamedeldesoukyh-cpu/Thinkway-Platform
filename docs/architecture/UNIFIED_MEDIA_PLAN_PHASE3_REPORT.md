# Unified Media Plan — Phase 3 Report (Timeline · Compare · Approval)

**Branch:** `feature/unified-media-plan`  
**Date:** 2026-07-27

Revised order (approved): Timeline → Comparison → Approval → Client Portal → Baseline refinement.

## 1. Campaign Timeline integration

| Item | Detail |
|---|---|
| Storage | Existing `audit_logs` (no new table) |
| Logger | `lib/media-plan/log-media-plan-timeline.ts` → `logMediaPlanTimelineEvents` |
| Feed | Campaign Timeline **Activity** panel |
| Entity | `entity_type: campaign_headers` + header id (visible to existing query) |
| Summary | Activity mapping prefers `metadata.summary` / `metadata.label` |

### Events written to Timeline

`media_plan_created`, `draft_created`, `revision_created`, `media_plan_regenerated`, `media_plan_locked`, `media_plan_unlocked`, `client_approved`, `approved_on_behalf`, `baseline_published`, `changes_requested`, `rejected`

Excluded (noise): `schedule_edited`, `sync`

### Hook points

- `media-plan-lifecycle-actions.ts` — lock / unlock / approve / request changes / reject  
- `update-media-plan-schedule.ts` — filtered events (e.g. draft fork)  
- Studio Copilot Media Plan regenerate — draft fork + regenerated  

## 2. Comparison Mode

| Item | Detail |
|---|---|
| Engine API | `mediaPlanEngine.compare(baseline, draft)` (existing) |
| UI | `media-plan-comparison-panel.tsx` on Campaign Media Plan workspace |
| Highlights | Date / creator / deliverable / platform / added / removed |
| Entry | **Compare** when approved baseline + working draft both exist |

## 3. Approval workflow

| Action | Engine / action | Status effect |
|---|---|---|
| Lock | `lockMediaPlanAction` | draft → locked |
| Unlock | `unlockMediaPlanAction` | locked → draft; approved → new draft (baseline frozen) |
| Approved by Client | `approveMediaPlanAction` (`client_portal`) | → approved baseline |
| Approve on Behalf | `approveMediaPlanAction` (`on_behalf` + source) | → approved baseline |
| Request Changes | `requestMediaPlanChangesAction` | → draft / pending revision |
| Reject | `rejectMediaPlanAction` | locked → draft |

UI: `media-plan-approval-toolbar.tsx` on Campaign Media Plan workspace.

## Database impact

**None** — reuses `audit_logs` + existing Campaign Object lifecycle meta.

## Follow-ups (after Phase 4 Original)

1. Portal approve / request changes (`client_portal.approve`) — see Phase 4 report  
2. Baseline item snapshot refinement when draft diverges strongly from schedule meta  
3. Optional: dedicated regenerate button on Campaign workspace (Studio path already wired)

## Tests

```bash
npm run test:media-plan-phase1
npm run test:media-plan-phase2
npx tsx --test lib/media-plan/log-media-plan-timeline.test.ts features/campaign-outputs/media-plan-mutations.test.ts
```
