import type {
  ApplyMasterScriptItemOutcome,
  ApplyMasterScriptPreview,
  CampaignScriptAssignmentRecord,
  CampaignScriptParticipation,
  CreatorScriptStatusView,
  EffectiveCampaignScript,
  ScriptAssignmentAlignment,
  ScriptAssignmentMode,
} from "./types";

export const SCRIPT_ASSIGNMENT_UNIQUE_CONSTRAINT = "campaign_script_assignments_script_id_influencer_id_key";

export function isScriptAssignmentMode(value: string | null | undefined): value is ScriptAssignmentMode {
  return value === "inherited" || value === "customized";
}

/**
 * Selected campaign lines expand to campaign_influencers, then unique creators.
 * First participation in input order wins when the same creator appears on multiple lines.
 */
export function expandLineParticipationsToCreators(
  rows: Array<{
    campaignInfluencerId?: string | null;
    campaignLineId?: string | null;
    influencerId?: string | null;
  }>
): CampaignScriptParticipation[] {
  const seen = new Set<string>();
  const unique: CampaignScriptParticipation[] = [];
  for (const row of rows) {
    const campaignInfluencerId = row.campaignInfluencerId?.trim() ?? "";
    const campaignLineId = row.campaignLineId?.trim() ?? "";
    const influencerId = row.influencerId?.trim() ?? "";
    if (!campaignInfluencerId || !campaignLineId || !influencerId) continue;
    if (seen.has(influencerId)) continue;
    seen.add(influencerId);
    unique.push({ campaignInfluencerId, campaignLineId, influencerId });
  }
  return unique;
}

export function decideApplyMasterOutcome(
  existing: Pick<CampaignScriptAssignmentRecord, "mode"> | null
): ApplyMasterScriptItemOutcome | "create_inherited" {
  if (!existing) return "create_inherited";
  if (existing.mode === "customized") return "kept_customized";
  return "already_inherited";
}

export function classifyApplyInsertConflict(
  existingAfterConflict: Pick<CampaignScriptAssignmentRecord, "mode"> | null
): ApplyMasterScriptItemOutcome | "retry" {
  if (!existingAfterConflict) return "retry";
  if (existingAfterConflict.mode === "customized") return "kept_customized";
  return "already_inherited";
}

export function scriptAssignmentAlignment(input: {
  mode: ScriptAssignmentMode;
  forkedFromMasterRevisionId: string | null;
  masterRevisionId: string | null;
}): ScriptAssignmentAlignment {
  if (input.mode === "inherited") return "current";
  if (
    input.forkedFromMasterRevisionId &&
    input.masterRevisionId &&
    input.forkedFromMasterRevisionId === input.masterRevisionId
  ) {
    return "customized";
  }
  return "master_updated";
}

export function resolveEffectiveScript(input: {
  assignment: CampaignScriptAssignmentRecord | null;
  masterRevisionId: string | null;
}): EffectiveCampaignScript {
  if (!input.assignment) return { kind: "not_assigned" };
  if (input.assignment.mode === "inherited") {
    if (!input.masterRevisionId) return { kind: "not_assigned" };
    return {
      kind: "inherited",
      assignment: input.assignment,
      revisionId: input.masterRevisionId,
      alignment: "current",
    };
  }
  if (!input.assignment.overrideRevisionId) return { kind: "not_assigned" };
  const alignment = scriptAssignmentAlignment({
    mode: "customized",
    forkedFromMasterRevisionId: input.assignment.forkedFromMasterRevisionId,
    masterRevisionId: input.masterRevisionId,
  });
  return {
    kind: "customized",
    assignment: input.assignment,
    revisionId: input.assignment.overrideRevisionId,
    alignment: alignment === "current" ? "customized" : alignment,
  };
}

