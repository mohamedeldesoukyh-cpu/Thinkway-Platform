import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { projectClientCampaignContent } from "@/features/client-workspace/content-approval";
import { CREATOR_ON_BEHALF_SUBMITTED_LABEL } from "@/lib/services/deliverables/on-behalf";

const onBehalfActions = readFileSync(
  resolve("features/campaigns/actions/deliverable-on-behalf-actions.ts"),
  "utf8"
);
const internalComplete = readFileSync(
  resolve("features/campaigns/actions/deliverable-documentation-actions.ts"),
  "utf8"
);
const creatorActions = readFileSync(
  resolve("features/creator-workspace/actions.ts"),
  "utf8"
);
const documentationService = readFileSync(
  resolve("lib/services/deliverables/documentation-service.ts"),
  "utf8"
);
const documentationLoad = readFileSync(
  resolve("features/creator-workspace/documentation-load.ts"),
  "utf8"
);
const creatorCard = readFileSync(
  resolve("features/creator-workspace/components/creator-documentation-unit-card.tsx"),
  "utf8"
);
const internalTab = readFileSync(
  resolve("features/campaigns/components/tabs/campaign-deliverables-documentation-tab.tsx"),
  "utf8"
);
const onBehalfModule = readFileSync(
  resolve("lib/services/deliverables/on-behalf.ts"),
  "utf8"
);
const socialUi = readFileSync(
  resolve("features/creator-workspace/components/creator-social-available-soon.tsx"),
  "utf8"
);
const vendorIoPage = readFileSync(
  resolve("app/io-approval/vendor/page.tsx"),
  "utf8"
);
const creatorNav = readFileSync(
  resolve("features/creator-workspace/nav.ts"),
  "utf8"
);
const phase2Migration = readFileSync(
  resolve("supabase/migrations/20260830120000_creator_documentation_unit_access.sql"),
  "utf8"
);

describe("Internal on-behalf uses the same documentation SSOT", () => {
  it("completes on-behalf uploads through the existing asset/version service", () => {
    assert.match(onBehalfActions, /completeFileAssetUpload/);
    assert.match(onBehalfActions, /addExternalLinkAsset/);
    assert.match(onBehalfActions, /addTextAsset/);
    assert.match(onBehalfActions, /linkDocumentationUnitToPublication/);
    assert.match(creatorActions, /completeFileAssetUpload/);
    assert.match(documentationLoad, /getDocumentationUnitDetail/);
    assert.doesNotMatch(onBehalfActions, /CREATE TABLE/);
    assert.doesNotMatch(onBehalfModule, /CREATE TABLE/);
  });

  it("keeps on-behalf uploads unreleased until explicit Internal release", () => {
    assert.match(onBehalfActions, /completeDeliverableOnBehalfUploadAction[\s\S]*releaseToClient:\s*false/);
    assert.match(documentationService, /const releaseToClient = input\.onBehalf \? false : input\.releaseToClient !== false/);
    const completeFn = internalComplete.slice(
      internalComplete.indexOf("export async function completeDeliverableFileUploadAction"),
      internalComplete.indexOf("export async function getDeliverableAssetDownloadUrlAction")
    );
    assert.doesNotMatch(completeFn, /releaseToClient:\s*false/);
    assert.match(internalTab, /ReleaseVersionToClientButton/);
  });

  it("hides unreleased on-behalf versions from Client until Internal releases them", () => {
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
          label: "Reel 2",
          currentVersionId: "v-on-behalf",
          archivedAt: null,
        },
      ],
      versions: [
        {
          id: "v-on-behalf",
          assetId: "asset-1",
          versionNumber: 2,
          storageBucket: "deliverable-assets",
          storagePath: "on-behalf.mp4",
          externalUrl: null,
          mimeType: "video/mp4",
          fileName: "on-behalf.mp4",
          uploadedAt: "2026-08-30T00:00:00.000Z",
          releasedToClientAt: null,
        },
      ],
      decisions: [],
      creatorNameByDeliverableId: { "del-1": "Amina" },
      platformByDeliverableId: { "del-1": "instagram" },
      deliverableTypeByDeliverableId: { "del-1": "instagram_reel" },
    });
    assert.equal(projected.items.length, 0);

    const afterRelease = projectClientCampaignContent({
      campaignHeaderId: "hdr-1",
      assets: [
        {
          id: "asset-1",
          campaignHeaderId: "hdr-1",
          assignmentDeliverableId: "del-1",
          assignmentPostScheduleId: null,
          assetType: "draft_video",
          medium: "file",
          label: "Reel 2",
          currentVersionId: "v-on-behalf",
          archivedAt: null,
        },
      ],
      versions: [
        {
          id: "v-on-behalf",
          assetId: "asset-1",
          versionNumber: 2,
          storageBucket: "deliverable-assets",
          storagePath: "on-behalf.mp4",
          externalUrl: null,
          mimeType: "video/mp4",
          fileName: "on-behalf.mp4",
          uploadedAt: "2026-08-30T00:00:00.000Z",
          releasedToClientAt: "2026-08-30T12:00:00.000Z",
        },
      ],
      decisions: [],
      creatorNameByDeliverableId: { "del-1": "Amina" },
      platformByDeliverableId: { "del-1": "instagram" },
      deliverableTypeByDeliverableId: { "del-1": "instagram_reel" },
    });
    assert.equal(afterRelease.items.length, 1);
    assert.equal(afterRelease.items[0]?.versionId, "v-on-behalf");
  });
});

