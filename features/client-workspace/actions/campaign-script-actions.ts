"use server";

import { extractCampaignScriptText } from "@/lib/campaign-script/extract-text";
import { loadCampaignScriptMaster } from "@/lib/campaign-script/load-master";
import { saveCampaignScriptMaster } from "@/lib/campaign-script/save-master";
import { queueCampaignScriptTranslation } from "@/lib/campaign-script/queue";
import {
  detectScriptLanguage,
  isScriptLanguage,
  type CampaignScriptMasterView,
  type ScriptLanguage,
} from "@/lib/campaign-script";
import { CAMPAIGN_SCRIPT_FILE_MAX_BYTES } from "@/lib/campaign-script/types";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireCurrentCampaignContentAccess } from "../content-decisions";

export type ClientCampaignScriptActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string; conflict?: boolean; data?: T };

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

export async function loadClientCampaignScriptAction(input: {
  token: string;
}): Promise<ClientCampaignScriptActionResult<CampaignScriptMasterView | null>> {
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  try {
    const script = await loadCampaignScriptMaster(db() as never, access.campaignHeaderId);
    return { ok: true, data: script };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load the campaign script.",
    };
  }
}

export async function saveClientCampaignScriptAction(input: {
  token: string;
  expectedCurrentRevisionId: string | null;
  sourceLanguage: string;
  bodyEn: string;
  bodyAr: string;
  originalFileName?: string | null;
}): Promise<ClientCampaignScriptActionResult<CampaignScriptMasterView>> {
  const sourceLanguage = parseSourceLanguage(input.sourceLanguage);
  if (!sourceLanguage) {
    return { ok: false, message: "Choose English or Arabic as the original language." };
  }
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;

  const result = await saveCampaignScriptMaster(db() as never, {
    campaignHeaderId: access.campaignHeaderId,
    expectedCurrentRevisionId: input.expectedCurrentRevisionId,
    sourceLanguage,
    bodyEn: input.bodyEn,
    bodyAr: input.bodyAr,
    actorKind: "client",
    actorUserId: null,
    actorLabel: access.review.clientLabel?.trim() || "Client",
    origin: "client",
    reviewId: access.review.id,
    originalFileName: input.originalFileName ?? null,
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

export async function translateClientCampaignScriptAction(input: {
  token: string;
  expectedCurrentRevisionId: string | null;
  targetLanguage: string;
  confirmed?: boolean;
}): Promise<ClientCampaignScriptActionResult<CampaignScriptMasterView>> {
  const targetLanguage = parseSourceLanguage(input.targetLanguage);
  if (!targetLanguage) {
    return { ok: false, message: "Choose English or Arabic as the translation target." };
  }
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  const script = await loadCampaignScriptMaster(db() as never, access.campaignHeaderId);
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
    (await loadCampaignScriptMaster(db() as never, access.campaignHeaderId)) ?? script;
  return { ok: true, data: latest };
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
