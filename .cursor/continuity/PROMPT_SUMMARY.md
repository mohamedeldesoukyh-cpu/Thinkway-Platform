# Prompt Summary — Current Sprint

**Branch:** `develop` · Production `main`  
**Focus:** Creator Workspace secure self-registration/onboarding (A+B+C+D) on `develop`. Do not start Phase 3, social OAuth, on-behalf actions, or Production.

## Creator Workspace onboarding — ready for review

Normal path is no longer Internal creating a user and manually linking them.

Internal Creator Profile → Invite Creator → branded email → `/creator-invite?token=` → register or accept existing account → `auth.users` → `profiles` (influencer role) → `influencers.profile_id` → `/creator-portal`.

- Reuses `user_invites` (hashed HMAC token, 7-day expiry, single-use). Additive `influencer_id`. Resend rotates hash. Revoke supported.
- Public URL never includes `influencer_id`. Creator cannot pick a profile.
- New account: `auth.admin.createUser` with `email_confirm: true` (not public `signUp`, not `inviteUserByEmail`).
- Existing account: sign in, email must match, fail closed if staff/client or already linked to another creator.
- Manual **Linked user** remains recovery/cutover only.
- `requireCreatorScope` + `resolveWorkspaceActor` unchanged. Phase 2 documentation-unit isolation unchanged.

**Dev migration applied:** `supabase/migrations/20260830180000_creator_workspace_invites.sql` on Development (`hsxrewjcbvmbkqdlzjhs`). Not Production.

## Phase 2 still true

Creator Workspace uses documentation-unit SSOT. Social remains Available soon. No OAuth. No Phase 3 on-behalf attribution.

## Still true from earlier

- Internal `/vendors/[id]` is **Creator Profile**. Creator product is `/creator-portal` (4-nav: Home, Campaigns, Deliverables, Profile).
