import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  loadCampaignScriptById,
  loadCampaignScriptForUnit,
  loadCampaignScriptMaster,
  mapCampaignScriptMaster,
} from "./load-master";
import {
  SCRIPT_CAS_CONFLICT_MESSAGE,
  businessVersionForSave,
  decideCasWrite,
  nextRevisionNumber,
  resolveScriptOrigins,
  validateScriptBodies,
} from "./policy";
import {
  decideDocumentationScriptUnitGrain,
  isCampaignScriptUnitParseFailure,
  parseCampaignScriptDocumentationUnit,
} from "./unit";
import {
  resolveOriginalDocumentForSave,
  storeCampaignScriptOriginalDocument,
  type CampaignScriptOriginalDocument,
} from "./original-document";
import type { SaveCampaignScriptInput, SaveCampaignScriptResult } from "./types";

type Supabase = SupabaseClient<Database>;
type ScriptRow = Database["public"]["Tables"]["campaign_scripts"]["Row"];

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

async function loadDeliverableGrain(
  supabase: Supabase,
  campaignHeaderId: string,
  assignmentDeliverableId: string,
  assignmentPostScheduleId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: deliverable, error } = await supabase
    .from("assignment_deliverables")
    .select("id, campaign_header_id, quantity")
    .eq("id", assignmentDeliverableId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!deliverable || deliverable.campaign_header_id !== campaignHeaderId) {
    return { ok: false, message: "Deliverable was not found on this campaign." };
  }
  const grain = decideDocumentationScriptUnitGrain({
    quantity: deliverable.quantity,
    assignmentPostScheduleId,
  });
  if (grain === "invalid") {
    return {
      ok: false,
      message:
        deliverable.quantity > 1
          ? "This deliverable has multiple posts. Attach the script to a specific post."
          : "A quantity-1 deliverable script attaches to the deliverable, not a post.",
    };
  }
  if (!assignmentPostScheduleId) return { ok: true };
  const { data: post, error: postError } = await supabase
    .from("assignment_post_schedule")
    .select("id, assignment_deliverable_id")
    .eq("id", assignmentPostScheduleId)
    .maybeSingle();
  if (postError) return { ok: false, message: postError.message };
  if (!post || post.assignment_deliverable_id !== assignmentDeliverableId) {
    return { ok: false, message: "Post does not belong to this deliverable." };
  }
  return { ok: true };
}

async function loadLegacyScriptRow(
  supabase: Supabase,
  headerId: string
): Promise<{ data: ScriptRow | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("campaign_scripts")
    .select("*")
    .eq("campaign_header_id", headerId)
    .is("assignment_deliverable_id", null)
    .is("assignment_post_schedule_id", null)
    .maybeSingle();
  if (error) return { data: null, error };
  return { data: data ?? null, error: null };
}

