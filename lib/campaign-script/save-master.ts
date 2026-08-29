import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { loadCampaignScriptMaster, mapCampaignScriptMaster } from "./load-master";
import {
  SCRIPT_CAS_CONFLICT_MESSAGE,
  businessVersionForSave,
  decideCasWrite,
  nextRevisionNumber,
  resolveScriptOrigins,
  validateScriptBodies,
} from "./policy";
import type { SaveCampaignScriptInput, SaveCampaignScriptResult } from "./types";

type Supabase = SupabaseClient<Database>;

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || (error.message ?? "").toLowerCase().includes("duplicate");
}

async function latestRevisionNumber(
  supabase: Supabase,
  scriptId: string
): Promise<number | null> {
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

export async function saveCampaignScriptMaster(
  supabase: Supabase,
  input: SaveCampaignScriptInput
): Promise<SaveCampaignScriptResult> {
  const bodies = validateScriptBodies(input.bodyEn, input.bodyAr);
  if (!bodies.ok) return { ok: false, conflict: false, message: bodies.message };

  const headerId = input.campaignHeaderId.trim();
  if (!headerId) {
    return { ok: false, conflict: false, message: "Campaign is missing." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("campaign_scripts")
    .select("*")
    .eq("campaign_header_id", headerId)
    .maybeSingle();
  if (existingError) {
    return { ok: false, conflict: false, message: existingError.message };
  }

  const actualRevisionId = existing?.current_revision_id ?? null;
  if (decideCasWrite(input.expectedCurrentRevisionId, actualRevisionId) === "conflict") {
    const script = existing ? await loadCampaignScriptMaster(supabase, headerId) : null;
    return {
      ok: false,
      conflict: true,
      script,
      message: SCRIPT_CAS_CONFLICT_MESSAGE,
    };
  }

  let scriptRow = existing;
  if (!scriptRow) {
    const inserted = await supabase
      .from("campaign_scripts")
      .insert({
        campaign_header_id: headerId,
        source_language: input.sourceLanguage,
        status: "current",
        origin: input.origin,
      })
      .select("*")
      .maybeSingle();
    if (inserted.error) {
      if (!isUniqueViolation(inserted.error)) {
        return { ok: false, conflict: false, message: inserted.error.message };
      }
      const raced = await supabase
        .from("campaign_scripts")
        .select("*")
        .eq("campaign_header_id", headerId)
        .maybeSingle();
      if (raced.error || !raced.data) {
        return { ok: false, conflict: false, message: inserted.error.message };
      }
      if (decideCasWrite(input.expectedCurrentRevisionId, raced.data.current_revision_id) === "conflict") {
        const script = await loadCampaignScriptMaster(supabase, headerId);
        return {
          ok: false,
          conflict: true,
          script,
          message: SCRIPT_CAS_CONFLICT_MESSAGE,
        };
      }
      scriptRow = raced.data;
    } else if (!inserted.data) {
      return { ok: false, conflict: false, message: "Could not create the campaign script." };
    } else {
      scriptRow = inserted.data;
    }
  }

  const previous = await loadCampaignScriptMaster(supabase, headerId);
  const origins =
    input.originsOverride ??
    resolveScriptOrigins({
      sourceLanguage: input.sourceLanguage,
      bodyEn: bodies.bodyEn,
      bodyAr: bodies.bodyAr,
      previous,
    });
  const revisionNumber = nextRevisionNumber(await latestRevisionNumber(supabase, scriptRow.id));
  const businessVersion = businessVersionForSave(
    previous?.businessVersion ?? null,
    input.bumpBusinessVersion !== false
  );

  const revisionInsert = await supabase
    .from("campaign_script_revisions")
    .insert({
      script_id: scriptRow.id,
      campaign_header_id: headerId,
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
      review_id: input.reviewId ?? null,
      original_file_name: input.originalFileName ?? null,
      change_summary: input.changeSummary ?? null,
      assignment_id: null,
    })
    .select("*")
    .maybeSingle();

  if (revisionInsert.error || !revisionInsert.data) {
    if (revisionInsert.error && isUniqueViolation(revisionInsert.error)) {
      const script = await loadCampaignScriptMaster(supabase, headerId);
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
      message: revisionInsert.error?.message ?? "Could not save the script revision.",
    };
  }

  let casQuery = supabase
    .from("campaign_scripts")
    .update({
      current_revision_id: revisionInsert.data.id,
      source_language: input.sourceLanguage,
      status: "current",
      updated_at: new Date().toISOString(),
    })
    .eq("id", scriptRow.id);

  casQuery = actualRevisionId
    ? casQuery.eq("current_revision_id", actualRevisionId)
    : casQuery.is("current_revision_id", null);

  const cas = await casQuery.select("*").maybeSingle();
  if (cas.error) {
    return { ok: false, conflict: false, message: cas.error.message };
  }
  if (!cas.data) {
    const script = await loadCampaignScriptMaster(supabase, headerId);
    return {
      ok: false,
      conflict: true,
      script,
      message: SCRIPT_CAS_CONFLICT_MESSAGE,
    };
  }

  const mapped = mapCampaignScriptMaster(cas.data, revisionInsert.data);
  if (!mapped) {
    return { ok: false, conflict: false, message: "Saved script could not be read back." };
  }
  return { ok: true, conflict: false, script: mapped };
}
