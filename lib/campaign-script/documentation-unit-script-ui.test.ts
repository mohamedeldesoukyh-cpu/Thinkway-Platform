import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  attachedScriptPresenceFromRows,
  campaignScriptDownloadFileName,
  campaignScriptDownloadText,
  clientPostDocumentationScriptUnit,
  documentationScriptTargetFromUnit,
  documentationUnitCanHoldScript,
  documentationUnitScriptActionLabels,
  isLegacyUnattachedCampaignScript,
} from "./documentation-unit-ui";
import { campaignScriptUnitKey } from "./unit";

const HEADER = "11111111-1111-4111-8111-111111111111";
const DELIVERABLE_REEL = "22222222-2222-4222-8222-222222222222";
const DELIVERABLE_STORY = "33333333-3333-4333-8333-333333333333";
const POST_STORY_1 = "44444444-4444-4444-8444-444444444444";
const POST_STORY_2 = "55555555-5555-4555-8555-555555555555";

test("qty=1 maps to the deliverable documentation unit", () => {
  const target = documentationScriptTargetFromUnit({
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL,
    assignmentPostScheduleId: null,
    quantity: 1,
  });
  assert.equal("ok" in target, false);
  if ("ok" in target) return;
  assert.equal(target.grain, "qty1");
  assert.equal(target.assignmentDeliverableId, DELIVERABLE_REEL);
  assert.equal(target.assignmentPostScheduleId, null);
  assert.equal(target.unitKey, campaignScriptUnitKey(DELIVERABLE_REEL, null));
  assert.equal(target.unitKey.startsWith("d:"), true);
});

test("qty>1 maps to the individual post unit", () => {
  const target = documentationScriptTargetFromUnit({
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_STORY,
    assignmentPostScheduleId: POST_STORY_1,
    quantity: 3,
  });
  assert.equal("ok" in target, false);
  if ("ok" in target) return;
  assert.equal(target.grain, "qty_n");
  assert.equal(target.assignmentPostScheduleId, POST_STORY_1);
  assert.equal(target.unitKey, campaignScriptUnitKey(DELIVERABLE_STORY, POST_STORY_1));
  assert.equal(target.unitKey.startsWith("p:"), true);
});

test("multiple scripts for the same creator stay on independent unit keys", () => {
  const reel = documentationScriptTargetFromUnit({
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL,
    assignmentPostScheduleId: null,
    quantity: 1,
  });
  const story = documentationScriptTargetFromUnit({
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_STORY,
    assignmentPostScheduleId: POST_STORY_2,
    quantity: 2,
  });
  assert.equal("ok" in reel || "ok" in story, false);
  if ("ok" in reel || "ok" in story) return;
  assert.notEqual(reel.unitKey, story.unitKey);
});

test("presence mapping ignores leftover campaign-level scripts", () => {
  const presence = attachedScriptPresenceFromRows([
    {
      id: "legacy",
      assignment_deliverable_id: null,
      assignment_post_schedule_id: null,
    },
    {
      id: "reel-script",
      assignment_deliverable_id: DELIVERABLE_REEL,
      assignment_post_schedule_id: null,
    },
    {
      id: "story-script",
      assignment_deliverable_id: DELIVERABLE_STORY,
      assignment_post_schedule_id: POST_STORY_1,
    },
  ]);
  assert.equal(presence.has(campaignScriptUnitKey(DELIVERABLE_REEL, null)), true);
  assert.equal(presence.get(campaignScriptUnitKey(DELIVERABLE_STORY, POST_STORY_1)), "story-script");
  assert.equal(presence.size, 2);
  assert.equal([...presence.values()].includes("legacy"), false);
  assert.equal(
    isLegacyUnattachedCampaignScript({
      assignmentDeliverableId: null,
      assignmentPostScheduleId: null,
    }),
    true
  );
});

test("empty units show Add/Upload; existing units show Script/Preview", () => {
  assert.deepEqual(documentationUnitScriptActionLabels(false), {
    primary: "Add script",
    secondary: "Upload script",
  });
  assert.deepEqual(documentationUnitScriptActionLabels(true), {
    primary: "Open script",
    secondary: "Preview",
  });
  assert.equal(
    documentationUnitCanHoldScript({ quantity: 2, assignmentPostScheduleId: null }),
    false
  );

  const actions = readFileSync(
    resolve("features/campaigns/components/script/documentation-unit-script-actions.tsx"),
    "utf8"
  );
  assert.match(actions, /PaperclipIcon/);
  assert.match(actions, /EyeIcon/);
  assert.match(actions, /PencilIcon/);
  assert.match(actions, /FileUpIcon/);
  assert.match(actions, /documentationUnitScriptActionLabels/);
  assert.match(actions, /CLIENT_ICON_BUTTON_CLASS = "cx-script-btn"/);
  assert.equal(actions.includes("Add Script"), false);
  assert.equal(actions.includes('className="btn px-1.5"'), false);
});

