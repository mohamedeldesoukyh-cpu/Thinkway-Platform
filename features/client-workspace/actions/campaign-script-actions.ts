"use server";

import { z } from "zod";

import { extractCampaignScriptText } from "@/lib/campaign-script/extract-text";
import {
  loadCampaignScriptForUnit,
  listAttachedCampaignScriptPresence,
} from "@/lib/campaign-script/load-master";
import { saveCampaignScriptForUnit } from "@/lib/campaign-script/save-master";
import { queueCampaignScriptTranslation } from "@/lib/campaign-script/queue";
import {
  detectScriptLanguage,
  isScriptLanguage,
  type CampaignScriptMasterView,
  type CampaignScriptUnitPresence,
  type ScriptLanguage,
} from "@/lib/campaign-script";
import { CAMPAIGN_SCRIPT_FILE_MAX_BYTES } from "@/lib/campaign-script/types";
import { createCampaignScriptOriginalSignedUrlForUnit } from "@/lib/campaign-script/original-document";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireCurrentCampaignContentAccess } from "../content-decisions";

export type ClientCampaignScriptActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string; conflict?: boolean; data?: T };

const uuidSchema = z.string().uuid();

function db(): SupabaseClient {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Client Workspace is temporarily unavailable.");
  }
  return service;
}

function parseSourceLanguage(value: string): ScriptLanguage | null {
  return isScriptLanguage(value) ? value : null;
}

async function originalUploadFromFile(
  file: File | null | undefined
): Promise<
  | { fileName: string; mimeType: string | null; bytes: Buffer }
  | { message: string }
  | undefined
> {
  if (!file) return undefined;
  if (file.size > CAMPAIGN_SCRIPT_FILE_MAX_BYTES) {
    return { message: "That file is too large. Upload a script file under 8 MB." };
  }
  return {
    fileName: file.name,
    mimeType: file.type || null,
    bytes: Buffer.from(await file.arrayBuffer()),
  };
}

function parseClientUnit(input: {
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
}):
  | {
      ok: true;
      assignmentDeliverableId: string;
      assignmentPostScheduleId: string | null;
    }
  | { ok: false; message: string } {
  const deliverableId = uuidSchema.safeParse(input.assignmentDeliverableId);
  if (!deliverableId.success) return { ok: false, message: "Deliverable is missing." };
  const rawPost = input.assignmentPostScheduleId?.trim() || null;
  if (!rawPost) {
    return {
      ok: true,
      assignmentDeliverableId: deliverableId.data,
      assignmentPostScheduleId: null,
    };
  }
  const postId = uuidSchema.safeParse(rawPost);
  if (!postId.success) return { ok: false, message: "Post is missing." };
  return {
    ok: true,
    assignmentDeliverableId: deliverableId.data,
    assignmentPostScheduleId: postId.data,
  };
}

export async function listClientCampaignScriptPresenceAction(input: {
  token: string;
}): Promise<
  ClientCampaignScriptActionResult<Array<{ unitKey: string } & CampaignScriptUnitPresence>>
> {
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  try {
    const presence = await listAttachedCampaignScriptPresence(db() as never, access.campaignHeaderId);
    return {
      ok: true,
      data: [...presence.entries()].map(([unitKey, row]) => ({ unitKey, ...row })),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load script presence.",
    };
  }
}

export async function loadClientCampaignScriptForUnitAction(input: {
  token: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
}): Promise<ClientCampaignScriptActionResult<CampaignScriptMasterView | null>> {
  const unit = parseClientUnit(input);
  if (!unit.ok) return unit;
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  try {
    const script = await loadCampaignScriptForUnit(db() as never, {
      campaignHeaderId: access.campaignHeaderId,
      assignmentDeliverableId: unit.assignmentDeliverableId,
      assignmentPostScheduleId: unit.assignmentPostScheduleId,
    });
    return { ok: true, data: script };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load the unit script.",
    };
  }
}

