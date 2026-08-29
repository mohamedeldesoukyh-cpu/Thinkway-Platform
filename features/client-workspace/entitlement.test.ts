import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { emptyClientCampaignExecution } from "./campaign-execution";
import { emptyClientCampaignContent } from "./content-approval";
import {
  PACKAGE_TAB_ACCESS,
  applyEntitlementToView,
  applyTabOverrides,
  canStartLivePerformancePreview,
  clientWorkspaceEntitlementBlock,
  emptyClientCommercialSummary,
  entitlementForResolvedLegalEntity,
  entitlementPanelCopy,
  isClientWorkspaceSectionOpen,
  navSectionForWorkspaceSection,
  previewDaysRemaining,
  previewExpiresAtFromStart,
  requestedPackageForLockedSection,
  resolveClientWorkspaceEntitlement,
  unresolvedLegalEntityEntitlement,
  LIVE_PERFORMANCE_PREVIEW_DAYS,
} from "./entitlement";
import type { ClientWorkspaceView } from "./types";
import { persistClientWorkspaceEntitlementFields } from "@/features/clients/client-workspace-entitlement";

function record(
  overrides: Partial<Parameters<typeof resolveClientWorkspaceEntitlement>[0]> = {}
) {
  return {
    enabled: true,
    package: "planning" as const,
    tabOverrides: null,
    grandfathered: false,
    previewStartedAt: null,
    previewExpiresAt: null,
    previewPreviousPackage: null,
    ...overrides,
  };
}

test("Planning access maps Shortlist and Your Selection open and locks Commercial and Campaign", () => {
  const entitlement = resolveClientWorkspaceEntitlement(record({ package: "planning" }));
  assert.equal(entitlement.tabAccess.shortlist, "open");
  assert.equal(entitlement.tabAccess.creators, "open");
  assert.equal(entitlement.tabAccess.commercial, "locked");
  assert.equal(entitlement.tabAccess.approval, "locked");
  assert.equal(entitlement.tabAccess.overview, "open");
  assert.equal(entitlement.effectivePackage, "planning");
});

test("Commercial access opens Commercial and keeps Campaign locked", () => {
  const entitlement = resolveClientWorkspaceEntitlement(record({ package: "commercial" }));
  assert.equal(entitlement.tabAccess.commercial, "open");
  assert.equal(entitlement.tabAccess.approval, "locked");
});

test("Live access opens every Client Workspace tab", () => {
  assert.deepEqual(PACKAGE_TAB_ACCESS.live, {
    shortlist: "open",
    creators: "open",
    commercial: "open",
    approval: "open",
    overview: "open",
  });
  const entitlement = resolveClientWorkspaceEntitlement(record({ package: "live" }));
  assert.equal(entitlement.tabAccess.approval, "open");
  assert.equal(entitlement.preview, null);
});

test("custom tab overrides replace only the named sections", () => {
  const entitlement = resolveClientWorkspaceEntitlement(
    record({
      package: "planning",
      tabOverrides: { commercial: "open", approval: "locked" },
    })
  );
  assert.equal(entitlement.tabAccess.commercial, "open");
  assert.equal(entitlement.tabAccess.approval, "locked");
  assert.equal(entitlement.tabAccess.shortlist, "open");
});

test("applyTabOverrides does not hide tabs", () => {
  const access = applyTabOverrides(PACKAGE_TAB_ACCESS.live, { overview: "locked" });
  assert.equal(Object.keys(access).length, 5);
  assert.equal(access.overview, "locked");
});

test("disabled workspace is closed", () => {
  const entitlement = resolveClientWorkspaceEntitlement(record({ enabled: false, package: "live" }));
  assert.equal(entitlement.closed, true);
  assert.equal(entitlement.enabled, false);
  assert.equal(isClientWorkspaceSectionOpen(entitlement, "shortlist"), false);
});

test("new client default Off resolves as closed", () => {
  const entitlement = resolveClientWorkspaceEntitlement(null);
  assert.equal(entitlement.closed, true);
  assert.equal(entitlement.package, null);
});

