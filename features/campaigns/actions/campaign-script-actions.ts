"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions-server";
import { extractCampaignScriptText } from "@/lib/campaign-script/extract-text";
import { loadCampaignScriptMaster } from "@/lib/campaign-script/load-master";
import { saveCampaignScriptMaster } from "@/lib/campaign-script/save-master";
import { queueCampaignScriptAssignmentTranslation, queueCampaignScriptTranslation } from "@/lib/campaign-script/queue";
import { applyMasterScriptToLineIds, customizeCampaignScriptAssignment, listCreatorScriptStatuses, loadCampaignScriptAssignmentById, previewApplyMasterScriptToLineIds, reapplyMasterToCampaignScriptAssignment } from "@/lib/campaign-script/assignments";
import {
  detectScriptLanguage,
  isScriptLanguage,
  type ApplyMasterScriptPreview,
  type ApplyMasterScriptResult,
  type CampaignScriptMasterView,
  type CreatorCampaignScriptBundle,
  type CreatorScriptStatusView,
  type ScriptLanguage,
} from "@/lib/campaign-script";
import { loadCreatorCampaignScript } from "@/lib/campaign-script/load-creator-script";
import { saveCampaignScriptOverride } from "@/lib/campaign-script/save-override";
import { CAMPAIGN_SCRIPT_FILE_MAX_BYTES } from "@/lib/campaign-script/types";
import { campaignDetailPath } from "@/lib/routing/entity-paths";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient<Database>;

export type CampaignScriptActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; conflict?: boolean; data?: T };

const campaignIdSchema = z.string().uuid();

async function getWriteActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string; fullName: string | null }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    const admin = await requirePermission(supabase, "campaigns.admin");
    if ("error" in admin) return { ok: false, message: auth.error };
    const { fullName } = await getRequestAuth();
    return { ok: true, supabase, userId: admin.userId, fullName };
  }
  const { fullName } = await getRequestAuth();
  return { ok: true, supabase, userId: auth.userId, fullName };
}

async function getReadActor(): Promise<
  | { ok: true; supabase: Supabase }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) return getWriteActor();
  return { ok: true, supabase };
}

function parseSourceLanguage(value: string): ScriptLanguage | null {
  return isScriptLanguage(value) ? value : null;
}

export async function loadCampaignScriptAction(input: {
  campaignId: string;
}): Promise<CampaignScriptActionResult<CampaignScriptMasterView | null>> {
  const parsed = campaignIdSchema.safeParse(input.campaignId);
  if (!parsed.success) return { ok: false, message: "Campaign is missing." };
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  try {
    const script = await loadCampaignScriptMaster(actor.supabase, parsed.data);
    return { ok: true, data: script };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load the campaign script.",
    };
  }
}

export async function saveCampaignScriptAction(input: {
  campaignId: string;
  expectedCurrentRevisionId: string | null;
  sourceLanguage: string;
  bodyEn: string;
  bodyAr: string;
  originalFileName?: string | null;
}): Promise<CampaignScriptActionResult<CampaignScriptMasterView>> {
  const campaignId = campaignIdSchema.safeParse(input.campaignId);
  if (!campaignId.success) return { ok: false, message: "Campaign is missing." };
  const sourceLanguage = parseSourceLanguage(input.sourceLanguage);
  if (!sourceLanguage) return { ok: false, message: "Choose English or Arabic as the original language." };

  const actor = await getWriteActor();
  if (!actor.ok) return actor;

  const result = await saveCampaignScriptMaster(actor.supabase, {
    campaignHeaderId: campaignId.data,
    expectedCurrentRevisionId: input.expectedCurrentRevisionId,
    sourceLanguage,
    bodyEn: input.bodyEn,
    bodyAr: input.bodyAr,
    actorKind: "internal",
    actorUserId: actor.userId,
    actorLabel: actor.fullName?.trim() || "Thinkway",
    origin: "internal",
    originalFileName: input.originalFileName ?? null,
  });

  if (result.ok) {
    revalidatePath(campaignDetailPath(campaignId.data));
    return { ok: true, data: result.script };
  }
  if (result.conflict) {
    return {
      ok: false,
      conflict: true,
      data: result.script ?? undefined,
      message: result.message,
    };
  }
  return { ok: false, message: result.message };
}

