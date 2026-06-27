# Campaign Service Layer Audit — Phase 3 Step 2

**Date:** June 2026  
**Branch:** `refactor/phase2-shared-domains-ui`  
**Scope:** Extract workspace assembly, publication performance bundle, performance actions, and assignment-deliverable actions into `lib/services/campaigns/`

---

## Executive Summary

Phase 3 Step 2 completes the campaign service layer extraction started in Step 1. Server actions and query entry points remain the public API; they follow **authorize → validate → invoke service → revalidate → return**.

**Extracted in Step 2:** `getCampaignWorkspace` (~760 LOC), publication performance bundle, performance-actions orchestration, assignment-deliverable hierarchy CRUD.  
**Remaining gaps:** `publication-actions.ts` (create publication), `load-campaign-tab-data.ts` (deferred tab loading).

---

## LOC Metrics (Step 2)

| File | Before (Step 1 end) | After | Δ |
|------|---------------------|-------|---|
| `features/campaigns/queries.ts` | 898 | 78 | **−820 (−91%)** |
| `features/campaigns/queries/publications.ts` | 879 | 17 | **−862 (−98%)** |
| `features/campaigns/actions/performance-actions.ts` | 626 | 309 | **−317 (−51%)** |
| `features/campaigns/actions/assignment-deliverable-actions.ts` | 712 | 212 | **−500 (−70%)** |
| **New Step 2 service modules** | 0 | 2,934 | +2,934 |

### Step 2 module breakdown

| File | LOC |
|------|-----|
| `campaign-workspace-service.ts` | 737 |
| `campaign-publication-service.ts` | 547 |
| `campaign-deliverable-service.ts` | 642 |
| `campaign-performance-service.ts` | 525 |
| `repositories/workspace-repository.ts` | 153 |
| `repositories/publication-repository.ts` | 321 |
| `repositories/performance-repository.ts` | 9 |

**Cumulative service layer (`lib/services/campaigns/`):** 5,232 LOC (Step 1 + Step 2 + tests).

**Net feature-layer reduction (Step 2):** −2,499 LOC from the four extracted entry files.

---

## Action Inventory (updated)

| Action | Service | Repository | Status |
|--------|---------|------------|--------|
| `createAssignmentDeliverableAction` | `campaign-deliverable-service.createAssignmentDeliverable` | inline Supabase | ✅ Extracted |
| `updateAssignmentDeliverableAction` | `campaign-deliverable-service.updateAssignmentDeliverable` | inline Supabase | ✅ Extracted |
| `deleteAssignmentDeliverableAction` | `campaign-deliverable-service.deleteAssignmentDeliverable` | inline Supabase | ✅ Extracted |
| `updatePostScheduleAction` | `campaign-deliverable-service.updatePostSchedule` | inline Supabase | ✅ Extracted |
| `addPostToDeliverableAction` | `campaign-deliverable-service.addPostToDeliverable` | inline Supabase | ✅ Extracted |
| `updateDeliverablePlatformTypeAction` | `campaign-deliverable-service.updateDeliverablePlatformType` | inline Supabase | ✅ Extracted |
| `updateCampaignPublicationAction` | `campaign-performance-service.updateCampaignPublication` | `performance-repository` | ✅ Extracted |
| `bulkUpdatePublicationStatusAction` | `campaign-performance-service.bulkUpdatePublicationStatus` | `performance-repository` | ✅ Extracted |
| `bulkImportPublicationsAction` | `campaign-performance-service.bulkImportPublications` | `performance-repository` | ✅ Extracted |
| `deleteCampaignPublicationAction` | `campaign-performance-service.deleteCampaignPublication` | `performance-repository` | ✅ Extracted |
| `refreshPublicationMetricsAction` | `campaign-performance-service.refreshPublicationMetrics` | metrics-collector | ✅ Extracted |
| `refreshCampaignMetricsAction` | `campaign-performance-service.refreshCampaignMetrics` | metrics-collector | ✅ Extracted |
| `importPublicationMetricsAction` | `campaign-performance-service.importPublicationMetrics` | metrics-collector | ✅ Extracted |
| `savePublicationDetailsAction` | `campaign-performance-service.savePublicationDetails` | `performance-repository` | ✅ Extracted |
| `saveManualPublicationMetricsAction` | `campaign-performance-service.saveManualPublicationMetrics` | metrics-collector | ✅ Extracted |
| `restoreAutomaticPublicationMetricsAction` | `campaign-performance-service.restoreAutomaticPublicationMetrics` | metrics-collector | ✅ Extracted |
| `loadPublicationSyncLogsAction` | `campaign-performance-service.loadPublicationSyncLogs` | `performance-repository` | ✅ Extracted |
| `requestPublicationScreenshotAction` | `campaign-performance-service.requestPublicationScreenshot` | screenshot queue | ✅ Extracted |

