import { documentationUnitKey } from "@/lib/services/deliverables/documentation-types";

export type CampaignScriptDocumentationUnit = {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  unitKey: string;
};

export type CampaignScriptUnitInput = {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
};

export function campaignScriptUnitKey(
  assignmentDeliverableId: string,
  assignmentPostScheduleId: string | null | undefined
): string {
  return documentationUnitKey(
    assignmentDeliverableId.trim(),
    assignmentPostScheduleId?.trim() || null
  );
}

export type CampaignScriptUnitParseResult =
  | CampaignScriptDocumentationUnit
  | { ok: false; message: string };

export function isCampaignScriptUnitParseFailure(
  value: CampaignScriptUnitParseResult
): value is { ok: false; message: string } {
  return "ok" in value && value.ok === false;
}

export function parseCampaignScriptDocumentationUnit(
  input: CampaignScriptUnitInput
): CampaignScriptUnitParseResult {
  const campaignHeaderId = input.campaignHeaderId.trim();
  const assignmentDeliverableId = input.assignmentDeliverableId.trim();
  const assignmentPostScheduleId = input.assignmentPostScheduleId?.trim() || null;
  if (!campaignHeaderId) return { ok: false, message: "Campaign is missing." };
  if (!assignmentDeliverableId) return { ok: false, message: "Deliverable is missing." };
  return {
    campaignHeaderId,
    assignmentDeliverableId,
    assignmentPostScheduleId,
    unitKey: campaignScriptUnitKey(assignmentDeliverableId, assignmentPostScheduleId),
  };
}

export function isQtyOneDocumentationScriptUnit(
  unit: Pick<CampaignScriptDocumentationUnit, "assignmentPostScheduleId">
): boolean {
  return unit.assignmentPostScheduleId == null;
}

export function decideDocumentationScriptUnitGrain(input: {
  quantity: number;
  assignmentPostScheduleId: string | null | undefined;
}): "qty1" | "qty_n" | "invalid" {
  const qty = Number.isFinite(input.quantity) ? Math.max(1, Math.trunc(input.quantity)) : 1;
  const postId = input.assignmentPostScheduleId?.trim() || null;
  if (qty === 1) return postId ? "invalid" : "qty1";
  return postId ? "qty_n" : "invalid";
}

export function canAccessCampaignScriptUnit(input: {
  operation: "select" | "insert" | "update";
  hasCampaignsRead: boolean;
  hasCampaignsWrite: boolean;
  canAccessCampaignHeader: boolean;
  isClientContentToken?: boolean;
}): boolean {
  if (input.isClientContentToken) return false;
  if (!input.canAccessCampaignHeader) return false;
  if (input.operation === "select") return input.hasCampaignsRead;
  return input.hasCampaignsWrite;
}