test("orphan unlinked review does not fail-open to Live Performance", () => {
  const loaded = entitlementForResolvedLegalEntity(null, record({ package: "live", grandfathered: true }));
  assert.equal(loaded.clientId, null);
  assert.equal(loaded.entitlement.unresolvedLegalEntity, true);
  assert.equal(loaded.entitlement.closed, true);
  assert.equal(loaded.entitlement.enabled, false);
  assert.equal(loaded.entitlement.effectivePackage, null);
  assert.notEqual(loaded.entitlement.effectivePackage, "live");
  assert.equal(loaded.entitlement.package, null);
  assert.equal(loaded.entitlement.tabAccess.approval, "locked");
  assert.equal(loaded.entitlement.tabAccess.commercial, "locked");
  assert.equal(isClientWorkspaceSectionOpen(loaded.entitlement, "approval"), false);
  assert.equal(isClientWorkspaceSectionOpen(loaded.entitlement, "commercial"), false);
  assert.equal(isClientWorkspaceSectionOpen(loaded.entitlement, "shortlist"), false);
  const block = clientWorkspaceEntitlementBlock(loaded.clientId, loaded.entitlement);
  assert.equal(block?.code, "workspace_unavailable");
});

test("missing legal entity still blocks even if a Live entitlement object is supplied", () => {
  const live = resolveClientWorkspaceEntitlement(record({ package: "live" }));
  assert.equal(live.effectivePackage, "live");
  assert.equal(live.tabAccess.approval, "open");
  const block = clientWorkspaceEntitlementBlock(null, live);
  assert.equal(block?.code, "workspace_unavailable");
});

test("orphan review cannot receive Campaign or Commercial payloads", () => {
  const view = {
    commercial: {
      currency: "AED",
      creatorInvestment: 9000,
      totalInvestment: 12000,
      quotationTotal: 12000,
      lines: [{ label: "Creators", amount: 9000 }],
      selectedCount: 2,
      totalCount: 4,
    },
    quotation: { id: "q1" },
    clientEmails: ["a@example.com"],
    campaignExecution: { campaignHeaderId: "h1", posts: [{ id: "p1" }] },
    campaignContent: { campaignHeaderId: "h1", items: [{ assetId: "a1" }] },
    visibleSections: ["approval", "commercial"],
  } as unknown as ClientWorkspaceView;
  const stripped = applyEntitlementToView(view, unresolvedLegalEntityEntitlement());
  assert.deepEqual(stripped.campaignExecution, emptyClientCampaignExecution());
  assert.deepEqual(stripped.campaignContent, emptyClientCampaignContent());
  assert.deepEqual(stripped.commercial, emptyClientCommercialSummary("AED"));
  assert.equal(stripped.quotation, undefined);
  assert.deepEqual(stripped.clientEmails, []);
  assert.equal(stripped.entitlement?.effectivePackage, null);
  assert.notEqual(stripped.entitlement?.effectivePackage, "live");
});

test("Live Performance Preview lasts exactly 14 days and grants Live tabs", () => {
  const started = new Date("2026-08-29T12:00:00.000Z");
  const expires = previewExpiresAtFromStart(started);
  assert.equal((expires.getTime() - started.getTime()) / 86400000, LIVE_PERFORMANCE_PREVIEW_DAYS);
  const entitlement = resolveClientWorkspaceEntitlement(
    record({
      package: "planning",
      previewStartedAt: started.toISOString(),
      previewExpiresAt: expires.toISOString(),
      previewPreviousPackage: "planning",
    }),
    new Date("2026-08-30T12:00:00.000Z")
  );
  assert.equal(entitlement.preview?.active, true);
  assert.equal(entitlement.preview?.daysRemaining, 13);
  assert.equal(entitlement.effectivePackage, "live");
  assert.equal(entitlement.package, "planning");
  assert.equal(entitlement.tabAccess.approval, "open");
});

test("expired preview returns to the previous package and does not keep Campaign open", () => {
  const started = new Date("2026-08-01T00:00:00.000Z");
  const expires = previewExpiresAtFromStart(started);
  const entitlement = resolveClientWorkspaceEntitlement(
    record({
      package: "commercial",
      previewStartedAt: started.toISOString(),
      previewExpiresAt: expires.toISOString(),
      previewPreviousPackage: "commercial",
    }),
    new Date("2026-08-16T00:00:00.000Z")
  );
  assert.equal(entitlement.preview, null);
  assert.equal(entitlement.effectivePackage, "commercial");
  assert.equal(entitlement.tabAccess.approval, "locked");
  assert.equal(entitlement.tabAccess.commercial, "open");
});

test("grandfathered Live is not treated as a preview", () => {
  const started = new Date("2026-08-29T00:00:00.000Z");
  const entitlement = resolveClientWorkspaceEntitlement(
    record({
      package: "live",
      grandfathered: true,
      previewStartedAt: started.toISOString(),
      previewExpiresAt: previewExpiresAtFromStart(started).toISOString(),
      previewPreviousPackage: "planning",
    })
  );
  assert.equal(entitlement.grandfathered, true);
  assert.equal(entitlement.effectivePackage, "live");
  assert.equal(entitlement.preview, null);
  assert.equal(canStartLivePerformancePreview({ enabled: true, package: "live", previewActive: false }), false);
});