export async function saveClientCampaignScriptForUnitAction(input: {
  token: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
  expectedCurrentRevisionId: string | null;
  sourceLanguage: string;
  bodyEn: string;
  bodyAr: string;
  originalFileName?: string | null;
  originalFile?: File | null;
}): Promise<ClientCampaignScriptActionResult<CampaignScriptMasterView>> {
  const sourceLanguage = parseSourceLanguage(input.sourceLanguage);
  if (!sourceLanguage) {
    return { ok: false, message: "Choose English or Arabic as the original language." };
  }
  const unit = parseClientUnit(input);
  if (!unit.ok) return unit;
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  const originalDocumentUpload = await originalUploadFromFile(input.originalFile);
  if (originalDocumentUpload && "message" in originalDocumentUpload) {
    return { ok: false, message: originalDocumentUpload.message };
  }

  const result = await saveCampaignScriptForUnit(db() as never, {
    campaignHeaderId: access.campaignHeaderId,
    expectedCurrentRevisionId: input.expectedCurrentRevisionId,
    unit: {
      assignmentDeliverableId: unit.assignmentDeliverableId,
      assignmentPostScheduleId: unit.assignmentPostScheduleId,
    },
    sourceLanguage,
    bodyEn: input.bodyEn,
    bodyAr: input.bodyAr,
    actorKind: "client",
    actorUserId: null,
    actorLabel: access.review.clientLabel?.trim() || "Client",
    origin: "client",
    reviewId: access.review.id,
    originalFileName: input.originalFileName ?? null,
    originalDocumentUpload,
  });

  if (result.ok) {
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

export async function translateClientCampaignScriptForUnitAction(input: {
  token: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
  expectedCurrentRevisionId: string | null;
  targetLanguage: string;
  confirmed?: boolean;
}): Promise<ClientCampaignScriptActionResult<CampaignScriptMasterView>> {
  const targetLanguage = parseSourceLanguage(input.targetLanguage);
  if (!targetLanguage) {
    return { ok: false, message: "Choose English or Arabic as the translation target." };
  }
  const unit = parseClientUnit(input);
  if (!unit.ok) return unit;
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  const script = await loadCampaignScriptForUnit(db() as never, {
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: unit.assignmentDeliverableId,
    assignmentPostScheduleId: unit.assignmentPostScheduleId,
  });
  if (!script) {
    return { ok: false, message: "Save the original script before translating." };
  }
  if (script.currentRevisionId !== input.expectedCurrentRevisionId) {
    return {
      ok: false,
      conflict: true,
      data: script,
      message: "A newer version of this script was saved. Load the latest version, then translate.",
    };
  }
  const queued = await queueCampaignScriptTranslation(db() as never, script, {
    targetLanguage,
    confirmed: input.confirmed,
  });
  if (!queued.ok) return { ok: false, message: queued.message };
  const latest =
    (await loadCampaignScriptForUnit(db() as never, {
      campaignHeaderId: access.campaignHeaderId,
      assignmentDeliverableId: unit.assignmentDeliverableId,
      assignmentPostScheduleId: unit.assignmentPostScheduleId,
    })) ?? script;
  return { ok: true, data: latest };
}

export async function getClientCampaignScriptOriginalDocumentUrlAction(input: {
  token: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
  download?: boolean;
}): Promise<
  ClientCampaignScriptActionResult<{ url: string; fileName: string; mimeType: string | null }>
> {
  const unit = parseClientUnit(input);
  if (!unit.ok) return unit;
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  try {
    const signed = await createCampaignScriptOriginalSignedUrlForUnit(db() as never, {
      campaignHeaderId: access.campaignHeaderId,
      assignmentDeliverableId: unit.assignmentDeliverableId,
      assignmentPostScheduleId: unit.assignmentPostScheduleId,
      download: input.download,
    });
    if (!signed.ok) return signed;
    return {
      ok: true,
      data: {
        url: signed.url,
        fileName: signed.fileName,
        mimeType: signed.mimeType,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not open the original document.",
    };
  }
}

export async function extractClientCampaignScriptFileAction(input: {
  token: string;
  file: File;
}): Promise<
  ClientCampaignScriptActionResult<{
    text: string;
    sourceLanguage: ScriptLanguage;
    mixed: boolean;
    fileName: string;
  }>
> {
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
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
