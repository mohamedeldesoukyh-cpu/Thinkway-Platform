# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Creator Workspace Phase 2 complete — stop for review. Do not start Phase 3, social OAuth, or Production.

## Phase 2 (documentation-unit operational work) — ready for review

Creator Workspace (`/creator-portal`) now uses the existing documentation-unit SSOT (same as Internal Deliverables and Client Workspace). Legacy `deliverables` / `portal_uploads` / `creatorUploadDeliverableAction` is no longer the product path.

- Units listed via SECURITY DEFINER RPCs (`creator_list_documentation_slots`, `creator_owns_documentation_unit`). No `campaigns.write`. No campaign-wide leak.
- Upload/script/publication/comments go through existing documentation-service + `loadCampaignScriptForUnit` (read-only). Creator uploads set `releaseToClient: false`.
- Client only sees versions with `deliverable_asset_versions.metadata.released_to_client_at`. Internal can **Release to Client**.
- Status is a presentation projection (To do / Uploaded / Under review / Changes requested / Approved / Scheduled / Published).
- Home next-actions and campaign-card counts overlay from units, not legacy `deliverables.status`.
- Social remains Available soon. No OAuth. No Phase 3 on-behalf attribution.

**Dev migration applied:** `supabase/migrations/20260830120000_creator_documentation_unit_access.sql` on Development (`hsxrewjcbvmbkqdlzjhs`). Not Production.

## Still true from earlier

- `/campaigns` Client link: Active (pulse + View) / Off / None, plus **toggle** to activate and **Stop** to revoke.
- List View reveals an existing share URL; toggle On can mint a link. Stop turns the live review off without rotating the journey token; Activate restores that same `/review/{id}?sign=` address.
- Stopped client links open a dimmed workspace with “This workspace link has expired” and **Request access** (email to traffic@thinkwaymedia.com).
- Internal `/vendors/[id]` is **Creator Profile**. Creator product is `/creator-portal` (4-nav: Home, Campaigns, Deliverables, Profile).