test("Client publication-plan rows map to documentation units without leftover campaign scripts", () => {
  const reel = clientPostDocumentationScriptUnit({
    assignmentDeliverableId: DELIVERABLE_REEL,
    assignmentPostScheduleId: null,
    quantity: 1,
  });
  const story = clientPostDocumentationScriptUnit({
    assignmentDeliverableId: DELIVERABLE_STORY,
    assignmentPostScheduleId: POST_STORY_1,
    quantity: 3,
  });
  const leftoverQtyN = clientPostDocumentationScriptUnit({
    assignmentDeliverableId: DELIVERABLE_STORY,
    assignmentPostScheduleId: null,
    quantity: 3,
  });
  const roster = clientPostDocumentationScriptUnit({
    assignmentDeliverableId: null,
    quantity: 1,
  });
  assert.equal(reel?.unitKey, campaignScriptUnitKey(DELIVERABLE_REEL, null));
  assert.equal(story?.unitKey, campaignScriptUnitKey(DELIVERABLE_STORY, POST_STORY_1));
  assert.equal(leftoverQtyN, null);
  assert.equal(roster, null);
});

test("download uses the selected unit language text, not deliverable assets", () => {
  const en = campaignScriptDownloadText({
    bodyEn: "Reel 1 English",
    bodyAr: "ريل واحد",
    language: "en",
  });
  const ar = campaignScriptDownloadText({
    bodyEn: "Reel 1 English",
    bodyAr: "ريل واحد",
    language: "ar",
  });
  assert.equal(en.ok && ar.ok, true);
  if (!en.ok || !ar.ok) return;
  assert.equal(en.text, "Reel 1 English");
  assert.equal(ar.text, "ريل واحد");
  assert.equal(campaignScriptDownloadFileName("Instagram reel #1", "en"), "instagram-reel-1-en.txt");
  const empty = campaignScriptDownloadText({ bodyEn: "", bodyAr: "", language: "ar" });
  assert.equal(empty.ok, false);
});