export function decideCustomizeAssignment(
  existing: Pick<CampaignScriptAssignmentRecord, "mode"> | null
): "not_assigned" | "already_customized" | "fork" {
  if (!existing) return "not_assigned";
  if (existing.mode === "customized") return "already_customized";
  return "fork";
}

export function decideReapplyMaster(input: {
  mode: ScriptAssignmentMode | null;
  confirmed: boolean;
}): "not_assigned" | "already_inherited" | "requires_confirmation" | "reapply" {
  if (!input.mode) return "not_assigned";
  if (input.mode === "inherited") return "already_inherited";
  if (!input.confirmed) return "requires_confirmation";
  return "reapply";
}

/**
 * Client content-token sessions must never read creator assignments.
 * Internal JWT follows campaigns.read/write + campaign header access (same as master).
 */
export function canAccessCampaignScriptAssignment(input: {
  operation: "select" | "insert" | "update" | "delete";
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

export function previewApplyMasterScript(input: {
  masterVersion: string | null;
  masterRevisionId: string | null;
  participations: CampaignScriptParticipation[];
  existingByInfluencerId: Map<string, Pick<CampaignScriptAssignmentRecord, "mode">>;
}): ApplyMasterScriptPreview {
  let willCreate = 0;
  let alreadyInherited = 0;
  let keptCustomized = 0;
  for (const participation of input.participations) {
    const outcome = decideApplyMasterOutcome(
      input.existingByInfluencerId.get(participation.influencerId) ?? null
    );
    if (outcome === "create_inherited") willCreate += 1;
    else if (outcome === "already_inherited") alreadyInherited += 1;
    else keptCustomized += 1;
  }
  return {
    masterVersion: input.masterVersion,
    masterRevisionId: input.masterRevisionId,
    creatorCount: input.participations.length,
    willCreate,
    alreadyInherited,
    keptCustomized,
  };
}

export function classifyApplyCampaignScriptLineItems(
  items: Array<{ outcome: ApplyMasterScriptItemOutcome }>
): { skipped: boolean; message?: string } {
  if (items.length === 0) {
    return { skipped: true, message: "No creators on this assignment." };
  }
  if (items.every((item) => item.outcome === "kept_customized")) {
    return { skipped: true, message: "Customized script kept unchanged." };
  }
  if (items.every((item) => item.outcome === "already_inherited")) {
    return { skipped: true, message: "Already inherits the campaign script." };
  }
  return { skipped: false };
}

export function creatorScriptStatusView(input: {
  influencerId: string | null | undefined;
  assignment: Pick<
    CampaignScriptAssignmentRecord,
    "id" | "mode" | "forkedFromMasterRevisionId"
  > | null;
  masterVersion: string | null;
  forkedFromVersion: string | null;
  masterRevisionId: string | null;
}): CreatorScriptStatusView | null {
  const influencerId = input.influencerId?.trim() ?? "";
  if (!influencerId) return null;
  if (!input.assignment) {
    return {
      influencerId,
      assignmentId: null,
      state: "not_assigned",
      versionLabel: "—",
      alignmentNote: null,
      actionLabel: "Assign",
    };
  }
  if (input.assignment.mode === "inherited") {
    return {
      influencerId,
      assignmentId: input.assignment.id,
      state: "inherited",
      versionLabel: input.masterVersion ? `Current ${input.masterVersion}` : "Current",
      alignmentNote: null,
      actionLabel: "Open",
    };
  }
  const alignment = scriptAssignmentAlignment({
    mode: "customized",
    forkedFromMasterRevisionId: input.assignment.forkedFromMasterRevisionId,
    masterRevisionId: input.masterRevisionId,
  });
  return {
    influencerId,
    assignmentId: input.assignment.id,
    state: "customized",
    versionLabel: input.forkedFromVersion
      ? `Based on ${input.forkedFromVersion}`
      : "Custom",
    alignmentNote:
      alignment === "master_updated"
        ? "Master script has been updated since this creator was customized."
        : null,
    actionLabel: "Open",
  };
}

