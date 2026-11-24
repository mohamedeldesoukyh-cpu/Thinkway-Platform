import assert from "node:assert/strict";
import test from "node:test";
import { applyWorkspaceTabVisibility, parseHiddenWorkspaceTabs } from "./tab-visibility";
import { applyEntitlementToView, isClientWorkspaceSectionOpen, resolveClientWorkspaceEntitlement } from "./entitlement";
import { defaultClientWorkspaceSection, isRenderableClientWorkspaceSection, resolveClientWorkspaceSection } from "./visible-sections";
import type { ClientWorkspaceView } from "./types";

const live = () => resolveClientWorkspaceEntitlement({ enabled: true, package: "live", tabOverrides: null, grandfathered: false, previewStartedAt: null, previewExpiresAt: null, previewPreviousPackage: null });

test("hidden commercial blocks the quotation alias without changing other access", () => {
  const original = live();
  const controlled = applyWorkspaceTabVisibility(original, ["commercial"]);
  assert.equal(isClientWorkspaceSectionOpen(controlled, "quotation"), false);
  assert.equal(isClientWorkspaceSectionOpen(controlled, "approval"), true);
  assert.equal(original.tabAccess.commercial, "open");
});

test("showing tabs cannot grant a locked entitlement", () => {
  const limited = { ...live(), tabAccess: { ...live().tabAccess, approval: "locked" as const } };
  assert.equal(isClientWorkspaceSectionOpen(applyWorkspaceTabVisibility(limited, []), "approval"), false);
});

test("hidden pricing is removed from serialized snapshots, creator cards and approvals", () => {
  const view = {
    commercial: { currency: "AED", totalInvestment: 76543, lines: [{ amount: 76543 }] },
    review: { sourceSnapshot: { creators: [{ creatorId: "a", investmentAmount: 76543 }], quotation: { lines: [{ amount: 76543 }] }, commercial: { currency: "AED", totalInvestment: 76543 } }, approvedCommercial: { totalInvestment: 76543 } },
    creators: [{ creatorId: "a", investmentAmount: 76543, agencyFeeAmount: 76543, originalInvestmentAmount: 76543 }],
    mediaPlanSummary: { cpm: 76543, creatorForecasts: { a: { cpe: 76543 } } },
    visibleSections: ["shortlist", "commercial"],
  } as unknown as ClientWorkspaceView;
  const result = applyEntitlementToView(view, applyWorkspaceTabVisibility(live(), ["commercial", "shortlist"]));
  assert.equal(JSON.stringify(result).includes("76543"), false);
  assert.equal(isRenderableClientWorkspaceSection(resolveClientWorkspaceSection("quotation"), result.visibleSections), false);
  assert.equal(defaultClientWorkspaceSection(result.visibleSections), "creators");
  assert.equal(view.creators[0].investmentAmount, 76543);
});

test("stored tab settings are normalized and deduplicated", () => {
  assert.deepEqual(parseHiddenWorkspaceTabs(["commercial", "commercial", "invalid"]), ["commercial"]);
  assert.deepEqual(parseHiddenWorkspaceTabs(null), []);
});
