import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPortalNavActive } from "@/components/layout/portal-nav";
import {
  campaignCreatorActionLine,
  campaignNeedsCreatorAction,
  campaignPublicationLine,
  toCreatorCampaignCard,
} from "@/features/creator-workspace/campaign-card-model";
import { resolveCreatorWorkspaceName } from "@/features/creator-workspace/identity";
import { creatorFacingStatusLabel } from "@/features/creator-workspace/unit-status";
import {
  buildCreatorHomeNextActions,
  creatorFirstName,
} from "@/features/creator-workspace/home-next-actions";
import {
  CREATOR_WORKSPACE_NAV_ITEMS,
  resolveCreatorWorkspaceLegacyRedirect,
  withCreatorHomeBadge,
} from "@/features/creator-workspace/nav";
import { CREATOR_WORKSPACE_SOCIAL_PLATFORMS } from "@/features/creator-workspace/social-availability";
import type {
  CreatorCampaignRow,
  CreatorPaymentRow,
  CreatorVendorIoRow,
} from "@/features/portals/types";
import { authorizeWorkspacePath, portalHomePath } from "@/lib/security/workspace-auth";

function campaign(overrides: Partial<CreatorCampaignRow> = {}): CreatorCampaignRow {
  return {
    campaign_header_id: "camp-1",
    campaign_document_number: "TW-2026-0001",
    campaign_name: "Summer launch",
    campaign_status: "active",
    assignment_id: "asg-1",
    assignment_status: "confirmed",
    agreed_amount: 1000,
    currency_code: "USD",
    vendor_payment_status: "pending",
    start_date: "2026-06-01",
    end_date: "2026-07-01",
    vendor_io_status: "approved",
    deliverable_total: 3,
    pending_deliverables: 0,
    completed_deliverables: 0,
    approved_deliverables: 0,
    published_deliverables: 0,
    publication_total: 0,
    recent_publication_status: null,
    ...overrides,
  };
}

function vendorIo(overrides: Partial<CreatorVendorIoRow> = {}): CreatorVendorIoRow {
  return {
    id: "vio-1",
    assignment_id: "asg-1",
    campaign_header_id: "camp-1",
    campaign_name: "Summer launch",
    amount: 1000,
    currency_code: "USD",
    status: "sent",
    sent_at: "2026-08-01T00:00:00.000Z",
    approved_at: null,
    rejection_reason: null,
    ...overrides,
  };
}

function payment(overrides: Partial<CreatorPaymentRow> = {}): CreatorPaymentRow {
  return {
    assignment_id: "asg-1",
    campaign_header_id: "camp-1",
    campaign_name: "Summer launch",
    agreed_amount: 1000,
    invoiced_amount: 0,
    paid_amount: 0,
    pending_amount: 1000,
    payment_status: "Pending",
    vendor_payment_status: "pending",
    currency_code: "USD",
    ...overrides,
  };
}

describe("Creator Workspace Phase 1 chrome", () => {
  it("keeps a single /creator-portal home and a 5-item nav", () => {
    assert.equal(portalHomePath("creator_portal"), "/creator-portal");
    assert.deepEqual(
      CREATOR_WORKSPACE_NAV_ITEMS.map((item) => item.label),
      ["Home", "Campaigns", "Deliverables", "Payments", "Profile"]
    );
    assert.equal(CREATOR_WORKSPACE_NAV_ITEMS.length, 5);
    const hrefs = CREATOR_WORKSPACE_NAV_ITEMS.map((item) => item.href);
    assert.equal(hrefs.includes("/creator-portal/payments"), true);
    assert.equal(hrefs.includes("/creator-portal/publications"), false);
    assert.equal(hrefs.includes("/creator-portal/vendor-ios"), false);
    assert.equal(hrefs.includes("/creator-portal/notifications"), false);
  });

  it("redirects former top-level routes into the workspace", () => {
    assert.equal(resolveCreatorWorkspaceLegacyRedirect("/creator-portal/payments"), null);
    assert.equal(
      resolveCreatorWorkspaceLegacyRedirect("/creator-portal/publications"),
      "/creator-portal/campaigns"
    );
    assert.equal(
      resolveCreatorWorkspaceLegacyRedirect("/creator-portal/vendor-ios"),
      "/creator-portal"
    );
    assert.equal(
      resolveCreatorWorkspaceLegacyRedirect("/creator-portal/notifications"),
      "/creator-portal"
    );
    assert.equal(resolveCreatorWorkspaceLegacyRedirect("/creator-portal/campaigns"), null);
  });

  it("still authorizes legacy creator-portal paths so bookmarks cut over", () => {
    for (const path of [
      "/creator-portal",
      "/creator-portal/campaigns",
      "/creator-portal/deliverables",
      "/creator-portal/profile",
      "/creator-portal/payments",
      "/creator-portal/publications",
      "/creator-portal/vendor-ios",
      "/creator-portal/notifications",
    ]) {
      assert.equal(
        authorizeWorkspacePath(path, "creator_portal").allowed,
        true,
        path
      );
    }
  });

  it("badges Home — not a Notifications nav item — when unread > 0", () => {
    const items = withCreatorHomeBadge(3);
    assert.equal(items[0]?.label, "Home");
    assert.equal(items[0]?.badge, 3);
    assert.equal(
      items.some((item) => item.label === "Notifications"),
      false
    );
  });

  it("treats Home as exact-path active so campaign pages do not highlight Home", () => {
    assert.equal(isPortalNavActive("/creator-portal", "/creator-portal"), true);
    assert.equal(isPortalNavActive("/creator-portal/campaigns", "/creator-portal"), false);
    assert.equal(
      isPortalNavActive("/creator-portal/campaigns/abc", "/creator-portal/campaigns"),
      true
    );
  });

  it("lists social platforms as available soon without requiring connection", () => {
    assert.ok(CREATOR_WORKSPACE_SOCIAL_PLATFORMS.includes("Instagram"));
    assert.ok(CREATOR_WORKSPACE_SOCIAL_PLATFORMS.includes("TikTok"));
    assert.ok(CREATOR_WORKSPACE_SOCIAL_PLATFORMS.includes("YouTube"));
    assert.equal(CREATOR_WORKSPACE_SOCIAL_PLATFORMS.length >= 8, true);
  });
});

