# Unified Media Plan — Phase 4 Report (Client Portal Original)

**Branch:** `feature/unified-media-plan`  
**Date:** 2026-07-27

## Scope delivered

| Item | Detail |
|---|---|
| Route | `/client-portal/campaigns/[id]/media-plan` |
| Calendar | Shared `MediaPlanCalendar` with `editable={false}` |
| Data | **Current Approved Baseline only** (never Working Draft tip) |
| Loader | `features/portals/queries/load-client-media-plan.ts` |
| UI | `features/portals/components/client-media-plan-view.tsx` |
| Entry | Client campaigns table links campaign name → Media Plan |

## RLS (no new entities)

Migration `20260727120000_campaign_objects_client_portal_select.sql`:

- SELECT on `campaign_objects` / `campaign_object_versions` when `can_access_campaign_header(campaign_header_id)`
- Writes unchanged (conversation owner + AI permissions)

**Applied on:** Development Supabase (`hsxrewjcbvmbkqdlzjhs`) via `supabase db query --linked` (2026-07-27).  
**Not applied on Production.** Formal `db push` is blocked by older unapplied local migrations — resolve migration ordering before relying on push history.

## Empty states

- No linked campaign object → “No Media Plan is linked…”
- Linked but no approved baseline → “The Media Plan has not been approved yet…”

## Not in this slice (next)

- Portal **Approve** / **Request changes** actions (reuse Engine mutations; gate with `client_portal.approve`)
- Baseline item snapshot refinement when draft diverges from schedule meta

## Tests

```bash
npm run test:media-plan-phase4
```
