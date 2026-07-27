# Unified Media Plan — Phase 4 Report (Client Portal)

**Status:** Historical phase report — **superseded for release decisions** by [`MEDIA_PLANNING_V1_PRODUCTION_READINESS.md`](./MEDIA_PLANNING_V1_PRODUCTION_READINESS.md)  
**Branch:** `feature/unified-media-plan`  
**Date:** 2026-07-27

## Scope delivered

| Item | Detail |
|---|---|
| Route | `/client-portal/campaigns/[id]/media-plan` |
| Calendar | Shared `MediaPlanCalendar` with `editable={false}` |
| Approved Original | Current Approved Baseline only (never Working Draft tip) |
| Pending review | Locked / pending_approval tip for client decision |
| Loader | `features/portals/queries/load-client-media-plan.ts` |
| UI | `client-media-plan-view.tsx` + `client-media-plan-approval-toolbar.tsx` |
| Actions | `client-media-plan-actions.ts` → Engine mutations + Timeline |
| Entry | Client campaigns table links campaign name → Media Plan |

## Approval workflow (Engine-only)

| Portal action | Engine function | Timeline |
|---|---|---|
| Approve | `approveMediaPlanOnCampaignObject` (`client_portal`) | `client_approved`, `baseline_published` |
| Request Changes | `requestChangesMediaPlanOnCampaignObject` | `changes_requested` (+ draft fork events) |
| Reject | `rejectMediaPlanOnCampaignObject` | `rejected` |

Authz: `client_portal.approve` + `client_users.access_role === "approve"` + campaign `client_id` scope.  
Persist: service-role client **after** authz (portal RLS is SELECT-only on campaign objects). No portal-specific scheduling logic.

## RLS (no new entities)

Migration `20260727120000_campaign_objects_client_portal_select.sql`:

- SELECT on `campaign_objects` / `campaign_object_versions` when `can_access_campaign_header(campaign_header_id)`
- Writes unchanged (conversation owner + AI permissions / elevated persist after portal authz)

**Applied on:** Development Supabase (`hsxrewjcbvmbkqdlzjhs`) via `supabase db query --linked` (2026-07-27).  
**Not applied on Production.**

## Baseline snapshot refinement

Not required as a separate change: portal Approved Original and Campaign Actual/Remaining already resolve through `resolveApprovedBaselineData` + Engine projections. Revisit only if item-level snapshot fidelity gaps appear in QA.

## Tests

```bash
npm run test:media-plan-phase4
npm run test:media-plan-phase1
npm run test:media-plan-phase2
npm run test:media-plan-phase3
```
