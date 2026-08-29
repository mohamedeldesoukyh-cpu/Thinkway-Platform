import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  loadCampaignScriptMaster,
  loadCampaignScriptRevisionById,
  mapCampaignScriptOverrideView,
} from "./load-master";
import {
  SCRIPT_CAS_CONFLICT_MESSAGE,
  businessVersionForSave,
  decideCasWrite,
  nextRevisionNumber,
  resolveScriptOrigins,
  validateScriptBodies,
} from "./policy";
import type {
  CampaignScriptAssignmentRecord,
  CampaignScriptMasterView,
  SaveCampaignScriptInput,
  SaveCampaignScriptResult,
} from "./types";

type Supabase = SupabaseClient<Database>;

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate");
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

export async function loadCampaignScriptOverrideView(
  supabase: Supabase,
  assignment: CampaignScriptAssignmentRecord
): Promise<CampaignScriptMasterView | null> {
  if (assignment.mode !== "customized" || !assignment.overrideRevisionId) return null;
  const revision = await loadCampaignScriptRevisionById(supabase, assignment.overrideRevisionId);
  if (!revision) return null;
  const master = await loadCampaignScriptMaster(supabase, assignment.campaignHeaderId);
  return mapCampaignScriptOverrideView(assignment, revision, master?.origin ?? "internal");
}

export async function saveCampaignScriptOverride(
  supabase: Supabase,
  assignment: CampaignScriptAssignmentRecord,
  input: Omit<SaveCampaignScriptInput, "campaignHeaderId" | "origin"> & {
    origin?: SaveCampaignScriptInput["origin"];
  }
): Promise<SaveCampaignScriptResult> {
  if (assignment.mode !== "customized" || !assignment.overrideRevisionId) {
    return {
      ok: false,
      conflict: false,
      message: "Customize this creator before editing a creator-specific script.",
    };
  }

  const bodies = validateScriptBodies(input.bodyEn, input.bodyAr);
  if (!bodies.ok) return { ok: false, conflict: false, message: bodies.message };

  const actualRevisionId = assignment.overrideRevisionId;
  if (decideCasWrite(input.expectedCurrentRevisionId, actualRevisionId) === "conflict") {
    const script = await loadCampaignScriptOverrideView(supabase, assignment);
    return {
      ok: false,
      conflict: true,
      script,
      message: SCRIPT_CAS_CONFLICT_MESSAGE,
    };
  }

  const previous = await loadCampaignScriptOverrideView(supabase, assignment);
  const origins =
    input.originsOverride ??
    resolveScriptOrigins({
      sourceLanguage: input.sourceLanguage,
      bodyEn: bodies.bodyEn,
      bodyAr: bodies.bodyAr,
      previous,
    });
  const revisionNumber = nextRevisionNumber(await latestRevisionNumber(supabase, assignment.scriptId));
  const businessVersion = businessVersionForSave(
    previous?.businessVersion ?? null,
    input.bumpBusinessVersion !== false
  );

  const revisionInsert = await supabase
    .from("campaign_script_revisions")
    .insert({
      script_id: assignment.scriptId,
      campaign_header_id: assignment.campaignHeaderId,
      assignment_id: assignment.id,
      revision_number: revisionNumber,
      business_version: businessVersion,
      body_en: bodies.bodyEn,
      body_ar: bodies.bodyAr,
      source_language: input.sourceLanguage,
      en_origin: origins.enOrigin,
      ar_origin: origins.arOrigin,
      actor_kind: input.actorKind,
      actor_user_id: input.actorUserId,
      actor_label: input.actorLabel,
      parent_revision_id: actualRevisionId,
      original_file_name: input.originalFileName ?? null,
      change_summary: input.changeSummary ?? null,
    })
    .select("*")
    .maybeSingle();

  if (revisionInsert.error || !revisionInsert.data) {
    if (revisionInsert.error && isUniqueViolation(revisionInsert.error)) {
      const script = await loadCampaignScriptOverrideView(supabase, assignment);
      return {
        ok: false,
        conflict: true,
        script,
        message: SCRIPT_CAS_CONFLICT_MESSAGE,
      };
    }
    return {
      ok: false,
      conflict: false,
      message: revisionInsert.error?.message ?? "Could not save the creator script.",
    };
  }

  const cas = await supabase
    .from("campaign_script_assignments")
    .update({
      override_revision_id: revisionInsert.data.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignment.id)
    .eq("override_revision_id", actualRevisionId)
    .select("*")
    .maybeSingle();

  if (cas.error) {
    return { ok: false, conflict: false, message: cas.error.message };
  }
  if (!cas.data) {
    const script = await loadCampaignScriptOverrideView(supabase, assignment);
    return {
      ok: false,
      conflict: true,
      script,
      message: SCRIPT_CAS_CONFLICT_MESSAGE,
    };
  }

  const mapped = mapCampaignScriptOverrideView(
    {
      ...assignment,
      overrideRevisionId: revisionInsert.data.id,
    },
    revisionInsert.data,
    previous?.origin ?? "internal"
  );
  if (!mapped) {
    return { ok: false, conflict: false, message: "Saved creator script could not be read back." };
  }
  return { ok: true, conflict: false, script: mapped };
}