export async function translateCampaignScriptAction(input: {
  campaignId: string;
  expectedCurrentRevisionId: string | null;
  targetLanguage: string;
  confirmed?: boolean;
}): Promise<CampaignScriptActionResult<CampaignScriptMasterView>> {
  const campaignId = campaignIdSchema.safeParse(input.campaignId);
  if (!campaignId.success) return { ok: false, message: "Campaign is missing." };
  const targetLanguage = parseSourceLanguage(input.targetLanguage);
  if (!targetLanguage) return { ok: false, message: "Choose English or Arabic as the translation target." };
  const actor = await getWriteActor();
  if (!actor.ok) return actor;

  const script = await loadCampaignScriptMaster(actor.supabase, campaignId.data);
  if (!script) return { ok: false, message: "Save the original script before translating." };
  if (script.currentRevisionId !== input.expectedCurrentRevisionId) {
    return {
      ok: false,
      conflict: true,
      data: script,
      message: "A newer version of this script was saved. Load the latest version, then translate.",
    };
  }

  const queued = await queueCampaignScriptTranslation(actor.supabase, script, {
    targetLanguage,
    confirmed: input.confirmed,
  });
  if (!queued.ok) return { ok: false, message: queued.message };
  const latest = (await loadCampaignScriptMaster(actor.supabase, campaignId.data)) ?? script;
  revalidatePath(campaignDetailPath(campaignId.data));
  return { ok: true, data: latest };
}

export async function extractCampaignScriptFileAction(input: {
  campaignId: string;
  file: File;
}): Promise<
  CampaignScriptActionResult<{
    text: string;
    sourceLanguage: ScriptLanguage;
    mixed: boolean;
    fileName: string;
  }>
