import { documentationSlotTitle } from "@/lib/services/deliverables/documentation-list-groups";
import type { DocumentationUnitSummary } from "@/lib/services/deliverables/documentation-types";

import { campaignScriptUnitKey, decideDocumentationScriptUnitGrain } from "./unit";
import type { ScriptLanguage } from "./types";
import { scriptLanguageLabel } from "./policy";
import { scriptBodyForLanguage } from "./translation-policy";

export type DocumentationUnitScriptIntent = "edit" | "preview" | "upload";

export type DocumentationUnitScriptTarget = {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  unitKey: string;
  grain: "qty1" | "qty_n";
};

export function documentationUnitCanHoldScript(unit: {
  quantity: number;
  assignmentPostScheduleId?: string | null;
}): boolean {
  return decideDocumentationScriptUnitGrain({
    quantity: unit.quantity,
    assignmentPostScheduleId: unit.assignmentPostScheduleId,
  }) !== "invalid";
}

export function documentationScriptTargetFromUnit(
  unit: Pick<
    DocumentationUnitSummary,
    "campaignHeaderId" | "assignmentDeliverableId" | "assignmentPostScheduleId" | "quantity"
  >
): DocumentationUnitScriptTarget | { ok: false; message: string } {
  const grain = decideDocumentationScriptUnitGrain({
    quantity: unit.quantity,
    assignmentPostScheduleId: unit.assignmentPostScheduleId,
  });
  if (grain === "invalid") {
    return {
      ok: false,
      message:
        unit.quantity > 1
          ? "This deliverable has multiple posts. Attach the script to a specific post."
          : "A quantity-1 deliverable script attaches to the deliverable, not a post.",
    };
  }
  const assignmentPostScheduleId = unit.assignmentPostScheduleId?.trim() || null;
  return {
    campaignHeaderId: unit.campaignHeaderId,
    assignmentDeliverableId: unit.assignmentDeliverableId,
    assignmentPostScheduleId,
    unitKey: campaignScriptUnitKey(unit.assignmentDeliverableId, assignmentPostScheduleId),
    grain,
  };
}

export function documentationUnitScriptActionLabels(hasScript: boolean): {
  primary: string;
  secondary: string;
} {
  return hasScript
    ? { primary: "Script", secondary: "Preview" }
    : { primary: "Add Script", secondary: "Upload Script" };
}

export function isLegacyUnattachedCampaignScript(script: {
  assignmentDeliverableId?: string | null;
  assignmentPostScheduleId?: string | null;
}): boolean {
  return !script.assignmentDeliverableId && !script.assignmentPostScheduleId;
}

export function attachedScriptPresenceFromRows(
  rows: Array<{
    id: string;
    assignment_deliverable_id: string | null;
    assignment_post_schedule_id: string | null;
  }>
): Map<string, string> {
  const presence = new Map<string, string>();
  for (const row of rows) {
    if (!row.assignment_deliverable_id) continue;
    presence.set(
      campaignScriptUnitKey(row.assignment_deliverable_id, row.assignment_post_schedule_id),
      row.id
    );
  }
  return presence;
}

export function campaignScriptDownloadFileName(
  slotTitle: string,
  language: ScriptLanguage
): string {
  const slug = slotTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "script"}-${language}.txt`;
}

export function campaignScriptDownloadText(input: {
  bodyEn: string;
  bodyAr: string;
  language: ScriptLanguage;
}): { ok: true; text: string } | { ok: false; message: string } {
  const text = scriptBodyForLanguage(input.language, input.bodyEn, input.bodyAr).trim();
  if (!text) {
    return {
      ok: false,
      message: `There is no ${scriptLanguageLabel(input.language)} script to download.`,
    };
  }
  return { ok: true, text };
}

export function documentationUnitScriptSheetTitle(
  unit: Pick<
    DocumentationUnitSummary,
    "label" | "deliverableType" | "sequenceNumber" | "quantity"
  >
): string {
  return `Script · ${documentationSlotTitle(unit)}`;
}

export type ClientPostDocumentationScriptUnit = {
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  unitKey: string;
  quantity: number;
};

export function clientPostDocumentationScriptUnit(post: {
  assignmentDeliverableId?: string | null;
  assignmentPostScheduleId?: string | null;
  quantity?: number;
}): ClientPostDocumentationScriptUnit | null {
  const assignmentDeliverableId = post.assignmentDeliverableId?.trim() || "";
  if (!assignmentDeliverableId) return null;
  const quantity = post.quantity && post.quantity > 0 ? post.quantity : 1;
  const assignmentPostScheduleId = post.assignmentPostScheduleId?.trim() || null;
  if (
    !documentationUnitCanHoldScript({
      quantity,
      assignmentPostScheduleId,
    })
  ) {
    return null;
  }
  return {
    assignmentDeliverableId,
    assignmentPostScheduleId,
    unitKey: campaignScriptUnitKey(assignmentDeliverableId, assignmentPostScheduleId),
    quantity,
  };
}

export function documentationUnitSummaryForClientPost(input: {
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  unitKey: string;
  quantity: number;
  sequenceNumber?: number | null;
  creatorName: string;
  platform: string;
  deliverableLabel: string;
}): DocumentationUnitSummary {
  return {
    campaignHeaderId: "",
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    sequenceNumber: input.sequenceNumber ?? null,
    unitKey: input.unitKey,
    label: input.deliverableLabel,
    creatorId: null,
    creatorName: input.creatorName,
    assignmentLineId: "",
    assignmentName: "",
    platform: input.platform || null,
    deliverableType: input.deliverableLabel,
    dueDate: null,
    quantity: input.quantity,
    received: false,
    contentAssetCount: 0,
    totalAssetCount: 0,
    latestVersionLabel: null,
    revisionCount: 0,
    lastUpdatedAt: null,
    publicationLinkCount: 0,
  };
}