async function writeRevisionAndCas(
  supabase: Supabase,
  scriptRow: ScriptRow,
  input: SaveCampaignScriptInput,
  previous: Awaited<ReturnType<typeof loadCampaignScriptById>>
): Promise<SaveCampaignScriptResult> {
  const bodies = validateScriptBodies(input.bodyEn, input.bodyAr);
  if (!bodies.ok) return { ok: false, conflict: false, message: bodies.message };

  const actualRevisionId = scriptRow.current_revision_id ?? null;
  if (decideCasWrite(input.expectedCurrentRevisionId, actualRevisionId) === "conflict") {
    return {
      ok: false,
      conflict: true,
      script: previous,
      message: SCRIPT_CAS_CONFLICT_MESSAGE,
    };
  }

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

  const previousOriginal: CampaignScriptOriginalDocument | null =
    previous?.originalStoragePath && previous.originalStorageBucket
      ? {
          fileName: previous.originalFileName ?? "original-script",
          storageBucket: previous.originalStorageBucket,
          storagePath: previous.originalStoragePath,
          mimeType: previous.originalMimeType,
          fileSize: previous.originalFileSize ?? 0,
        }
      : null;

  let incomingOriginal: CampaignScriptOriginalDocument | null = input.originalDocument ?? null;
  let revisionId: string | undefined;
  if (input.originalDocumentUpload && scriptRow.assignment_deliverable_id) {
    const stored = await storeCampaignScriptOriginalDocument(supabase, {
      campaignHeaderId: scriptRow.campaign_header_id,
      assignmentDeliverableId: scriptRow.assignment_deliverable_id,
      assignmentPostScheduleId: scriptRow.assignment_post_schedule_id,
      upload: input.originalDocumentUpload,
    });
    if (!stored.ok) return { ok: false, conflict: false, message: stored.message };
    incomingOriginal = stored.document;
    revisionId = stored.revisionId;
  }

  const original = resolveOriginalDocumentForSave({
    incoming: incomingOriginal,
    previous: previousOriginal,
  });

  const revisionInsert = await supabase
    .from("campaign_script_revisions")
    .insert({
      ...(revisionId ? { id: revisionId } : {}),
      script_id: scriptRow.id,
      campaign_header_id: scriptRow.campaign_header_id,
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
      original_file_name: original?.fileName ?? input.originalFileName ?? null,
      original_storage_bucket: original?.storageBucket ?? null,
      original_storage_path: original?.storagePath ?? null,
      original_mime_type: original?.mimeType ?? null,
      original_file_size: original?.fileSize ?? null,
      change_summary: input.changeSummary ?? null,
      assignment_id: null,
    })
    .select("*")
    .maybeSingle();

  if (revisionInsert.error || !revisionInsert.data) {
    if (revisionInsert.error && isUniqueViolation(revisionInsert.error)) {
      const script = await loadCampaignScriptById(supabase, scriptRow.id);
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
    const script = await loadCampaignScriptById(supabase, scriptRow.id);
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

async function insertScriptRow(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    sourceLanguage: SaveCampaignScriptInput["sourceLanguage"];
    origin: SaveCampaignScriptInput["origin"];
    assignmentDeliverableId: string | null;
    assignmentPostScheduleId: string | null;
  }
): Promise<{ data: ScriptRow | null; error: { code?: string; message: string } | null }> {
  const inserted = await supabase
    .from("campaign_scripts")
    .insert({
      campaign_header_id: input.campaignHeaderId,
      source_language: input.sourceLanguage,
      status: "current",
      origin: input.origin,
      assignment_deliverable_id: input.assignmentDeliverableId,
      assignment_post_schedule_id: input.assignmentPostScheduleId,
    })
    .select("*")
    .maybeSingle();
  return { data: inserted.data ?? null, error: inserted.error };
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

  const scriptId = input.scriptId?.trim() || null;
  if (scriptId) {
    const { data: existing, error } = await supabase
      .from("campaign_scripts")
      .select("*")
      .eq("id", scriptId)
      .eq("campaign_header_id", headerId)
      .maybeSingle();
    if (error) return { ok: false, conflict: false, message: error.message };
    if (!existing) return { ok: false, conflict: false, message: "Script was not found." };
    const previous = await loadCampaignScriptById(supabase, existing.id);
    return writeRevisionAndCas(supabase, existing, input, previous);
  }

  if (input.unit) {
    return saveCampaignScriptForUnit(supabase, input);
  }

  const { data: existing, error: existingError } = await loadLegacyScriptRow(supabase, headerId);
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
    const inserted = await insertScriptRow(supabase, {
      campaignHeaderId: headerId,
      sourceLanguage: input.sourceLanguage,
      origin: input.origin,
      assignmentDeliverableId: null,
      assignmentPostScheduleId: null,
    });
    if (inserted.error) {
      if (!isUniqueViolation(inserted.error)) {
        return { ok: false, conflict: false, message: inserted.error.message };
      }
      const raced = await loadLegacyScriptRow(supabase, headerId);
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
  return writeRevisionAndCas(supabase, scriptRow, input, previous);
}

export async function saveCampaignScriptForUnit(
  supabase: Supabase,
  input: SaveCampaignScriptInput
): Promise<SaveCampaignScriptResult> {
  const bodies = validateScriptBodies(input.bodyEn, input.bodyAr);
  if (!bodies.ok) return { ok: false, conflict: false, message: bodies.message };
  if (!input.unit) {
    return { ok: false, conflict: false, message: "Documentation unit is missing." };
  }

  const parsed = parseCampaignScriptDocumentationUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.unit.assignmentDeliverableId,
    assignmentPostScheduleId: input.unit.assignmentPostScheduleId,
  });
  if (isCampaignScriptUnitParseFailure(parsed)) {
    return { ok: false, conflict: false, message: parsed.message };
  }

  const grain = await loadDeliverableGrain(
    supabase,
    parsed.campaignHeaderId,
    parsed.assignmentDeliverableId,
    parsed.assignmentPostScheduleId
  );
  if (!grain.ok) {
    return { ok: false, conflict: false, message: grain.message };
  }

  let query = supabase
    .from("campaign_scripts")
    .select("*")
    .eq("campaign_header_id", parsed.campaignHeaderId)
    .eq("assignment_deliverable_id", parsed.assignmentDeliverableId);
  query = parsed.assignmentPostScheduleId
    ? query.eq("assignment_post_schedule_id", parsed.assignmentPostScheduleId)
    : query.is("assignment_post_schedule_id", null);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) return { ok: false, conflict: false, message: existingError.message };

  const actualRevisionId = existing?.current_revision_id ?? null;
  if (decideCasWrite(input.expectedCurrentRevisionId, actualRevisionId) === "conflict") {
    const script = existing
      ? await loadCampaignScriptById(supabase, existing.id)
      : await loadCampaignScriptForUnit(supabase, parsed);
    return {
      ok: false,
      conflict: true,
      script,
      message: SCRIPT_CAS_CONFLICT_MESSAGE,
    };
  }

  let scriptRow = existing;
  if (!scriptRow) {
    const inserted = await insertScriptRow(supabase, {
      campaignHeaderId: parsed.campaignHeaderId,
      sourceLanguage: input.sourceLanguage,
      origin: input.origin,
      assignmentDeliverableId: parsed.assignmentDeliverableId,
      assignmentPostScheduleId: parsed.assignmentPostScheduleId,
    });
    if (inserted.error) {
      if (!isUniqueViolation(inserted.error)) {
        return { ok: false, conflict: false, message: inserted.error.message };
      }
      let racedQuery = supabase
        .from("campaign_scripts")
        .select("*")
        .eq("campaign_header_id", parsed.campaignHeaderId)
        .eq("assignment_deliverable_id", parsed.assignmentDeliverableId);
      racedQuery = parsed.assignmentPostScheduleId
        ? racedQuery.eq("assignment_post_schedule_id", parsed.assignmentPostScheduleId)
        : racedQuery.is("assignment_post_schedule_id", null);
      const raced = await racedQuery.maybeSingle();
      if (raced.error || !raced.data) {
        return { ok: false, conflict: false, message: inserted.error.message };
      }
      if (decideCasWrite(input.expectedCurrentRevisionId, raced.data.current_revision_id) === "conflict") {
        const script = await loadCampaignScriptById(supabase, raced.data.id);
        return {
          ok: false,
          conflict: true,
          script,
          message: SCRIPT_CAS_CONFLICT_MESSAGE,
        };
      }
      scriptRow = raced.data;
    } else if (!inserted.data) {
      return { ok: false, conflict: false, message: "Could not create the unit script." };
    } else {
      scriptRow = inserted.data;
    }
  }

  const previous = await loadCampaignScriptById(supabase, scriptRow.id);
  return writeRevisionAndCas(supabase, scriptRow, input, previous);
}