test("preview can start only for enabled Planning or Commercial", () => {
  assert.equal(canStartLivePerformancePreview({ enabled: true, package: "planning", previewActive: false }), true);
  assert.equal(canStartLivePerformancePreview({ enabled: true, package: "commercial", previewActive: false }), true);
  assert.equal(canStartLivePerformancePreview({ enabled: false, package: "planning", previewActive: false }), false);
  assert.equal(canStartLivePerformancePreview({ enabled: true, package: "planning", previewActive: true }), false);
});

test("previewDaysRemaining is zero at expiry", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");
  assert.equal(previewDaysRemaining(now, now), 0);
});

test("requested package for locked Campaign is Live Performance", () => {
  assert.equal(requestedPackageForLockedSection("approval"), "live");
  assert.equal(requestedPackageForLockedSection("commercial"), "commercial");
  assert.equal(navSectionForWorkspaceSection("quotation"), "commercial");
  assert.equal(navSectionForWorkspaceSection("commercial"), "commercial");
  assert.equal(navSectionForWorkspaceSection("approval"), "approval");
});

test("locked Campaign and Commercial panels name the package without pricing copy", () => {
  const campaign = entitlementPanelCopy("approval");
  assert.equal(campaign.title, "Live Performance");
  assert.equal(campaign.body.includes("USD"), false);
  assert.equal(/subscribe|upgrade|paywall/i.test(campaign.body), false);
  const commercial = entitlementPanelCopy("commercial");
  assert.equal(commercial.title, "Commercial");
  assert.equal(commercial.body.includes("USD"), false);
});

test("applyEntitlementToView strips Campaign and Commercial payloads when locked", () => {
  const view = {
    commercial: {
      currency: "AED",
      creatorInvestment: 9000,
      totalInvestment: 12000,
      quotationTotal: 12000,
      lines: [{ label: "Creators", amount: 9000 }],
      selectedCount: 2,
      totalCount: 4,
    },
    quotation: { id: "q1" },
    clientEmails: ["a@example.com"],
    campaignExecution: { campaignHeaderId: "h1", posts: [{ id: "p1" }] },
    campaignContent: { campaignHeaderId: "h1", items: [{ assetId: "a1" }] },
    visibleSections: ["shortlist"],
  } as unknown as ClientWorkspaceView;
  const stripped = applyEntitlementToView(
    view,
    resolveClientWorkspaceEntitlement(record({ package: "planning" }))
  );
  assert.deepEqual(stripped.campaignExecution, emptyClientCampaignExecution());
  assert.deepEqual(stripped.campaignContent, emptyClientCampaignContent());
  assert.deepEqual(stripped.commercial, emptyClientCommercialSummary("AED"));
  assert.equal(stripped.quotation, undefined);
  assert.deepEqual(stripped.clientEmails, []);
  assert.deepEqual(stripped.visibleSections, [
    "shortlist",
    "creators",
    "commercial",
    "approval",
    "overview",
  ]);
});

test("Live entitlement keeps Campaign payload", () => {
  const view = {
    commercial: emptyClientCommercialSummary("USD"),
    campaignExecution: { campaignHeaderId: "h1", posts: [] },
    campaignContent: { campaignHeaderId: "h1", items: [{ assetId: "a1" }] },
    visibleSections: [],
  } as unknown as ClientWorkspaceView;
  const kept = applyEntitlementToView(
    view,
    resolveClientWorkspaceEntitlement(record({ package: "live" }))
  );
  assert.equal(kept.campaignContent?.items.length, 1);
});

test("AM package save does not include price or billing fields", () => {
  const next = persistClientWorkspaceEntitlementFields({
    enabled: true,
    packageValue: "planning",
    overridesJson: "",
    previousPackage: "live",
    previousGrandfathered: true,
  });
  assert.equal(next.client_workspace_package, "planning");
  assert.equal(next.client_workspace_grandfathered, false);
  assert.equal("price" in next || "stripe" in next, false);
});

test("pending access requests are unique per review and section", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20260829190000_client_workspace_entitlements.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /client_workspace_access_requests_pending_uniq/);
  assert.match(sql, /UNIQUE INDEX[\s\S]*review_id, section_id[\s\S]*WHERE status = 'pending'/);
  assert.match(sql, /Does not change entitlement or bill/);
});
