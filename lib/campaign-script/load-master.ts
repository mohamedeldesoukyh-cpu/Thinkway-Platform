import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { attachedScriptPresenceFromRows } from "./documentation-unit-ui";
import type {
  CampaignScriptMasterView,
  ScriptActorKind,
  ScriptLanguage,
  ScriptOrigin,
  ScriptTextOrigin,
  ScriptTranslationStatus,
} from "./types";
import { isScriptTranslationStatus } from "./translation-policy";
import { isScriptLanguage } from "./language";

type Supabase = SupabaseClient<Database>;

type ScriptRow = Database["public"]["Tables"]["campaign_scripts"]["Row"];
type RevisionRow = Database["public"]["Tables"]["campaign_script_revisions"]["Row"];

function asLanguage(value: string): ScriptLanguage | null {
  return isScriptLanguage(value) ? value : null;
}

function asOrigin(value: string): ScriptTextOrigin | null {
  if (value === "source" || value === "generated" || value === "human_edited") return value;
  return null;
}

function asActorKind(value: string): ScriptActorKind | null {
  if (value === "internal" || value === "client") return value;
  return null;
}

function asScriptOrigin(value: string): ScriptOrigin | null {
  if (value === "internal" || value === "client") return value;
  return null;
}

function asTranslationStatus(value: string | null | undefined): ScriptTranslationStatus {
  return isScriptTranslationStatus(value) ? value : "idle";
}

function asTargetLanguage(value: string | null | undefined): ScriptLanguage | null {
  return asLanguage(value ?? "");
}

export function mapCampaignScriptMaster(
  script: ScriptRow,
  revision: RevisionRow
): CampaignScriptMasterView | null {
  const sourceLanguage = asLanguage(revision.source_language);
  const enOrigin = asOrigin(revision.en_origin);
  const arOrigin = asOrigin(revision.ar_origin);
  const actorKind = asActorKind(revision.actor_kind);
  const origin = asScriptOrigin(script.origin);
  if (!sourceLanguage || !enOrigin || !arOrigin || !actorKind || !origin) return null;
  if (!script.current_revision_id) return null;
  return {
    scriptId: script.id,
    campaignHeaderId: script.campaign_header_id,
    currentRevisionId: revision.id,
    revisionNumber: revision.revision_number,
    businessVersion: revision.business_version,
    sourceLanguage,
    bodyEn: revision.body_en,
    bodyAr: revision.body_ar,
    enOrigin,
    arOrigin,
    actorKind,
    actorLabel: revision.actor_label,
    createdAt: revision.created_at,
    origin,
    originalFileName: revision.original_file_name,
    assignmentDeliverableId: script.assignment_deliverable_id,
    assignmentPostScheduleId: script.assignment_post_schedule_id,
    translationStatus: asTranslationStatus(script.translation_status),
    translationTargetLanguage: asTargetLanguage(script.translation_target_language),
    translationSourceRevisionId: script.translation_source_revision_id,
    translationError: script.translation_error,
    translationAttempts: script.translation_attempts ?? 0,
    translationUpdatedAt: script.translation_updated_at,
  };
}

