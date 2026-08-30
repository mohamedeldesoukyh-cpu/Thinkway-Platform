import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { generateInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { isPublicPath, sanitizeNextPath } from "@/lib/auth/routes";
import { buildCreatorWorkspaceInviteEmail } from "@/lib/email/creator-workspace-invite-email";
import { classifyPagePath, classifyServerActionModule } from "@/lib/security/workspace-classify";
import { authorizeWorkspacePath } from "@/lib/security/workspace-auth";
import { resolveRateLimitCategory } from "@/lib/security/rate-limit-policy";
import {
  CREATOR_INVITE_CONFLICT_MESSAGE,
  CREATOR_INVITE_EMAIL_MISMATCH_MESSAGE,
  CREATOR_INVITE_STAFF_MESSAGE,
  CREATOR_WORKSPACE_ACCESS_LABEL,
  assertCreatorInviteAccountLinkable,
  creatorInviteHasExpired,
  creatorInviteIsConsumable,
  creatorInvitePublicPath,
  emailsMatchForInvite,
  projectCreatorWorkspaceAccessStatus,
} from "@/features/creator-workspace/onboarding";

const migration = readFileSync(
  resolve("supabase/migrations/20260830180000_creator_workspace_invites.sql"),
  "utf8"
);
const service = readFileSync(
  resolve("features/creator-workspace/onboarding-service.ts"),
  "utf8"
);
const publicActions = readFileSync(resolve("app/creator-invite/actions.ts"), "utf8");
const publicPage = readFileSync(resolve("app/creator-invite/page.tsx"), "utf8");
const activateForm = readFileSync(
  resolve("features/creator-workspace/components/creator-invite-activate-form.tsx"),
  "utf8"
);
const internalActions = readFileSync(
  resolve("features/vendors/creator-invite-actions.ts"),
  "utf8"
);
const accessPanel = readFileSync(
  resolve("features/vendors/components/creator-workspace-access-panel.tsx"),
  "utf8"
);
const recoveryForm = readFileSync(
  resolve("features/vendors/components/vendor-portal-access-form.tsx"),
  "utf8"
);
const portalLayout = readFileSync(
  resolve("app/(creator-portal)/layout.tsx"),
  "utf8"
);
const emailModule = readFileSync(
  resolve("lib/email/creator-workspace-invite-email.ts"),
  "utf8"
);
const phase2Actions = readFileSync(
  resolve("features/creator-workspace/actions.ts"),
  "utf8"
);

describe("Creator Workspace invitation contract", () => {
  it("extends user_invites additively and binds one pending invite per influencer", () => {
    assert.match(migration, /ALTER TABLE public\.user_invites/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS influencer_id/);
    assert.match(migration, /user_invites_one_pending_creator_invite/);
    assert.match(migration, /portal_type = 'creator'/);
    assert.match(migration, /status = 'invited'/);
    assert.doesNotMatch(migration, /CREATE TABLE/);
    assert.doesNotMatch(migration, /ienowhwfyxoqtzbgltno/);
  });

  it("stores hashed tokens only and never puts influencer_id in the public URL", () => {
    const raw = generateInviteToken();
    const hashed = hashInviteToken(raw);
    assert.notEqual(hashed, raw);
    assert.match(hashed, /^[a-f0-9]{64}$/);
    assert.equal(creatorInvitePublicPath(raw), `/creator-invite?token=${encodeURIComponent(raw)}`);
    assert.doesNotMatch(creatorInvitePublicPath(raw), /influencer/i);
    assert.match(service, /hashInviteToken/);
    assert.match(service, /token_hash/);
    assert.doesNotMatch(service, /inviteUserByEmail/);
    assert.doesNotMatch(publicActions, /inviteUserByEmail/);
    assert.doesNotMatch(service, /\.signUp\(/);
    assert.doesNotMatch(publicActions, /\.signUp\(/);
  });

  it("treats invites as single-use, expiring, and bound to one influencer", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    assert.equal(
      creatorInviteIsConsumable({
        status: "invited",
        portalType: "creator",
        influencerId: "inf-1",
        expiresAt: "2026-08-31T12:00:00.000Z",
        now,
      }),
      true
    );
    assert.equal(
      creatorInviteIsConsumable({
        status: "accepted",
        portalType: "creator",
        influencerId: "inf-1",
        expiresAt: "2026-08-31T12:00:00.000Z",
        now,
      }),
      false
    );
    assert.equal(
      creatorInviteIsConsumable({
        status: "revoked",
        portalType: "creator",
        influencerId: "inf-1",
        expiresAt: "2026-08-31T12:00:00.000Z",
        now,
      }),
      false
    );
    assert.equal(
      creatorInviteIsConsumable({
        status: "invited",
        portalType: "creator",
        influencerId: "inf-1",
        expiresAt: "2026-08-29T12:00:00.000Z",
        now,
      }),
      false
    );
    assert.equal(
      creatorInviteIsConsumable({
        status: "invited",
        portalType: "internal",
        influencerId: "inf-1",
        expiresAt: "2026-08-31T12:00:00.000Z",
        now,
      }),
      false
    );
    assert.equal(
      creatorInviteIsConsumable({
        status: "invited",
        portalType: "creator",
        influencerId: null,
        expiresAt: "2026-08-31T12:00:00.000Z",
        now,
      }),
      false
    );
    assert.equal(creatorInviteHasExpired("2026-08-30T12:00:00.000Z", now), true);
  });

  it("projects Internal Creator Workspace Access statuses", () => {
    assert.equal(CREATOR_WORKSPACE_ACCESS_LABEL.not_invited, "Not invited");
    assert.equal(CREATOR_WORKSPACE_ACCESS_LABEL.invitation_pending, "Invitation pending");
    assert.equal(CREATOR_WORKSPACE_ACCESS_LABEL.activated, "Activated");
    assert.equal(CREATOR_WORKSPACE_ACCESS_LABEL.revoked, "Revoked");
    assert.equal(CREATOR_WORKSPACE_ACCESS_LABEL.expired, "Expired");
    assert.equal(
      projectCreatorWorkspaceAccessStatus({
        profileId: "user-1",
        inviteStatus: "accepted",
        expiresAt: null,
      }),
      "activated"
    );
    assert.equal(
      projectCreatorWorkspaceAccessStatus({
        profileId: null,
        inviteStatus: "invited",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      "invitation_pending"
    );
    assert.equal(
      projectCreatorWorkspaceAccessStatus({
        profileId: null,
        inviteStatus: "revoked",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      "revoked"
    );
    assert.equal(
      projectCreatorWorkspaceAccessStatus({
        profileId: null,
        inviteStatus: "invited",
        expiresAt: "2000-01-01T00:00:00.000Z",
      }),
      "expired"
    );
    assert.equal(
      projectCreatorWorkspaceAccessStatus({
        profileId: null,
        inviteStatus: "accepted",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      "not_invited"
    );
    assert.equal(
      projectCreatorWorkspaceAccessStatus({
        profileId: null,
        inviteStatus: null,
        expiresAt: null,
      }),
      "not_invited"
    );
  });

  it("rotates the previous invitation on resend and revokes on send failure", () => {
    assert.match(service, /pendingCreatorInvite/);
    assert.match(service, /token_hash: tokenHash/);
    assert.match(service, /\.eq\("id", pending\.id\)/);
    assert.match(service, /send_failed: true/);
    assert.match(service, /status: "revoked"/);
    assert.match(internalActions, /createOrRotateCreatorInvite/);
    assert.match(internalActions, /resendCreatorWorkspaceInviteAction/);
    assert.match(internalActions, /revokeCreatorInvitation/);
    assert.doesNotMatch(internalActions, /activateUrl|inviteUrl|rawToken/);
  });
});

describe("Creator Workspace invitation security guards", () => {
  it("never lets the creator supply or substitute an influencer id", () => {
    assert.doesNotMatch(publicActions, /formData\.get\("influencer_id"\)/);
    assert.doesNotMatch(activateForm, /name="influencer_id"/);
    assert.doesNotMatch(publicPage, /influencer_id/);
    assert.match(service, /invite\.influencer_id/);
    assert.match(service, /linkInfluencerProfile\(db, invite\.influencer_id/);
    assert.match(service, /\.is\("profile_id", null\)/);
  });

  it("assigns influencer role after createUser and links only the invited profile", () => {
    assert.match(service, /email_confirm:\s*true/);
    assert.match(service, /auth\.admin\.createUser/);
    assert.match(service, /eq\("slug", "influencer"\)/);
    assert.match(service, /assignInfluencerRole/);
    const linkAt = service.indexOf("linkInfluencerProfile(db, invite.influencer_id");
    const roleAt = service.indexOf("assignInfluencerRole(db, userId)");
    const consumeAt = service.indexOf("consumeInvite(db, invite.id, userId)");
    assert.ok(linkAt > 0 && roleAt > linkAt && consumeAt > roleAt);
    assert.match(service, /handle_new_user|waitForProfile|viewer/);
    assert.match(service, /This email already has a Thinkway account/);
  });

  it("fail-closes duplicate, other-creator, staff, client, and email mismatch cases", () => {
    assert.equal(emailsMatchForInvite("A@Thinkway.com", "a@thinkway.com"), true);
    assert.equal(emailsMatchForInvite("a@thinkway.com", "b@thinkway.com"), false);

    const base = {
      authenticatedEmail: "creator@example.com",
      inviteEmail: "creator@example.com",
      inviteInfluencerId: "inf-1",
      roleSlug: "viewer",
      hasClientUser: false,
      linkedInfluencerId: null as string | null,
    };

    assert.equal(assertCreatorInviteAccountLinkable(base).ok, true);

    const mismatch = assertCreatorInviteAccountLinkable({
      ...base,
      authenticatedEmail: "other@example.com",
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.equal(mismatch.code, "email_mismatch");
      assert.equal(mismatch.message, CREATOR_INVITE_EMAIL_MISMATCH_MESSAGE);
    }

    const director = assertCreatorInviteAccountLinkable({
      ...base,
      roleSlug: "director",
    });
    assert.equal(director.ok, false);
    if (!director.ok) assert.equal(director.code, "staff_or_client");

    const influencerRole = assertCreatorInviteAccountLinkable({
      ...base,
      roleSlug: "influencer",
    });
    assert.equal(influencerRole.ok, true);

    const staff = assertCreatorInviteAccountLinkable({
      ...base,
      roleSlug: "admin",
    });
    assert.equal(staff.ok, false);
    if (!staff.ok) {
      assert.equal(staff.code, "staff_or_client");
      assert.equal(staff.message, CREATOR_INVITE_STAFF_MESSAGE);
    }

    const client = assertCreatorInviteAccountLinkable({
      ...base,
      hasClientUser: true,
    });
    assert.equal(client.ok, false);
    if (!client.ok) assert.equal(client.code, "staff_or_client");

    const other = assertCreatorInviteAccountLinkable({
      ...base,
      linkedInfluencerId: "inf-2",
    });
    assert.equal(other.ok, false);
    if (!other.ok) {
      assert.equal(other.code, "other_creator");
      assert.equal(other.message, CREATOR_INVITE_CONFLICT_MESSAGE);
    }

    const same = assertCreatorInviteAccountLinkable({
      ...base,
      linkedInfluencerId: "inf-1",
    });
    assert.equal(same.ok, true);
  });

  it("does not add social OAuth, public signup, or a second auth system", () => {
    for (const source of [service, publicActions, activateForm, publicPage, internalActions]) {
      assert.doesNotMatch(source, /signInWithOAuth/);
      assert.doesNotMatch(source, /signInWithIdToken/);
      assert.doesNotMatch(source, /Google|Facebook|Instagram|TikTok/);
      assert.doesNotMatch(source, /inviteUserByEmail/);
    }
    assert.match(publicActions, /signInWithPassword/);
    assert.match(publicActions, /resetPasswordForEmail/);
    assert.match(publicActions, /\/auth\/callback/);
    assert.doesNotMatch(accessPanel, /impersonat/i);
    assert.doesNotMatch(service, /impersonat/i);
  });

  it("keeps unactivated creators out of Creator Workspace data", () => {
    assert.match(portalLayout, /requireCreatorScope\("creator_portal.read"\)/);
    assert.match(phase2Actions, /requireCreatorScope/);
    assert.match(service, /\.is\("profile_id", null\)/);
    assert.match(service, /consumeInvite/);
  });

  it("keeps the manual linker as recovery and does not replace Phase 2 isolation", () => {
    assert.match(recoveryForm, /Linked user/);
    assert.match(recoveryForm, /Recovery and cutover only/);
    assert.match(recoveryForm, /setInfluencerProfileLinkAction/);
    assert.match(accessPanel, /Invite Creator/);
    assert.match(accessPanel, /Resend invitation/);
    assert.match(accessPanel, /Revoke invitation/);
    assert.match(accessPanel, /Revoke access/);
    assert.match(phase2Actions, /creatorOwnsDocumentationUnit/);
  });
});

describe("Creator Workspace invitation email, routes, and classification", () => {
  it("sends the branded invitation without campaign or fee data", () => {
    const built = buildCreatorWorkspaceInviteEmail({
      activateUrl: "https://dev.thinkwaymedia.com/creator-invite?token=secret",
    });
    assert.equal(built.subject, "You've been invited to Thinkway Creator Workspace");
    assert.match(built.html, /Activate Creator Workspace/);
    assert.match(built.plainText, /Activate Creator Workspace/);
    assert.match(built.html, /creator-invite\?token=secret/);
    assert.doesNotMatch(built.html, /TW-\d{4}-\d+|unit_cost|agreed_amount|creator fee/i);
    assert.doesNotMatch(built.plainText, /TW-\d{4}-\d+|unit_cost|agreed_amount|creator fee/i);
    assert.match(emailModule, /wrapThinkwayEmailDocument/);
    assert.match(service, /buildCreatorWorkspaceInviteEmail/);
    assert.match(service, /sendEmail/);
  });

  it("registers /creator-invite as a public auth surface and keeps the token on recovery redirects", () => {
    assert.equal(isPublicPath("/creator-invite"), true);
    assert.equal(classifyPagePath("/creator-invite"), "public");
    assert.equal(
      classifyServerActionModule("app/creator-invite/actions.ts"),
      "public"
    );
    assert.equal(
      classifyServerActionModule("features/creator-workspace/actions.ts"),
      "client_workspace"
    );
    assert.equal(authorizeWorkspacePath("/creator-invite", "anonymous").allowed, true);
    assert.equal(
      sanitizeNextPath("/creator-invite?token=abc"),
      "/creator-invite?token=abc"
    );
    assert.equal(
      resolveRateLimitCategory({
        pathname: "/creator-invite",
        method: "POST",
        isServerAction: true,
      }),
      "auth"
    );
    assert.match(publicActions, /redirect\("\/creator-portal"\)/);
  });
});
