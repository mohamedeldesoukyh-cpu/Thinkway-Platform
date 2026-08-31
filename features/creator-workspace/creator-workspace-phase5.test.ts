import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { CREATOR_WORKSPACE_NAV_ITEMS } from "@/features/creator-workspace/nav";
import { CREATOR_ON_BEHALF_ACTOR_LABEL } from "@/lib/services/deliverables/on-behalf";

const service = readFileSync(resolve("lib/creator-insights/service.ts"), "utf8");
const load = readFileSync(resolve("lib/creator-insights/load.ts"), "utf8");
const assemble = readFileSync(resolve("lib/creator-insights/assemble.ts"), "utf8");
const home = readFileSync(resolve("app/(creator-portal)/creator-portal/page.tsx"), "utf8");
const nav = readFileSync(resolve("features/creator-workspace/nav.ts"), "utf8");
const unitCard = readFileSync(
  resolve("features/creator-workspace/components/creator-documentation-unit-card.tsx"),
  "utf8"
);
const internalPanel = readFileSync(
  resolve("features/vendors/components/creator-social-connections-internal.tsx"),
  "utf8"
);
const onBehalf = readFileSync(
  resolve("features/campaigns/actions/deliverable-on-behalf-actions.ts"),
  "utf8"
);
const clientWorkspacePage = readFileSync(
  resolve("app/(client-portal)/client-portal/page.tsx"),
  "utf8"
);
const homeInsights = readFileSync(
  resolve("features/creator-workspace/components/creator-home-insights.tsx"),
  "utf8"
);
const processSync = readFileSync(resolve("lib/creator-social/sync/process.ts"), "utf8");
const connections = readFileSync(
  resolve("lib/creator-social/connections/service.ts"),
  "utf8"
);

describe("Phase 5 Creator Workspace UX", () => {
  it("keeps Home · Campaigns · Deliverables · Calendar · Payments · Profile", () => {
    assert.deepEqual(
      CREATOR_WORKSPACE_NAV_ITEMS.map((item) => item.label),
      ["Home", "Campaigns", "Deliverables", "Calendar", "Payments", "Profile"]
    );
    assert.doesNotMatch(nav, /Insights|Analytics|Recommendations/);
    assert.doesNotMatch(home, /Payment in progress/);
    assert.match(home, /CreatorHomeNextActionList/);
    assert.match(home, /Open calendar/);
    assert.match(home, /Thinkway processes this/);
  });

  it("does not turn Home into a BI dashboard or chatbot", () => {
    assert.doesNotMatch(homeInsights, /chatbot|OpenAI recommends|AI recommends/i);
    assert.doesNotMatch(home, /Level 0|Level 1|Level 2/);
    assert.match(homeInsights, /Profile → Social Accounts|Social Accounts/);
    const layout = readFileSync(resolve("app/(creator-portal)/layout.tsx"), "utf8");
    assert.match(layout, /CreatorWorkspaceShell/);
    assert.doesNotMatch(layout, /navVariant="compact"/);
    assert.doesNotMatch(layout, /client-review-ref/);
  });
});

describe("Phase 5 security and ownership", () => {
  it("derives creator insight ownership from requireCreatorScope, not a client-supplied id", () => {
    assert.match(service, /requireCreatorScope\("creator_portal.read"\)/);
    assert.match(service, /influencerId: scope\.influencerId/);
    assert.doesNotMatch(service, /loadOwnCreatorInsightPack\(\s*influencerId/);
    assert.match(assemble, /row\.influencerId === input\.influencerId/);
    assert.match(load, /\.eq\("influencer_id", influencerId\)/);
  });

  it("requires Internal influencers.read and never lets Internal connect OAuth", () => {
    assert.match(service, /requirePermission\(supabase, "influencers.read"\)/);
    assert.doesNotMatch(internalPanel, />\s*Connect\s*</);
    assert.doesNotMatch(internalPanel, /startCreatorSocialConnectAction/);
    assert.doesNotMatch(internalPanel, /ciphertext|access_token|refresh_token/);
    assert.match(internalPanel, /Performance snapshot/);
    assert.match(internalPanel, /cannot approve OAuth/);
  });

  it("does not expose creator intelligence to Client Workspace", () => {
    assert.doesNotMatch(clientWorkspacePage, /creator-insights|Thinkway Insights/);
    assert.doesNotMatch(clientWorkspacePage, /loadOwnCreatorInsightPack/);
  });
});

describe("Phase 5 compatibility", () => {
  it("keeps on-behalf attribution and does not create a second publication path", () => {
    assert.equal(CREATOR_ON_BEHALF_ACTOR_LABEL.includes("Thinkway"), true);
    assert.match(unitCard, /onBehalfLabel/);
    assert.doesNotMatch(onBehalf, /creator_social_insights/);
    assert.match(load, /assignment_deliverable_id/);
  });

  it("invalidates cached recommendations after social sync without duplicating insight rows", () => {
    assert.match(processSync, /invalidateCreatorInsightCache/);
    assert.match(connections, /invalidateCreatorInsightCache/);
    assert.match(connections, /creator_social_insights/);
    assert.doesNotMatch(load, /from\("creator_insight_recommendations"\)/);
  });

  it("does not select commercial fields for creator-facing intelligence", () => {
    assert.doesNotMatch(load, /cost|cpm|gp|client_budget|agreed_amount/);
  });
});
