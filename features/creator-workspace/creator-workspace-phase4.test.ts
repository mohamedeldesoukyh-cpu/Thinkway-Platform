import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const socialActions = readFileSync(
  resolve("features/creator-workspace/social-actions.ts"),
  "utf8"
);
const callback = readFileSync(
  resolve("app/api/creator-social/callback/route.ts"),
  "utf8"
);
const onBehalf = readFileSync(
  resolve("features/campaigns/actions/deliverable-on-behalf-actions.ts"),
  "utf8"
);
const creatorActions = readFileSync(
  resolve("features/creator-workspace/actions.ts"),
  "utf8"
);
const migration = readFileSync(
  resolve("supabase/migrations/20260830220000_creator_social_connections.sql"),
  "utf8"
);
const credentials = readFileSync(
  resolve("lib/creator-social/credentials/store.ts"),
  "utf8"
);
const accountsCard = readFileSync(
  resolve("features/creator-workspace/components/creator-social-accounts-card.tsx"),
  "utf8"
);
const homeSocial = readFileSync(
  resolve("features/creator-workspace/components/creator-social-available-soon.tsx"),
  "utf8"
);
const internalPanel = readFileSync(
  resolve("features/vendors/components/creator-social-connections-internal.tsx"),
  "utf8"
);
const profilePage = readFileSync(
  resolve("app/(creator-portal)/creator-portal/profile/page.tsx"),
  "utf8"
);
const nav = readFileSync(resolve("features/creator-workspace/nav.ts"), "utf8");
const processSync = readFileSync(
  resolve("lib/creator-social/sync/process.ts"),
  "utf8"
);
const queue = readFileSync(resolve("lib/creator-social/sync/queue.ts"), "utf8");
const service = readFileSync(
  resolve("lib/creator-social/connections/service.ts"),
  "utf8"
);

describe("Creator-only social authorization", () => {
  it("starts OAuth only for the authenticated creator_portal actor", () => {
    assert.match(socialActions, /requireCreatorScope\("creator_portal.write"\)/);
    assert.match(socialActions, /workspace\.kind !== "creator_portal"/);
    assert.doesNotMatch(socialActions, /influencerId:\s*input/);
    assert.doesNotMatch(socialActions, /input\.influencerId/);
    assert.match(socialActions, /createBoundOAuthState/);
  });

  it("blocks Internal and Client from initiating creator OAuth", () => {
    assert.doesNotMatch(onBehalf, /startCreatorSocialConnectAction/);
    assert.doesNotMatch(onBehalf, /createBoundOAuthState/);
    assert.doesNotMatch(internalPanel, /startCreatorSocialConnectAction/);
    assert.doesNotMatch(internalPanel, />\s*Connect\s*</);
    assert.match(internalPanel, /cannot approve OAuth/);
  });

  it("validates hashed, single-use, bound OAuth state on callback", () => {
    assert.match(callback, /consumeBoundOAuthState/);
    assert.match(callback, /access_denied/);
    assert.doesNotMatch(callback, /access_token/);
    assert.doesNotMatch(callback, /searchParams\.get\("influencer/);
  });
});

describe("Connection ownership and lifecycle", () => {
  it("prevents another creator from disconnecting or attaching the account", () => {
    assert.match(service, /You cannot change another creator's connection/);
    assert.match(
      service,
      /already connected to another creator/
    );
    assert.match(socialActions, /requireOwnedConnection/);
  });

  it("disconnects without deleting campaign publications or deliverables", () => {
    assert.match(service, /status: "disconnected"/);
    assert.match(service, /deleteConnectionCredentials/);
    assert.doesNotMatch(service, /\.from\("campaign_publications"\)\s*\.delete/);
    assert.doesNotMatch(service, /\.from\("assignment_deliverables"\)\s*\.delete/);
  });

  it("queues an idempotent initial sync and handles unrecoverable auth", () => {
    assert.match(callback, /enqueueCreatorSocialSync/);
    assert.match(queue, /jobId: creatorSocialSyncJobId/);
    assert.match(processSync, /token_expired/);
    assert.match(processSync, /rate_limit/);
    assert.match(processSync, /needs_attention/);
    assert.match(processSync, /disconnected/);
  });
});

describe("Token storage and UX", () => {
  it("stores ciphertext only and never exposes credentials in UI", () => {
    assert.match(credentials, /sealSecret/);
    assert.match(migration, /creator_social_credentials/);
    assert.match(migration, /REVOKE ALL ON public.creator_social_credentials/);
    assert.doesNotMatch(accountsCard, /ciphertext|accessToken|refresh_token/);
    assert.doesNotMatch(internalPanel, /ciphertext|accessToken/);
    assert.match(migration, /influencer_id IN/);
  });

  it("keeps Social Accounts on Profile without a new nav item or required copy", () => {
    assert.match(profilePage, /CreatorSocialAccountsCard/);
    assert.match(accountsCard, /Available soon/);
    assert.match(accountsCard, /Connect/);
    assert.match(homeSocial, /Available soon/);
    assert.doesNotMatch(nav, /Social/);
    assert.doesNotMatch(accountsCard, /Required|Mandatory|You must connect|incomplete/);
    assert.doesNotMatch(creatorActions, /startCreatorSocialConnectAction/);
  });
});
