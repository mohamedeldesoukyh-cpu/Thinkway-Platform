# Unified Media Plan — Phase 2 Report

**Branch:** `feature/unified-media-plan`  
**Date:** 2026-07-27

## Components reused (no second calendar)

| Component / module | Path |
|---|---|
| `MediaPlanCalendar` | `features/campaign-outputs/components/media-plan-calendar.tsx` |
| Media Plan brand tokens | `features/campaign-outputs/components/media-plan-brand.tsx` (via calendar) |
| Week/date helpers | `features/campaign-outputs/media-plan-week-range.ts` |
| Studio schedule write action | `features/campaign-outputs/actions/update-media-plan-schedule.ts` → Engine |
| Studio launcher | `features/campaign-outputs/components/open-campaign-studio-launcher-lazy.tsx` |
| Media Plan Engine | `lib/media-plan` (`projectActual`, `projectRemaining`, status labels) |
| Output display / generate | `getOutputContentForDisplay`, `generateMediaPlan` |

## New components / modules

| Artifact | Path | Role |
|---|---|---|
| Calendar adapter | `lib/media-plan/calendar-adapter.ts` | `MediaPlanItem[]` ↔ `MediaPlanData` for one calendar |
| Performance facts mapper | `lib/media-plan/performance-facts.ts` | Assignment hierarchy → Engine facts |
| Campaign Object → Engine state | `lib/media-plan/campaign-object-state.ts` | Baseline + tip hydration |
| Workspace loader | `features/campaigns/queries/load-campaign-media-plan.ts` | Server payload for three views |
| Full-page workspace UI | `features/campaigns/components/media-plan/campaign-media-plan-workspace.tsx` | Tabs + shared calendar shell |
| Route helper | `campaignMediaPlanPath` in `lib/routing/entity-paths.ts` | Canonical Media Plan URL |

## New routes

| Route | Description |
|---|---|
| `/campaigns/[id]/media-plan` | Full-page Campaign Media Plan workspace |
| `?view=original\|actual\|remaining` | View switch (default Original) |

Header entry: **Media Plans** button on Campaign Header → full-page workspace (not a modal).

## Database impact

**None.** Phase 2 reads existing:

- `campaign_headers.campaign_object_id`
- `campaign_objects` / `campaign_object_versions`
- `assignment_deliverables` / `assignment_post_schedule` (via assignment hierarchy)

No new tables or migrations.

## API changes

| Change | Notes |
|---|---|
| No new public REST endpoints | Server page loader + existing `updateMediaPlanScheduleAction` |
| `campaignMediaPlanPath()` | Client/server routing helper |
| Engine adapters exported from `@/lib/media-plan` | `itemsToMediaPlanData`, `mediaPlanDataToItems`, `performanceFactsFromAssignmentHierarchy` |

## View behaviour

| View | Data source | Editable |
|---|---|---|
| Original | Studio Media Plan tip (`getOutputContentForDisplay` / generate) via Engine lifecycle | Yes when status = Draft |
| Actual | Engine `projectActual` from **Current Approved Baseline** + Performance live dates → adapter → `MediaPlanCalendar` | Never |
| Remaining | Engine `projectRemaining` from baseline − completed → adapter → same calendar | Never |

Shared UI state preserved across tabs: **orientation** (portrait/landscape) and **scroll position** per view. (Studio calendar has no month/week/zoom controls today.)

## Validation

```bash
npm run test:media-plan-phase2
npm run test:media-plan-phase1
```

## Remaining work before Client Portal (Phase 4)

1. Persist approved baseline item snapshots (not only schedule meta) for stronger planned-vs-actual fidelity when draft diverges.
2. Wire Campaign Timeline feed for Media Plan lifecycle events (Phase 2/5).
3. Client Portal Original-only read-only surface using the same `MediaPlanCalendar` + Engine permissions.
4. Client Approve / Request Changes + on-behalf UI on Campaign workspace.
5. Comparison Mode UI (baseline vs draft diffs — Engine API already exists).
6. Optional calendar filters / week focus if product adds them — keep parent-owned for tab preservation.