> {
  const campaignId = campaignIdSchema.safeParse(input.campaignId);
  if (!campaignId.success) return { ok: false, message: "Campaign is missing." };
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const { data: header } = await actor.supabase
    .from("campaign_headers")
    .select("id")
    .eq("id", campaignId.data)
    .maybeSingle();
  if (!header) return { ok: false, message: "Campaign is missing." };
  if (input.file.size > CAMPAIGN_SCRIPT_FILE_MAX_BYTES) {
    return { ok: false, message: "That file is too large. Upload a script file under 8 MB." };
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const extracted = await extractCampaignScriptText({
    fileName: input.file.name,
    mimeType: input.file.type,
    bytes,
  });
  if (!extracted.ok) return extracted;

  const detected = detectScriptLanguage(extracted.text);
  return {
    ok: true,
    data: {
      text: extracted.text,
      sourceLanguage: detected.language,
      mixed: detected.mixed,
      fileName: input.file.name,
    },
  };
}

const influencerIdSchema = z.string().uuid();
const assignmentIdSchema = z.string().uuid();
const lineIdsSchema = z.array(z.string().uuid()).min(1);

function revalidateCampaign(campaignId: string, deferRevalidate?: boolean) {
  if (!deferRevalidate) revalidatePath(campaignDetailPath(campaignId));
}

export async function previewApplyCampaignScriptAction(input: {
  campaignId: string;
  lineIds: string[];
}): Promise<CampaignScriptActionResult<ApplyMasterScriptPreview>> {
  const campaignId = campaignIdSchema.safeParse(input.campaignId);
  if (!campaignId.success) return { ok: false, message: "Campaign is missing." };
  const lineIds = lineIdsSchema.safeParse(input.lineIds);
  if (!lineIds.success) return { ok: false, message: "Select at least one assignment." };
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  const result = await previewApplyMasterScriptToLineIds(actor.supabase, {
    campaignHeaderId: campaignId.data,
    lineIds: lineIds.data,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.preview };
}

export async function applyCampaignScriptToLinesAction(input: {
  campaignId: string;
  lineIds: string[];
  deferRevalidate?: boolean;
}): Promise<CampaignScriptActionResult<Extract<ApplyMasterScriptResult, { ok: true }>>> {
  const campaignId = campaignIdSchema.safeParse(input.campaignId);
  if (!campaignId.success) return { ok: false, message: "Campaign is missing." };
  const lineIds = lineIdsSchema.safeParse(input.lineIds);
  if (!lineIds.success) return { ok: false, message: "Select at least one assignment." };
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const result = await applyMasterScriptToLineIds(actor.supabase, {
    campaignHeaderId: campaignId.data,
    lineIds: lineIds.data,
    actorUserId: actor.userId,
  });
  if (!result.ok) return result;
  revalidateCampaign(campaignId.data, input.deferRevalidate);
  return { ok: true, data: result };
}

export async function listCampaignScriptAssignmentStatusesAction(input: {
  campaignId: string;
}): Promise<
  CampaignScriptActionResult<{
    masterVersion: string | null;
    statuses: CreatorScriptStatusView[];
  }>
> {
  const campaignId = campaignIdSchema.safeParse(input.campaignId);
  if (!campaignId.success) return { ok: false, message: "Campaign is missing." };
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  try {
    const listed = await listCreatorScriptStatuses(actor.supabase, campaignId.data);
    return {
      ok: true,
      data: {
        masterVersion: listed.masterVersion,
        statuses: [...listed.byInfluencerId.values()],
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load script assignments.",
    };
  }
}

export async function loadCreatorCampaignScriptAction(input: {
  campaignId: string;
  influencerId: string;
}): Promise<CampaignScriptActionResult<CreatorCampaignScriptBundle>> {
  const campaignId = campaignIdSchema.safeParse(input.campaignId);
  if (!campaignId.success) return { ok: false, message: "Campaign is missing." };
  const influencerId = influencerIdSchema.safeParse(input.influencerId);
  if (!influencerId.success) return { ok: false, message: "Creator is missing." };
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  try {
    const bundle = await loadCreatorCampaignScript(actor.supabase, {
      campaignHeaderId: campaignId.data,
      influencerId: influencerId.data,
    });
    return { ok: true, data: bundle };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load the creator script.",
    };
  }
}

export async function customizeCreatorCampaignScriptAction(input: {
  assignmentId: string;
}): Promise<CampaignScriptActionResult<CreatorCampaignScriptBundle>> {
  const assignmentId = assignmentIdSchema.safeParse(input.assignmentId);
  if (!assignmentId.success) return { ok: false, message: "Script assignment is missing." };
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const result = await customizeCampaignScriptAssignment(actor.supabase, {
    assignmentId: assignmentId.data,
    actorUserId: actor.userId,
    actorLabel: actor.fullName?.trim() || "Thinkway",
  });
  if (!result.ok) return result;
  const bundle = await loadCreatorCampaignScript(actor.supabase, {
    campaignHeaderId: result.assignment.campaignHeaderId,
    influencerId: result.assignment.influencerId,
  });
  revalidateCampaign(result.assignment.campaignHeaderId);
  return { ok: true, data: bundle };
}

export async function saveCreatorCampaignScriptAction(input: {
  assignmentId: string;
  expectedCurrentRevisionId: string | null;
  sourceLanguage: string;
  bodyEn: string;
  bodyAr: string;
  originalFileName?: string | null;
}): Promise<CampaignScriptActionResult<CampaignScriptMasterView>> {
  const assignmentId = assignmentIdSchema.safeParse(input.assignmentId);
  if (!assignmentId.success) return { ok: false, message: "Script assignment is missing." };
  const sourceLanguage = parseSourceLanguage(input.sourceLanguage);
  if (!sourceLanguage) return { ok: false, message: "Choose English or Arabic as the original language." };
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assignment = await loadCampaignScriptAssignmentById(actor.supabase, assignmentId.data);
  if (!assignment) return { ok: false, message: "Script assignment was not found." };
  const result = await saveCampaignScriptOverride(actor.supabase, assignment, {
    expectedCurrentRevisionId: input.expectedCurrentRevisionId,
    sourceLanguage,
    bodyEn: input.bodyEn,
    bodyAr: input.bodyAr,
    actorKind: "internal",
    actorUserId: actor.userId,
    actorLabel: actor.fullName?.trim() || "Thinkway",
    originalFileName: input.originalFileName ?? null,
  });
  if (result.ok) {
    revalidateCampaign(assignment.campaignHeaderId);
    return { ok: true, data: result.script };
  }
  if (result.conflict) {
    return {
      ok: false,
      conflict: true,
      data: result.script ?? undefined,
      message: result.message,
    };
  }
  return { ok: false, message: result.message };
}

export async function translateCreatorCampaignScriptAction(input: {
  assignmentId: string;
  expectedCurrentRevisionId: string | null;
  targetLanguage: string;
  confirmed?: boolean;
}): Promise<CampaignScriptActionResult<CampaignScriptMasterView>> {
  const assignmentId = assignmentIdSchema.safeParse(input.assignmentId);
  if (!assignmentId.success) return { ok: false, message: "Script assignment is missing." };
  const targetLanguage = parseSourceLanguage(input.targetLanguage);
  if (!targetLanguage) return { ok: false, message: "Choose English or Arabic as the translation target." };
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assignment = await loadCampaignScriptAssignmentById(actor.supabase, assignmentId.data);
  if (!assignment) return { ok: false, message: "Script assignment was not found." };
  const bundle = await loadCreatorCampaignScript(actor.supabase, {
    campaignHeaderId: assignment.campaignHeaderId,
    influencerId: assignment.influencerId,
  });
  if (!bundle.effective || assignment.mode !== "customized") {
    return { ok: false, message: "Customize this creator before translating a creator-specific script." };
  }
  if (bundle.effective.currentRevisionId !== input.expectedCurrentRevisionId) {
    return {
      ok: false,
      conflict: true,
      data: bundle.effective,
      message: "A newer version of this script was saved. Load the latest version, then translate.",
    };
  }
  const queued = await queueCampaignScriptAssignmentTranslation(
    actor.supabase,
    assignment.id,
    bundle.effective,
    { targetLanguage, confirmed: input.confirmed }
  );
  if (!queued.ok) return { ok: false, message: queued.message };
  const latest = await loadCreatorCampaignScript(actor.supabase, {
    campaignHeaderId: assignment.campaignHeaderId,
    influencerId: assignment.influencerId,
  });
  revalidateCampaign(assignment.campaignHeaderId);
  return { ok: true, data: latest.effective ?? bundle.effective };
}

export async function reapplyMasterCreatorScriptAction(input: {
  assignmentId: string;
  confirmed: boolean;
}): Promise<CampaignScriptActionResult<CreatorCampaignScriptBundle>> {
  const assignmentId = assignmentIdSchema.safeParse(input.assignmentId);
  if (!assignmentId.success) return { ok: false, message: "Script assignment is missing." };
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const result = await reapplyMasterToCampaignScriptAssignment(actor.supabase, {
    assignmentId: assignmentId.data,
    confirmed: input.confirmed,
  });
  if (!result.ok) return result;
  const bundle = await loadCreatorCampaignScript(actor.supabase, {
    campaignHeaderId: result.assignment.campaignHeaderId,
    influencerId: result.assignment.influencerId,
  });
  revalidateCampaign(result.assignment.campaignHeaderId);
  return { ok: true, data: bundle };
}