describe("On-behalf authorization and scoping", () => {
  it("requires existing Internal campaign write permission and blocks portal actors", () => {
    assert.match(onBehalfActions, /requirePermission\(supabase, "campaigns.write"\)/);
    assert.match(onBehalfActions, /isPortalActor/);
    assert.match(onBehalfActions, /ON_BEHALF_INTERNAL_ONLY_MESSAGE/);
    assert.doesNotMatch(creatorActions, /deliverable-on-behalf-actions/);
    assert.doesNotMatch(creatorActions, /completeDeliverableOnBehalfUploadAction/);
  });

  it("derives the assigned creator from Internal records instead of client input", () => {
    assert.match(onBehalfActions, /resolveAssignedInfluencerId/);
    assert.match(onBehalfActions, /from\("campaign_influencers"\)/);
    assert.doesNotMatch(onBehalfActions, /input\.influencerId/);
    assert.doesNotMatch(onBehalfActions, /influencer_id:\s*input\./);
    assert.match(
      onBehalfActions,
      /influencer_id:\s*access\.attribution\.influencerId/
    );
  });

  it("keeps another creator from seeing the unit through existing scoped RPCs", () => {
    assert.match(documentationLoad, /creator_list_documentation_slots/);
    assert.match(documentationLoad, /creator_owns_documentation_unit/);
    assert.match(
      phase2Migration,
      /ci\.influencer_id = public\.current_creator_influencer_id\(\)/
    );
    assert.match(creatorActions, /requireCreatorScope/);
    assert.match(creatorActions, /creatorOwnsDocumentationUnit/);
  });
});

describe("On-behalf attribution and Creator Workspace display", () => {
  it("preserves Internal actor, creator, unit, asset/version, and timestamp on existing events", () => {
    assert.match(onBehalfModule, /on_behalf_actor_user_id/);
    assert.match(onBehalfModule, /on_behalf_of_influencer_id/);
    assert.match(documentationService, /onBehalfMetadata\(input\.onBehalf\)/);
    assert.match(documentationService, /onBehalfEventPayload\(input\.onBehalf\)/);
    assert.match(documentationService, /actor_user_id: input\.actorUserId/);
    assert.match(documentationService, /version_id: input\.versionId/);
    assert.match(onBehalfActions, /onBehalfKindForVersionNumber\(input\.versionNumber\)/);
  });

  it("shows creator-facing Thinkway copy without Internal staff details", () => {
    assert.match(creatorCard, /unit\.onBehalfLabel/);
    assert.match(creatorCard, /versionNumber=\{unit\.currentVersionNumber\}/);
    assert.match(documentationLoad, /onBehalfLabel: current\?\.onBehalfLabel/);
    assert.match(onBehalfModule, /Submitted by Thinkway on your behalf/);
    assert.equal(CREATOR_ON_BEHALF_SUBMITTED_LABEL.includes("Thinkway"), true);
    assert.doesNotMatch(creatorCard, /on_behalf_actor_user_id|actorUserId/);
    assert.match(internalTab, /Upload on behalf of creator/);
  });
});

describe("On-behalf comments, publication, versioning, and exclusions", () => {
  it("keeps creator-audience notes separate from Internal-only comments", () => {
    assert.match(onBehalfActions, /addDeliverableOnBehalfCreatorNoteAction/);
    assert.match(onBehalfActions, /audience: "creator"/);
    assert.match(onBehalfActions, /actorDisplayName: CREATOR_ON_BEHALF_ACTOR_LABEL/);
    assert.match(internalComplete, /audience: "internal"/);
    assert.match(documentationLoad, /commentAudience: "creator"/);
    assert.match(documentationLoad, /row\.audience === "creator"/);
    assert.match(internalTab, /Visible to creator/);
  });

  it("scopes publication evidence to the server-derived unit and influencer", () => {
    assert.match(onBehalfActions, /submitDeliverableOnBehalfPublicationAction/);
    assert.match(onBehalfActions, /from\("campaign_publications"\)/);
    assert.match(
      onBehalfActions,
      /assignment_deliverable_id: input\.assignmentDeliverableId/
    );
    assert.match(
      onBehalfActions,
      /influencer_id:\s*access\.attribution\.influencerId/
    );
    assert.match(documentationLoad, /from\("campaign_publications"\)/);
  });

  it("appends versions and refuses silent overwrite of a newer version", () => {
    assert.match(documentationService, /assertVersionNumberAvailable/);
    assert.match(documentationService, /isDocumentationVersionConflict/);
    assert.match(documentationService, /DOCUMENTATION_VERSION_CONFLICT_MESSAGE/);
    assert.match(
      documentationService,
      /\.from\("deliverable_asset_versions"\)[\s\S]{0,120}\.insert/
    );
    assert.match(internalTab, /History:/);
  });

  it("does not accept IO or legal consent on behalf of the creator", () => {
    assert.doesNotMatch(onBehalfActions, /vendor_io|io-approval|acceptVendor|legal consent/i);
    assert.match(vendorIoPage, /completeVendorIoApprovalByToken/);
    assert.doesNotMatch(onBehalfActions, /io-approval\/vendor/);
  });

  it("does not start social OAuth or a new Creator Workspace route", () => {
    assert.doesNotMatch(onBehalfActions, /oauth|signInWithOAuth/i);
    assert.match(socialUi, /Available soon/);
    assert.doesNotMatch(creatorNav, /on-behalf|onBehalf/);
    assert.doesNotMatch(onBehalfActions, /revalidatePath\("\/creator-workspace/);
  });
});
