import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { ScriptLanguage, ScriptTranslationStatus } from "./types";

type Supabase = SupabaseClient<Database>;

export type CampaignScriptTranslationStatePatch = {
  translationStatus: ScriptTranslationStatus;
  translationTargetLanguage?: ScriptLanguage | null;
  translationSourceRevisionId?: string | null;
  translationError?: string | null;
  translationAttempts?: number;
};

export async function updateCampaignScriptTranslationState(
  supabase: Supabase,
  scriptId: string,
  patch: CampaignScriptTranslationStatePatch
): Promise<{ ok: true } | { ok: false; message: string }> {
  const update: Database["public"]["Tables"]["campaign_scripts"]["Update"] = {
    translation_status: patch.translationStatus,
    translation_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (patch.translationTargetLanguage !== undefined) {
    update.translation_target_language = patch.translationTargetLanguage;
  }
  if (patch.translationSourceRevisionId !== undefined) {
    update.translation_source_revision_id = patch.translationSourceRevisionId;
  }
  if (patch.translationError !== undefined) {
    update.translation_error = patch.translationError;
  }
  if (patch.translationAttempts !== undefined) {
    update.translation_attempts = patch.translationAttempts;
  }

  const { error } = await supabase.from("campaign_scripts").update(update).eq("id", scriptId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateCampaignScriptAssignmentTranslationState(
  supabase: Supabase,
  assignmentId: string,
  patch: CampaignScriptTranslationStatePatch
): Promise<{ ok: true } | { ok: false; message: string }> {
  const update: Database["public"]["Tables"]["campaign_script_assignments"]["Update"] = {
    translation_status: patch.translationStatus,
    translation_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (patch.translationTargetLanguage !== undefined) {
    update.translation_target_language = patch.translationTargetLanguage;
  }
  if (patch.translationSourceRevisionId !== undefined) {
    update.translation_source_revision_id = patch.translationSourceRevisionId;
  }
  if (patch.translationError !== undefined) {
    update.translation_error = patch.translationError;
  }
  if (patch.translationAttempts !== undefined) {
    update.translation_attempts = patch.translationAttempts;
  }

  const { error } = await supabase
    .from("campaign_script_assignments")
    .update(update)
    .eq("id", assignmentId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
