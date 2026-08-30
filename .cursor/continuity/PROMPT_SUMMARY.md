# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Creator Workspace 24-hour generated activation link on `develop`. Do not start Phase 3, social OAuth, or Production.

## Creator Workspace onboarding

One `user_invites` credential. 24-hour TTL. Generate Creator Link returns the URL once for copy (WhatsApp/SMS/email). Thinkway email uses the same token. Email failure does not revoke the link. Regeneration rotates the hash. Expired tokens show a dedicated expired page. After activation, Copy Login Link is `/login?next=/creator-portal` (no token).

Settings/internal/client invites remain 7 days. No new table. No Production migration.

## Phase 2 still true

Creator Workspace uses documentation-unit SSOT. Social remains Available soon. No OAuth. No Phase 3 on-behalf attribution.

## Still true from earlier

- Internal `/vendors/[id]` is **Creator Profile**. Creator product is `/creator-portal` (4-nav: Home, Campaigns, Deliverables, Profile).
