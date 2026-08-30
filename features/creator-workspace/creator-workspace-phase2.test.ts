import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { projectClientCampaignContent } from "@/features/client-workspace/content-approval";
import { overlayCreatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-card-model";
import { buildCreatorDocumentationUnitsFromSlots } from "@/features/creator-workspace/slots";
import {
  projectCreatorUnitStatus,
  unitExpectsPublicationUrl,
} from "@/features/creator-workspace/unit-status";
import {
  isVersionReleasedToClient,
  versionReleaseMetadata,
} from "@/lib/services/deliverables/client-release";

const migration = readFileSync(
  resolve("supabase/migrations/20260830120000_creator_documentation_unit_access.sql"),
  "utf8"
);
const creatorActions = readFileSync(
  resolve("features/creator-workspace/actions.ts"),
  "utf8"
);
const deliverablesPage = readFileSync(
  resolve("app/(creator-portal)/creator-portal/deliverables/page.tsx"),
  "utf8"
);
const campaignDetailPage = readFileSync(
  resolve("app/(creator-portal)/creator-portal/campaigns/[id]/page.tsx"),
  "utf8"
);
const portalActions = readFileSync(resolve("features/portals/actions.ts"), "utf8");
const documentationService = readFileSync(
  resolve("lib/services/deliverables/documentation-service.ts"),
  "utf8"
);
const documentationLoad = readFileSync(
  resolve("features/creator-workspace/documentation-load.ts"),
  "utf8"
);
const homePage = readFileSync(
  resolve("app/(creator-portal)/creator-portal/page.tsx"),
  "utf8"
);
const internalComplete = readFileSync(
  resolve("features/campaigns/actions/deliverable-documentation-actions.ts"),
  "utf8"
);
const socialUi = readFileSync(
  resolve("features/creator-workspace/components/creator-social-available-soon.tsx"),
  "utf8"
);

describe("Creator documentation-unit access contract", () => {
  it("scopes list and ownership to the signed-in influencer without campaigns.write", () => {
    assert.match(migration, /creator_owns_documentation_unit/);
    assert.match(migration, /creator_list_documentation_slots/);
    assert.match(migration, /creator_line_belongs_to_current_influencer/);
    assert.match(migration, /has_permission\('creator_portal.read'\)/);
    assert.doesNotMatch(migration, /GRANT EXECUTE[^\n]*campaigns\.(read|write)/);
    assert.match(migration, /Omits commercial columns/);
    assert.doesNotMatch(migration, /unit_cost|revenue_before_vat|gp_/);
  });

  it("does not grant an entire campaign because the creator belongs to it", () => {
    assert.match(migration, /creator_line_belongs_to_current_influencer\(ad\.campaign_line_id\)/);
    assert.doesNotMatch(migration, /can_access_campaign_header/);
  });

  it("keeps different creators on the same campaign isolated", () => {
    assert.match(
      migration,
      /ci\.influencer_id = public\.current_creator_influencer_id\(\)/
    );
    assert.match(
      migration,
      /cl\.metadata #>> '\{influencer_assignment,influencer_id\}'/
    );
    assert.match(migration, /AND ps\.assignment_deliverable_id = p_assignment_deliverable_id/);
  });
});

describe("Creator unit status is a projection, not a new enum", () => {
  it("keeps unreleased uploads out of Client language", () => {
    assert.equal(
      projectCreatorUnitStatus({
        received: true,
        releasedToClient: false,
        clientDecision: "changes_requested",
        postStatus: null,
        hasPublicationUrl: false,
        publicationStatus: null,
      }),
      "uploaded"
    );
  });

  it("shows Client changes only after release", () => {
    assert.equal(
      projectCreatorUnitStatus({
        received: true,
        releasedToClient: true,
        clientDecision: "changes_requested",
        postStatus: null,
        hasPublicationUrl: false,
        publicationStatus: null,
      }),
      "changes_requested"
    );
  });

  it("treats a live URL as published", () => {
    assert.equal(
      projectCreatorUnitStatus({
        received: true,
        releasedToClient: true,
        clientDecision: "approved",
        postStatus: "scheduled",
        hasPublicationUrl: true,
        publicationStatus: "published",
      }),
      "published"
    );
  });

  it("does not expect a publication URL for stories", () => {
    assert.equal(unitExpectsPublicationUrl("instagram_story"), false);
    assert.equal(unitExpectsPublicationUrl("instagram_reel"), true);
  });
});

describe("Multiple posts stay independent", () => {
  it("splits qty>1 posts into separate unit keys", () => {
    const units = buildCreatorDocumentationUnitsFromSlots([
      {
        campaignHeaderId: "camp-1",
        campaignName: "Summer",
        campaignDocumentNumber: "TW-1",
        campaignLineId: "line-1",
        assignmentDeliverableId: "del-1",
        assignmentPostScheduleId: "post-1",
        sequenceNumber: 1,
        quantity: 2,
        deliverableType: "instagram_reel",
        platform: "instagram",
        dueDate: "2026-09-01",
        postStatus: "draft",
      },
      {
        campaignHeaderId: "camp-1",
        campaignName: "Summer",
        campaignDocumentNumber: "TW-1",
        campaignLineId: "line-1",
        assignmentDeliverableId: "del-1",
        assignmentPostScheduleId: "post-2",
        sequenceNumber: 2,
        quantity: 2,
        deliverableType: "instagram_reel",
        platform: "instagram",
        dueDate: "2026-09-02",
        postStatus: "draft",
      },
    ]);
    assert.equal(units.length, 2);
    assert.equal(units[0]?.unitKey, "p:post-1");
    assert.equal(units[1]?.unitKey, "p:post-2");
    assert.notEqual(units[0]?.unitKey, units[1]?.unitKey);
  });

  it("keeps qty=1 on the deliverable grain even if a post row exists", () => {
    const units = buildCreatorDocumentationUnitsFromSlots([
      {
        campaignHeaderId: "camp-1",
        campaignName: "Summer",
        campaignDocumentNumber: "TW-1",
        campaignLineId: "line-1",
        assignmentDeliverableId: "del-1",
        assignmentPostScheduleId: "post-1",
        sequenceNumber: 1,
        quantity: 1,
        deliverableType: "instagram_reel",
        platform: "instagram",
        dueDate: "2026-09-01",
        postStatus: "draft",
      },
    ]);
    assert.equal(units.length, 1);
    assert.equal(units[0]?.unitKey, "d:del-1");
    assert.equal(units[0]?.assignmentPostScheduleId, null);
  });
});

describe("Client release boundary", () => {
  it("marks Internal uploads released and creator uploads unreleased", () => {
    assert.equal(isVersionReleasedToClient(versionReleaseMetadata(true)), true);
    assert.equal(isVersionReleasedToClient(versionReleaseMetadata(false)), false);
  });

  it("hides unreleased versions from Client projection", () => {
    const projected = projectClientCampaignContent({
      campaignHeaderId: "hdr-1",
      assets: [
        {
          id: "asset-1",
          campaignHeaderId: "hdr-1",
          assignmentDeliverableId: "del-1",
          assignmentPostScheduleId: null,
          assetType: "draft_video",
          medium: "file",
          label: "Reel",
          currentVersionId: "v-new",
          archivedAt: null,
        },
      ],
      versions: [
        {
          id: "v-old",
          assetId: "asset-1",
          versionNumber: 1,
          storageBucket: "deliverable-assets",
          storagePath: "a.mp4",
          externalUrl: null,
          mimeType: "video/mp4",
          fileName: "a.mp4",
          uploadedAt: "2026-08-01T00:00:00.000Z",
          releasedToClientAt: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "v-new",
          assetId: "asset-1",
          versionNumber: 2,
          storageBucket: "deliverable-assets",
          storagePath: "b.mp4",
          externalUrl: null,
          mimeType: "video/mp4",
          fileName: "b.mp4",
          uploadedAt: "2026-08-30T00:00:00.000Z",
          releasedToClientAt: null,
        },
      ],
      decisions: [],
      creatorNameByDeliverableId: { "del-1": "Amina" },
      platformByDeliverableId: { "del-1": "instagram" },
      deliverableTypeByDeliverableId: { "del-1": "instagram_reel" },
    });
    assert.equal(projected.items.length, 1);
    assert.equal(projected.items[0]?.versionId, "v-old");
  });
});

describe("Legacy creator upload is not the product path", () => {
  it("does not mount creatorUploadDeliverableAction on Deliverables or campaign detail", () => {
    assert.doesNotMatch(deliverablesPage, /creatorUploadDeliverableAction/);
    assert.doesNotMatch(deliverablesPage, /getCreatorDeliverables/);
    assert.doesNotMatch(campaignDetailPage, /CreatorDeliverableRowPanel/);
    assert.doesNotMatch(campaignDetailPage, /creatorUploadDeliverableAction/);
    assert.match(deliverablesPage, /loadCreatorUnitViews/);
  });

  it("keeps the legacy action unused by the new documentation actions", () => {
    assert.doesNotMatch(creatorActions, /creatorUploadDeliverableAction/);
    assert.doesNotMatch(creatorActions, /portal_uploads/);
    assert.doesNotMatch(creatorActions, /saveCampaignScriptForUnit/);
    assert.match(creatorActions, /releaseToClient: false/);
    assert.match(creatorActions, /audience: "creator"/);
    assert.match(portalActions, /@deprecated Phase 2 product path/);
  });
});

describe("Creator script is read-only and unit-scoped", () => {
  it("loads the existing unit script and never writes one", () => {
    assert.match(creatorActions, /loadCampaignScriptForUnit/);
    assert.match(creatorActions, /createCampaignScriptOriginalSignedUrlForUnit/);
    assert.doesNotMatch(creatorActions, /saveCampaignScriptForUnit/);
    assert.doesNotMatch(creatorActions, /upsertCampaignScript/);
  });
});

describe("Creator upload uses documentation-service versioning", () => {
  it("creates the asset/version on the owned unit and leaves it unreleased", () => {
    assert.match(creatorActions, /beginFileAssetUpload/);
    assert.match(creatorActions, /completeFileAssetUpload/);
    assert.match(creatorActions, /releaseToClient: false/);
    assert.match(documentationService, /function beginFileAssetUpload[\s\S]*loadOwnedAsset/);
    assert.match(documentationService, /function completeFileAssetUpload[\s\S]*loadOwnedAsset/);
    assert.match(documentationService, /function createSignedAssetDownloadUrl[\s\S]*loadOwnedAsset/);
  });

  it("does not auto-release Internal complete uploads as creator uploads", () => {
    const completeFn = internalComplete.slice(
      internalComplete.indexOf("export async function completeDeliverableFileUploadAction"),
      internalComplete.indexOf("export async function getDeliverableAssetDownloadUrlAction")
    );
    assert.doesNotMatch(completeFn, /releaseToClient:\s*false/);
    assert.match(internalComplete, /releaseDeliverableVersionToClientAction/);
    assert.match(documentationService, /releaseDeliverableAssetVersionToClient/);
  });
});

describe("Creator comments and publication stay on the owned unit", () => {
  it("loads only creator-audience comments and skips internal events", () => {
    assert.match(documentationLoad, /commentAudience: "creator"/);
    assert.match(documentationLoad, /includeEvents: false/);
    assert.match(documentationLoad, /row\.audience === "creator"/);
  });

  it("submits publication against the owned deliverable and influencer", () => {
    assert.match(creatorActions, /linkDocumentationUnitToPublication/);
    assert.match(creatorActions, /influencer_id: access\.scoped\.scope\.influencerId/);
    assert.match(creatorActions, /assignment_deliverable_id: input\.assignmentDeliverableId/);
    assert.doesNotMatch(creatorActions, /from\("campaign_publications_creator/);
  });
});

describe("Home next actions use documentation units", () => {
  it("does not read legacy deliverable status on Home", () => {
    assert.match(homePage, /loadCreatorUnitViews/);
    assert.match(homePage, /buildCreatorHomeNextActions/);
    assert.doesNotMatch(homePage, /getCreatorDeliverables/);
  });

  it("overlays campaign card counts from unit status, not the legacy table", () => {
    const overlaid = overlayCreatorCampaignUnitCounts(
      [
        {
          campaign_header_id: "camp-1",
          campaign_document_number: "TW-1",
          campaign_name: "Summer",
          assignment_id: "asg-1",
          assignment_status: "confirmed",
          agreed_amount: 1,
          currency_code: "USD",
          vendor_payment_status: "pending",
          start_date: null,
          end_date: null,
          vendor_io_status: "approved",
          deliverable_total: 9,
          pending_deliverables: 9,
          publication_total: 0,
          recent_publication_status: null,
        },
      ],
      [
        { campaignHeaderId: "camp-1", status: "to_do" },
        { campaignHeaderId: "camp-1", status: "uploaded" },
      ]
    );
    assert.equal(overlaid[0]?.deliverable_total, 2);
    assert.equal(overlaid[0]?.pending_deliverables, 1);
  });
});

describe("Phase 2 does not add social OAuth or a new SSOT", () => {
  it("keeps Social as available soon", () => {
    assert.match(socialUi, /Available soon/);
    assert.doesNotMatch(creatorActions, /oauth/i);
    assert.doesNotMatch(socialUi, /oauth/i);
  });

  it("does not introduce creator-specific documentation tables", () => {
    assert.doesNotMatch(migration, /CREATE TABLE/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.creator_list_documentation_slots/);
  });
});
