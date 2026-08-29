import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { isScriptTranslationStatus } from "./translation-policy";
import {
  classifyApplyInsertConflict,
  decideApplyMasterOutcome,
  decideCustomizeAssignment,
  decideReapplyMaster,
  expandLineParticipationsToCreators,
  isScriptAssignmentMode,
  previewApplyMasterScript,
  creatorScriptStatusView,
} from "./assignment-policy";
import { loadCampaignScriptMaster } from "./load-master";
import { nextRevisionNumber } from "./policy";
import type {
  ApplyMasterScriptItemOutcome,
  ApplyMasterScriptPreview,
  ApplyMasterScriptResult,
  CampaignScriptAssignmentRecord,
  CampaignScriptParticipation,
  CreatorScriptStatusView,
} from "./types";

type Supabase = SupabaseClient<Database>;
type AssignmentRow = Database["public"]["Tables"]["campaign_script_assignments"]["Row"];

const APPLY_INSERT_RETRIES = 3;

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate");
}

function mapAssignment(row: AssignmentRow): CampaignScriptAssignmentRecord | null {
  if (!isScriptAssignmentMode(row.mode)) return null;
  return {
    id: row.id,
    campaignHeaderId: row.campaign_header_id,
    scriptId: row.script_id,
    campaignLineId: row.campaign_line_id,
    influencerId: row.influencer_id,
    campaignInfluencerId: row.campaign_influencer_id,
    mode: row.mode,
    overrideRevisionId: row.override_revision_id,
    forkedFromMasterRevisionId: row.forked_from_master_revision_id,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    updatedAt: row.updated_at,
    translationStatus: isScriptTranslationStatus(row.translation_status)
      ? row.translation_status
      : "idle",
    translationTargetLanguage:
      row.translation_target_language === "en" || row.translation_target_language === "ar"
        ? row.translation_target_language
        : null,
    translationSourceRevisionId: row.translation_source_revision_id,
    translationError: row.translation_error,
    translationAttempts: row.translation_attempts ?? 0,
    translationUpdatedAt: row.translation_updated_at,
  };
}