**Not in scope (unchanged):**

- `features/campaigns/actions/publication-actions.ts` (103 LOC) — create publication + auto metrics
- `features/campaigns/actions/load-campaign-tab-data.ts` (252 LOC) — deferred tab loading

---

## Query Inventory (updated)

| Query | Service | Status |
|-------|---------|--------|
| `getCampaignWorkspace` | `campaign-workspace-service.getCampaignWorkspace` | ✅ Extracted |
| `getCampaignPerformanceBundle` | `campaign-publication-service.getCampaignPerformanceBundle` | ✅ Extracted |
| `getCampaignPublications` | `campaign-publication-service.getCampaignPublications` | ✅ Extracted (deprecated alias) |

---

## Service Inventory (cumulative)

```
lib/services/campaigns/
├── campaign-service.ts              # Step 1: header CRUD, list, KPIs
├── campaign-line-service.ts         # Step 1: line create/update
├── campaign-assignment-service.ts   # Step 1: influencer search, legacy deliverable
├── campaign-workflow-service.ts     # Step 1: legacy deliverable status
├── campaign-workspace-service.ts    # Step 2: workspace assembly
├── campaign-publication-service.ts  # Step 2: performance bundle + charts
├── campaign-performance-service.ts  # Step 2: publication metrics mutations
├── campaign-deliverable-service.ts  # Step 2: assignment hierarchy CRUD
├── campaign-commercial.ts
├── index.ts
├── campaign-service-layer.test.ts
└── repositories/
    ├── campaign-repository.ts
    ├── assignment-repository.ts
    ├── workspace-repository.ts      # Step 2
    ├── publication-repository.ts    # Step 1 stub → Step 2 expanded
    └── performance-repository.ts    # Step 2
```

---

## Remaining God Files

| File | LOC | Notes |
|------|-----|-------|
| `features/campaigns/actions.ts` | 296 | Step 1 — core CRUD actions (acceptable) |
| `features/campaigns/actions/load-campaign-tab-data.ts` | 252 | Deferred tab loading — Step 3 candidate |
| `features/campaigns/actions/publication-actions.ts` | 103 | Create publication — Step 3 candidate |
| `lib/services/campaigns/campaign-deliverable-service.ts` | 642 | Largest service module; candidate for deliverable-repository split |
| `lib/services/campaigns/campaign-workspace-service.ts` | 737 | Largest module; presenter split optional |

---

## Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit -p tsconfig.json` | ✅ Pass |
| `npm run build` | ✅ Pass |
| `npx tsx lib/services/campaigns/campaign-service-layer.test.ts` | ✅ Pass |

---

## Constraints Preserved

- ✅ No UX changes
- ✅ No database schema changes
- ✅ No API contract changes (action/query signatures unchanged)
- ✅ Server actions remain public entry points
- ✅ Routes, permissions, audit logging preserved
- ✅ Revalidation paths unchanged

---

## Phase 3 Step 1 Reference

See prior commit `4077e36` and sections above for Step 1 baseline (campaign CRUD, line service, assignment search).

## Remaining Gaps (Phase 3 Step 3+)

1. **`publication-actions.ts`** — create publication + Instagram URL validation + auto metrics
2. **`load-campaign-tab-data.ts`** — deferred tab loading orchestration
3. Move `line-assignment.ts` pure helpers to `lib/campaigns/` to eliminate lib→features imports in services
4. Split `campaign-deliverable-service.ts` DB access into `deliverable-repository.ts`
5. Move IO reads from workspace service (`features/io/queries`) to `lib/io/client-io-query`