describe("Creator Workspace Home next actions", () => {
  const unit = (overrides: Partial<Parameters<typeof Object.assign>[1]> = {}) => ({
    unitKey: "d:del-1",
    campaignHeaderId: "camp-1",
    campaignName: "Summer launch",
    label: "Reel",
    status: "to_do" as const,
    dueDate: null,
    hasScript: false,
    expectsPublicationUrl: true,
    publicationUrl: null,
    ...overrides,
  });

  it("prioritizes vendor IO review before deliverables and payments", () => {
    const actions = buildCreatorHomeNextActions({
      vendorIos: [vendorIo()],
      units: [unit()],
      payments: [payment()],
    });
    assert.deepEqual(
      actions.map((action) => action.kind),
      ["vendor_io", "deliverable", "payment"]
    );
    assert.equal(actions[0]?.title, "Review your agreement");
    assert.equal(actions[0]?.href, "/creator-portal/campaigns/camp-1?tab=agreement");
    assert.equal(actions[0]?.vendorIoId, "vio-1");
    assert.equal(actions[2]?.href, "/creator-portal/payments");
  });

  it("groups multiple pending documentation units onto the Deliverables page", () => {
    const actions = buildCreatorHomeNextActions({
      vendorIos: [],
      units: [
        unit({ unitKey: "d:1", label: "Reel" }),
        unit({ unitKey: "d:2", label: "Story" }),
      ],
      payments: [],
    });
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.title, "Complete 2 deliverables");
    assert.equal(actions[0]?.href, "/creator-portal/deliverables");
  });

  it("surfaces change requests ahead of ordinary submissions", () => {
    const actions = buildCreatorHomeNextActions({
      vendorIos: [],
      units: [
        unit({ unitKey: "d:1" }),
        unit({
          unitKey: "d:2",
          status: "changes_requested",
          label: "Need changes",
        }),
      ],
      payments: [],
    });
    assert.equal(actions[0]?.title, "1 submission needs changes");
    assert.equal(actions[0]?.priority < actions[1]!.priority, true);
  });

  it("does not create next actions when operational queues are clear", () => {
    const actions = buildCreatorHomeNextActions({
      vendorIos: [vendorIo({ status: "approved" })],
      units: [unit({ status: "published" })],
      payments: [payment({ payment_status: "Paid" })],
    });
    assert.deepEqual(actions, []);
  });

  it("uses the first name for greeting copy", () => {
    assert.equal(creatorFirstName("Amira Hassan"), "Amira");
    assert.equal(creatorFirstName(""), "there");
    assert.equal(creatorFirstName("Thinkway"), "there");
  });
});

describe("Creator Workspace identity", () => {
  it("does not greet the creator as the agency brand name", () => {
    assert.equal(
      resolveCreatorWorkspaceName({
        influencerDisplayName: "Thinkway",
        profileFullName: "Aya Hassan",
        email: "aya@example.com",
      }),
      "Aya Hassan"
    );
    assert.equal(
      resolveCreatorWorkspaceName({
        influencerDisplayName: "Thinkway Media",
        profileFullName: null,
        email: "creator.one@example.com",
      }),
      "creator.one"
    );
    assert.equal(
      resolveCreatorWorkspaceName({
        influencerDisplayName: "Nour Ali",
        profileFullName: "Thinkway",
        email: "nour@example.com",
      }),
      "Nour Ali"
    );
  });

  it("labels approved content as ready to publish until a URL exists", () => {
    assert.equal(
      creatorFacingStatusLabel({
        status: "approved",
        expectsPublicationUrl: true,
        publicationUrl: null,
      }),
      "Ready to publish"
    );
    assert.equal(
      creatorFacingStatusLabel({ status: "to_do" }),
      "Needs submission"
    );
  });
});

describe("Creator Workspace campaign cards", () => {
  it("asks the creator to review an unaccepted agreement first", () => {
    const row = campaign({ vendor_io_status: "sent", pending_deliverables: 2 });
    assert.equal(campaignNeedsCreatorAction(row), true);
    assert.equal(campaignCreatorActionLine(row), "Review your agreement");
  });

  it("shows a deliverable action line when the agreement is already accepted", () => {
    const row = campaign({ pending_deliverables: 2, deliverable_total: 3 });
    assert.equal(campaignCreatorActionLine(row), "2 of 3 deliverables need action");
    const card = toCreatorCampaignCard(row);
    assert.equal(card.href, "/creator-portal/campaigns/camp-1");
    assert.equal(card.needsAction, true);
  });

  it("keeps publications visible on the card without a top-level Publications tab", () => {
    const row = campaign({
      publication_total: 2,
      recent_publication_status: "live",
    });
    assert.equal(campaignNeedsCreatorAction(row), false);
    assert.equal(campaignCreatorActionLine(row), "All on track");
    assert.equal(campaignPublicationLine(row), "2 publications · live");
  });
});