test("Documentation UI opens a unit sheet and never loads the leftover campaign script", () => {
  const tab = readFileSync(
    resolve("features/campaigns/components/tabs/campaign-deliverables-documentation-tab.tsx"),
    "utf8"
  );
  const list = readFileSync(
    resolve("features/campaigns/components/deliverables/documentation-repository-list.tsx"),
    "utf8"
  );
  const sheet = readFileSync(
    resolve("features/campaigns/components/script/documentation-unit-script-sheet.tsx"),
    "utf8"
  );
  const actions = readFileSync(
    resolve("features/campaigns/actions/campaign-script-actions.ts"),
    "utf8"
  );
  const deliverablesTab = readFileSync(
    resolve("features/campaigns/components/tabs/campaign-deliverables-tab.tsx"),
    "utf8"
  );

  assert.match(tab, /DocumentationUnitScriptActions/);
  assert.match(tab, /DocumentationUnitScriptSheet/);
  assert.match(tab, /listCampaignScriptPresenceAction/);
  assert.equal(tab.includes("loadCampaignScriptAction"), false);
  assert.equal(tab.includes("loadCampaignScriptMaster"), false);
  assert.equal(tab.includes("CampaignScriptRegister"), false);

  assert.match(list, /DocumentationUnitScriptActions/);
  assert.match(list, /hasOriginalDocument/);
  assert.match(list, /campaignId/);
  assert.match(list, /onOpenScript/);

  assert.match(sheet, /loadCampaignScriptForUnitAction/);
  assert.match(sheet, /saveCampaignScriptForUnitAction/);
  assert.match(sheet, /translateCampaignScriptForUnitAction/);
  assert.match(sheet, /originalFile/);
  assert.match(sheet, /pendingOriginalFileRef/);
  assert.match(sheet, /Translate to Arabic/);
  assert.match(sheet, /Translate to English/);
  assert.match(sheet, /campaignScriptDownloadText/);
  assert.equal(sheet.includes("loadCampaignScriptMaster"), false);
  assert.equal(sheet.includes("loadCampaignScriptAction("), false);
  assert.equal(sheet.includes("campaign_script_assignments"), false);
  assert.equal(sheet.includes("deliverable_assets"), false);

  assert.match(actions, /export async function saveCampaignScriptForUnitAction/);
  assert.match(actions, /saveCampaignScriptForUnit\(/);
  assert.match(actions, /loadCampaignScriptForUnit\(/);
  assert.match(actions, /getCampaignScriptOriginalDocumentUrlAction/);
  assert.match(actions, /createCampaignScriptOriginalSignedUrlForUnit/);
  assert.match(actions, /originalFile/);
  const unitSave = actions.slice(actions.indexOf("saveCampaignScriptForUnitAction"));
  assert.equal(unitSave.includes("saveCampaignScriptMaster("), false);

  const originalButton = readFileSync(
    resolve("features/campaigns/components/script/documentation-unit-original-document-button.tsx"),
    "utf8"
  );
  assert.match(originalButton, /getCampaignScriptOriginalDocumentUrlAction/);
  assert.match(originalButton, /getClientCampaignScriptOriginalDocumentUrlAction/);
  assert.match(originalButton, /Preview/);
  assert.match(originalButton, /Download/);
  assert.match(originalButton, /aria-label=\{`Original \$\{documentKindLabel\} document/);
  assert.match(originalButton, /data-original-document-kind/);
  assert.match(originalButton, /campaignScriptOriginalDocumentKind/);
  assert.match(originalButton, /campaignScriptOriginalDocumentIconUrl/);
  assert.match(originalButton, /className="cx-script-btn"/);
  assert.equal(originalButton.includes('className="btn px-1.5"'), false);
  assert.equal(originalButton.includes("FileTextIcon"), false);
  assert.equal(originalButton.includes('kind === "word" ? "W"'), false);

  const originalIcons = readFileSync(
    resolve("lib/campaign-script/original-document.ts"),
    "utf8"
  );
  assert.match(originalIcons, /\/file-type-icons\/\$\{kind\}\.svg/);

  assert.equal(deliverablesTab.includes("CampaignScriptRegister"), false);
  assert.equal(deliverablesTab.includes("campaign-script-register"), false);
});

test("Client UI attaches Script to publication-plan units and hides campaign-level Script", () => {
  const dashboard = readFileSync(
    resolve("features/client-workspace/components/campaign-dashboard.tsx"),
    "utf8"
  );
  const approval = readFileSync(
    resolve("features/client-workspace/components/approval-workspace.tsx"),
    "utf8"
  );
  const plan = readFileSync(
    resolve("features/client-workspace/components/campaign-publication-plan.tsx"),
    "utf8"
  );
  const clientActions = readFileSync(
    resolve("features/client-workspace/actions/campaign-script-actions.ts"),
    "utf8"
  );
  const sheet = readFileSync(
    resolve("features/campaigns/components/script/documentation-unit-script-sheet.tsx"),
    "utf8"
  );

  assert.equal(dashboard.includes("CampaignScriptSection"), false);
  assert.equal(approval.includes("CampaignScriptSection"), false);
  assert.equal(dashboard.includes("loadClientCampaignScriptAction"), false);
  assert.equal(plan.includes("CampaignPublicationPlan"), true);
  assert.match(plan, /DocumentationUnitScriptActions/);
  assert.match(plan, /DocumentationUnitScriptSheet/);
  assert.match(plan, /listClientCampaignScriptPresenceAction/);
  assert.match(plan, /hasOriginalDocument/);
  assert.match(plan, /surface="client"/);
  assert.match(plan, /cx-dlv/);
  assert.match(plan, /cx-hide-sm/);
  assert.equal(plan.includes("loadCampaignScriptMaster"), false);
  assert.equal(plan.includes("loadClientCampaignScriptAction"), false);
  assert.equal(plan.includes("campaign_script_assignments"), false);
  assert.equal(plan.includes("Script Library"), false);

  assert.match(clientActions, /export async function saveClientCampaignScriptForUnitAction/);
  assert.match(clientActions, /saveCampaignScriptForUnit\(/);
  assert.match(clientActions, /loadCampaignScriptForUnit\(/);
  assert.match(clientActions, /listAttachedCampaignScriptPresence\(/);
  assert.match(clientActions, /getClientCampaignScriptOriginalDocumentUrlAction/);
  assert.match(clientActions, /createCampaignScriptOriginalSignedUrlForUnit/);
  assert.match(clientActions, /actorKind: "client"/);
  assert.equal(clientActions.includes("saveCampaignScriptMaster("), false);
  assert.equal(clientActions.includes("loadCampaignScriptMaster("), false);
  assert.equal(clientActions.includes("campaign_script_assignments"), false);

  assert.match(sheet, /loadClientCampaignScriptForUnitAction/);
  assert.match(sheet, /saveClientCampaignScriptForUnitAction/);
  assert.match(sheet, /translateClientCampaignScriptForUnitAction/);
  assert.match(sheet, /surface\?: "internal" \| "client"/);
});

test("Campaign tab script actions stay compact on mobile", () => {
  const css = readFileSync(
    resolve("features/client-workspace/styles/client-review-ref.css"),
    "utf8"
  );
  assert.match(css, /\.cx-script-btn\{/);
  assert.match(css, /min-height:32px/);
  assert.match(css, /\.cx-hide-sm\{display:none/);
  assert.match(css, /\.cx-dlv\{\s*flex-direction:\s*column/);
  assert.match(css, /\.cx-kid td:first-child\{padding-left:28px\}/);
  assert.match(css, /min-height:36px/);
});