async function latestRevisionNumber(supabase: Supabase, scriptId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("campaign_script_revisions")
    .select("revision_number")
    .eq("script_id", scriptId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.revision_number ?? null;
}

export async function listCampaignScriptParticipationsForLines(
  supabase: Supabase,
  input: { campaignHeaderId: string; lineIds: string[] }
): Promise<CampaignScriptParticipation[]> {
  const headerId = input.campaignHeaderId.trim();
  const lineIds = [...new Set(input.lineIds.map((id) => id.trim()).filter(Boolean))];
  if (!headerId || lineIds.length === 0) return [];

  const { data, error } = await supabase
    .from("campaign_influencers")
    .select("id, campaign_line_id, influencer_id")
    .eq("campaign_header_id", headerId)
    .in("campaign_line_id", lineIds);
  if (error) throw new Error(error.message);

  const byLineOrder = new Map(lineIds.map((id, index) => [id, index]));
  const rows = [...(data ?? [])].sort((a, b) => {
    const lineA = byLineOrder.get(a.campaign_line_id ?? "") ?? Number.MAX_SAFE_INTEGER;
    const lineB = byLineOrder.get(b.campaign_line_id ?? "") ?? Number.MAX_SAFE_INTEGER;
    if (lineA !== lineB) return lineA - lineB;
    return a.influencer_id.localeCompare(b.influencer_id);
  });

  return expandLineParticipationsToCreators(
    rows.map((row) => ({
      campaignInfluencerId: row.id,
      campaignLineId: row.campaign_line_id,
      influencerId: row.influencer_id,
    }))
  );
}

export async function loadCampaignScriptAssignment(
  supabase: Supabase,
  input: { scriptId: string; influencerId: string }
): Promise<CampaignScriptAssignmentRecord | null> {
  const { data, error } = await supabase
    .from("campaign_script_assignments")
    .select("*")
    .eq("script_id", input.scriptId)
    .eq("influencer_id", input.influencerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAssignment(data) : null;
}

export async function loadCampaignScriptAssignmentById(
  supabase: Supabase,
  assignmentId: string
): Promise<CampaignScriptAssignmentRecord | null> {
  const id = assignmentId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("campaign_script_assignments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAssignment(data) : null;
}

export async function listCampaignScriptAssignments(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<CampaignScriptAssignmentRecord[]> {
  const headerId = campaignHeaderId.trim();
  if (!headerId) return [];
  const { data, error } = await supabase
    .from("campaign_script_assignments")
    .select("*")
    .eq("campaign_header_id", headerId)
    .order("assigned_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(mapAssignment)
    .filter((row): row is CampaignScriptAssignmentRecord => row !== null);
}

async function ensureInheritedAssignment(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    scriptId: string;
    participation: CampaignScriptParticipation;
    actorUserId: string | null;
  }
): Promise<{
  assignment: CampaignScriptAssignmentRecord;
  outcome: ApplyMasterScriptItemOutcome;
}> {
  const existing = await loadCampaignScriptAssignment(supabase, {
    scriptId: input.scriptId,
    influencerId: input.participation.influencerId,
  });
  const planned = decideApplyMasterOutcome(existing);
  if (planned !== "create_inherited" && existing) {
    return { assignment: existing, outcome: planned };
  }

  for (let attempt = 0; attempt < APPLY_INSERT_RETRIES; attempt += 1) {
    const inserted = await supabase
      .from("campaign_script_assignments")
      .insert({
        campaign_header_id: input.campaignHeaderId,
        script_id: input.scriptId,
        campaign_line_id: input.participation.campaignLineId,
        influencer_id: input.participation.influencerId,
        campaign_influencer_id: input.participation.campaignInfluencerId,
        mode: "inherited",
        override_revision_id: null,
        forked_from_master_revision_id: null,
        assigned_by: input.actorUserId,
      })
      .select("*")
      .maybeSingle();

    if (inserted.data) {
      const mapped = mapAssignment(inserted.data);
      if (!mapped) throw new Error("Created script assignment could not be read back.");
      return { assignment: mapped, outcome: "created" };
    }

    if (!isUniqueViolation(inserted.error)) {
      throw new Error(inserted.error?.message ?? "Could not assign the campaign script.");
    }

    const raced = await loadCampaignScriptAssignment(supabase, {
      scriptId: input.scriptId,
      influencerId: input.participation.influencerId,
    });
    const classified = classifyApplyInsertConflict(raced);
    if (classified !== "retry" && raced) {
      return { assignment: raced, outcome: classified };
    }
  }

  throw new Error("Could not assign the campaign script because another save was in progress.");
}

/**
 * Apply the campaign master script to creators on the selected campaign lines.
 * Expands lines → campaign_influencers → unique influencer_id.
 * Idempotent: inherited stays inherited; customized is never overwritten.
 */
export async function applyMasterScriptToLineIds(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    lineIds: string[];
    actorUserId?: string | null;
  }
): Promise<ApplyMasterScriptResult> {
  const headerId = input.campaignHeaderId.trim();
  if (!headerId) return { ok: false, message: "Campaign is missing." };

  const master = await loadCampaignScriptMaster(supabase, headerId);
  if (!master) {
    return { ok: false, message: "Save the campaign script before assigning it to creators." };
  }

  let participations: CampaignScriptParticipation[];
  try {
    participations = await listCampaignScriptParticipationsForLines(supabase, {
      campaignHeaderId: headerId,
      lineIds: input.lineIds,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load campaign assignments.",
    };
  }

  const items: Array<{
    influencerId: string;
    campaignLineId: string;
    campaignInfluencerId: string;
    assignmentId: string;
    outcome: ApplyMasterScriptItemOutcome;
  }> = [];

  try {
    for (const participation of participations) {
      const ensured = await ensureInheritedAssignment(supabase, {
        campaignHeaderId: headerId,
        scriptId: master.scriptId,
        participation,
        actorUserId: input.actorUserId ?? null,
      });
      items.push({
        influencerId: participation.influencerId,
        campaignLineId: participation.campaignLineId,
        campaignInfluencerId: participation.campaignInfluencerId,
        assignmentId: ensured.assignment.id,
        outcome: ensured.outcome,
      });
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not assign the campaign script.",
    };
  }

  return { ok: true, scriptId: master.scriptId, items };
}

export type CustomizeScriptAssignmentResult =
  | { ok: true; assignment: CampaignScriptAssignmentRecord; alreadyCustomized: boolean }
  | { ok: false; message: string };

/**
 * Fork the current master revision into a creator override. Does not change master.
 * Already-customized assignments are left untouched.
 */
export async function customizeCampaignScriptAssignment(
  supabase: Supabase,
  input: {
    assignmentId: string;
    actorUserId?: string | null;
    actorLabel?: string | null;
  }
): Promise<CustomizeScriptAssignmentResult> {
  const assignment = await loadCampaignScriptAssignmentById(supabase, input.assignmentId);
  if (!assignment) return { ok: false, message: "Script assignment was not found." };

  const decision = decideCustomizeAssignment(assignment);
  if (decision === "already_customized") {
    return { ok: true, assignment, alreadyCustomized: true };
  }

  const master = await loadCampaignScriptMaster(supabase, assignment.campaignHeaderId);
  if (!master) {
    return { ok: false, message: "The campaign master script is empty." };
  }

  const revisionNumber = nextRevisionNumber(await latestRevisionNumber(supabase, assignment.scriptId));
  const inserted = await supabase
    .from("campaign_script_revisions")
    .insert({
      script_id: assignment.scriptId,
      campaign_header_id: assignment.campaignHeaderId,
      assignment_id: assignment.id,
      revision_number: revisionNumber,
      business_version: master.businessVersion,
      body_en: master.bodyEn,
      body_ar: master.bodyAr,
      source_language: master.sourceLanguage,
      en_origin: master.enOrigin,
      ar_origin: master.arOrigin,
      actor_kind: "internal",
      actor_user_id: input.actorUserId ?? null,
      actor_label: input.actorLabel ?? null,
      parent_revision_id: master.currentRevisionId,
      change_summary: "Creator script customized from master.",
    })
    .select("id")
    .maybeSingle();

  if (inserted.error || !inserted.data) {
    if (inserted.error && isUniqueViolation(inserted.error)) {
      return {
        ok: false,
        message: "Another script change landed first. Reload and try customizing again.",
      };
    }
    return {
      ok: false,
      message: inserted.error?.message ?? "Could not create the creator script override.",
    };
  }

  const now = new Date().toISOString();
  const updated = await supabase
    .from("campaign_script_assignments")
    .update({
      mode: "customized",
      override_revision_id: inserted.data.id,
      forked_from_master_revision_id: master.currentRevisionId,
      updated_at: now,
    })
    .eq("id", assignment.id)
    .eq("mode", "inherited")
    .is("override_revision_id", null)
    .select("*")
    .maybeSingle();

  if (updated.error) {
    return { ok: false, message: updated.error.message };
  }
  if (!updated.data) {
    const raced = await loadCampaignScriptAssignmentById(supabase, assignment.id);
    if (raced?.mode === "customized") {
      return { ok: true, assignment: raced, alreadyCustomized: true };
    }
    return {
      ok: false,
      message: "Another script change landed first. Reload and try customizing again.",
    };
  }

  const mapped = mapAssignment(updated.data);
  if (!mapped) return { ok: false, message: "Customized script assignment could not be read back." };
  return { ok: true, assignment: mapped, alreadyCustomized: false };
}

export type ReapplyMasterScriptResult =
  | { ok: true; assignment: CampaignScriptAssignmentRecord; alreadyInherited: boolean }
  | { ok: false; message: string };

/**
 * Explicit return to master. Override revisions stay in history.
 * Requires confirmed=true so Apply Master cannot call this by accident.
 */
export async function reapplyMasterToCampaignScriptAssignment(
  supabase: Supabase,
  input: { assignmentId: string; confirmed: boolean }
): Promise<ReapplyMasterScriptResult> {
  const assignment = await loadCampaignScriptAssignmentById(supabase, input.assignmentId);
  if (!assignment) return { ok: false, message: "Script assignment was not found." };

  const decision = decideReapplyMaster({ mode: assignment.mode, confirmed: input.confirmed });
  if (decision === "already_inherited") {
    return { ok: true, assignment, alreadyInherited: true };
  }
  if (decision === "requires_confirmation") {
    return {
      ok: false,
      message: "Confirm re-applying the Campaign Master Script. The customized version will stay in history.",
    };
  }

  const now = new Date().toISOString();
  const updated = await supabase
    .from("campaign_script_assignments")
    .update({
      mode: "inherited",
      override_revision_id: null,
      forked_from_master_revision_id: null,
      updated_at: now,
    })
    .eq("id", assignment.id)
    .eq("mode", "customized")
    .select("*")
    .maybeSingle();

  if (updated.error) {
    return { ok: false, message: updated.error.message };
  }
  if (!updated.data) {
    const raced = await loadCampaignScriptAssignmentById(supabase, assignment.id);
    if (raced?.mode === "inherited") {
      return { ok: true, assignment: raced, alreadyInherited: true };
    }
    return {
      ok: false,
      message: "Another script change landed first. Reload and try again.",
    };
  }

  const mapped = mapAssignment(updated.data);
  if (!mapped) return { ok: false, message: "Script assignment could not be read back." };
  return { ok: true, assignment: mapped, alreadyInherited: false };
}

export async function previewApplyMasterScriptToLineIds(
  supabase: Supabase,
  input: { campaignHeaderId: string; lineIds: string[] }
): Promise<{ ok: true; preview: ApplyMasterScriptPreview } | { ok: false; message: string }> {
  const headerId = input.campaignHeaderId.trim();
  if (!headerId) return { ok: false, message: "Campaign is missing." };
  try {
    const master = await loadCampaignScriptMaster(supabase, headerId);
    if (!master) {
      return { ok: false, message: "Save the campaign script before assigning it to creators." };
    }
    const participations = await listCampaignScriptParticipationsForLines(supabase, {
      campaignHeaderId: headerId,
      lineIds: input.lineIds,
    });
    const existing = await listCampaignScriptAssignments(supabase, headerId);
    const existingByInfluencerId = new Map(
      existing.map((row) => [row.influencerId, { mode: row.mode }] as const)
    );
    return {
      ok: true,
      preview: previewApplyMasterScript({
        masterVersion: master.businessVersion,
        masterRevisionId: master.currentRevisionId,
        participations,
        existingByInfluencerId,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not preview script assignment.",
    };
  }
}

export async function listCreatorScriptStatuses(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<{
  masterVersion: string | null;
  masterRevisionId: string | null;
  byInfluencerId: Map<string, CreatorScriptStatusView>;
}> {
  const headerId = campaignHeaderId.trim();
  const master = headerId ? await loadCampaignScriptMaster(supabase, headerId) : null;
  const assignments = headerId ? await listCampaignScriptAssignments(supabase, headerId) : [];
  const forkIds = [
    ...new Set(
      assignments
        .map((row) => row.forkedFromMasterRevisionId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const forkVersions = new Map<string, string>();
  if (forkIds.length > 0) {
    const { data, error } = await supabase
      .from("campaign_script_revisions")
      .select("id, business_version")
      .in("id", forkIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      forkVersions.set(row.id, row.business_version);
    }
  }

  const byInfluencerId = new Map<string, CreatorScriptStatusView>();
  for (const assignment of assignments) {
    const view = creatorScriptStatusView({
      influencerId: assignment.influencerId,
      assignment,
      masterVersion: master?.businessVersion ?? null,
      forkedFromVersion: assignment.forkedFromMasterRevisionId
        ? forkVersions.get(assignment.forkedFromMasterRevisionId) ?? null
        : null,
      masterRevisionId: master?.currentRevisionId ?? null,
    });
    if (view) byInfluencerId.set(assignment.influencerId, view);
  }
  return {
    masterVersion: master?.businessVersion ?? null,
    masterRevisionId: master?.currentRevisionId ?? null,
    byInfluencerId,
  };
}

