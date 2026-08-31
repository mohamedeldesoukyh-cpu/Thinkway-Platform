# Prompt Summary — Current Sprint

**Branch:** `develop` (`675201bd`) · Production `main` (`81683f01`)  
**Focus:** Creator Workspace is live on Production (app + schema).

## Production release (2026-08-31)

- Merge: `release: ship Creator Workspace to Production [deploy-production]` (`81683f01`)
- Host: https://app.thinkwaymedia.com · deploy `dpl_4GxX8snnBqP1CFsF4BcELZoJa8tQ`
- `/api/version`: `gitSha` `81683f01` · Supabase `ienowhwfyxoqtzbgltno` aligned
- Production DB applied to `ienowhwfyxoqtzbgltno`: documentation-unit RPCs, `user_invites.influencer_id`, creator self-select on `influencers`, social connection tables. Backfilled `released_to_client_at` on 10 existing asset versions.

## Creator Workspace (shipped)

Chrome is `CreatorWorkspaceShell` (white top bar + sticky Home · Campaigns · Deliverables · Calendar · Payments · Profile). Client Portal is unchanged. Campaign tabs are local state (instant). Calendar events come only from deliverable due dates and campaign start/end. Payment is an informational strip on Home, not a next action.

## Client Workspace share controls (already on Production)

`/campaigns`, Shortlists, and Client Quotations share the same Client link cell. Stop keeps the journey token.

## Phase 5 still true

`lib/creator-insights/` is not ECI. Social remains optional.