export async function loadCampaignScriptMaster(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<CampaignScriptMasterView | null> {
  const headerId = campaignHeaderId.trim();
  if (!headerId) return null;

  const { data: script, error: scriptError } = await supabase
    .from("campaign_scripts")
    .select("*")
    .eq("campaign_header_id", headerId)
    .is("assignment_deliverable_id", null)
    .is("assignment_post_schedule_id", null)
    .maybeSingle();
  if (scriptError) {
    throw new Error(scriptError.message);
  }
  if (!script?.current_revision_id) return null;

  const { data: revision, error: revisionError } = await supabase
    .from("campaign_script_revisions")
    .select("*")
    .eq("id", script.current_revision_id)
    .is("assignment_id", null)
    .maybeSingle();
  if (revisionError) {
    throw new Error(revisionError.message);
  }
  if (!revision) return null;
  return mapCampaignScriptMaster(script, revision);
}

export async function listAttachedCampaignScriptPresence(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<Map<string, string>> {
  const headerId = campaignHeaderId.trim();
  if (!headerId) return new Map();
  const { data, error } = await supabase
    .from("campaign_scripts")
    .select("id, assignment_deliverable_id, assignment_post_schedule_id")
    .eq("campaign_header_id", headerId)
    .not("assignment_deliverable_id", "is", null);
  if (error) throw new Error(error.message);
  return attachedScriptPresenceFromRows(data ?? []);
}

export async function loadCampaignScriptById(
  supabase: Supabase,
  scriptId: string
): Promise<CampaignScriptMasterView | null> {
  const id = scriptId.trim();
  if (!id) return null;
  const { data: script, error: scriptError } = await supabase
    .from("campaign_scripts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (scriptError) throw new Error(scriptError.message);
  if (!script?.current_revision_id) return null;

  const { data: revision, error: revisionError } = await supabase
    .from("campaign_script_revisions")
    .select("*")
    .eq("id", script.current_revision_id)
    .is("assignment_id", null)
    .maybeSingle();
  if (revisionError) throw new Error(revisionError.message);
  if (!revision) return null;
  return mapCampaignScriptMaster(script, revision);
}

export async function loadCampaignScriptForUnit(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId?: string | null;
  }
): Promise<CampaignScriptMasterView | null> {
  const headerId = input.campaignHeaderId.trim();
  const deliverableId = input.assignmentDeliverableId.trim();
  const postId = input.assignmentPostScheduleId?.trim() || null;
  if (!headerId || !deliverableId) return null;

  let query = supabase
    .from("campaign_scripts")
    .select("*")
    .eq("campaign_header_id", headerId)
    .eq("assignment_deliverable_id", deliverableId);
  query = postId
    ? query.eq("assignment_post_schedule_id", postId)
    : query.is("assignment_post_schedule_id", null);

  const { data: script, error: scriptError } = await query.maybeSingle();
  if (scriptError) throw new Error(scriptError.message);
  if (!script?.current_revision_id) return null;

  const { data: revision, error: revisionError } = await supabase
    .from("campaign_script_revisions")
    .select("*")
    .eq("id", script.current_revision_id)
    .is("assignment_id", null)
    .maybeSingle();
  if (revisionError) throw new Error(revisionError.message);
  if (!revision) return null;
  return mapCampaignScriptMaster(script, revision);
}

export function mapCampaignScriptOverrideView(
  assignment: {
    campaignHeaderId: string;
    scriptId: string;
    overrideRevisionId: string | null;
    translationStatus: ScriptTranslationStatus;
    translationTargetLanguage: ScriptLanguage | null;
    translationSourceRevisionId: string | null;
    translationError: string | null;
    translationAttempts: number;
    translationUpdatedAt: string | null;
  },
  revision: RevisionRow,
  origin: ScriptOrigin
): CampaignScriptMasterView | null {
  const sourceLanguage = asLanguage(revision.source_language);
  const enOrigin = asOrigin(revision.en_origin);
  const arOrigin = asOrigin(revision.ar_origin);
  const actorKind = asActorKind(revision.actor_kind);
  if (!sourceLanguage || !enOrigin || !arOrigin || !actorKind || !assignment.overrideRevisionId) {
    return null;
  }
  return {
    scriptId: assignment.scriptId,
    campaignHeaderId: assignment.campaignHeaderId,
    currentRevisionId: revision.id,
    revisionNumber: revision.revision_number,
    businessVersion: revision.business_version,
    sourceLanguage,
    bodyEn: revision.body_en,
    bodyAr: revision.body_ar,
    enOrigin,
    arOrigin,
    actorKind,
    actorLabel: revision.actor_label,
    createdAt: revision.created_at,
    origin,
    originalFileName: revision.original_file_name,
    assignmentDeliverableId: null,
    assignmentPostScheduleId: null,
    translationStatus: assignment.translationStatus,
    translationTargetLanguage: assignment.translationTargetLanguage,
    translationSourceRevisionId: assignment.translationSourceRevisionId,
    translationError: assignment.translationError,
    translationAttempts: assignment.translationAttempts,
    translationUpdatedAt: assignment.translationUpdatedAt,
  };
}

export async function loadCampaignScriptRevisionById(
  supabase: Supabase,
  revisionId: string
): Promise<RevisionRow | null> {
  const id = revisionId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("campaign_script_revisions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}
