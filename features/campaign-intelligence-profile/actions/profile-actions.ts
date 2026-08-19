"use server";

import { revalidatePath } from "next/cache";

import {
  linkCampaignIntelligenceToCampaign,
  listCampaignIntelligenceForBrand,
} from "@/lib/domains/intelligence/campaign-intelligence-object";
import { requireRequestUser, type RequestUser } from "@/lib/supabase/server";

import type { StructuredBriefDocument } from "../services/structured-brief-parser/types";

import {
  extractStructuredBrief,
  isSupportedBriefFile,
  resolveBriefMime,
} from "../services/brief-document-parser";
import { detectBrandFromProfile, pickResolvedBrandId } from "../services/match-brand-from-profile";
import { loadAccessibleBrandSelectRows } from "../services/accessible-brands";
import { assertAccessibleBrandId } from "../services/assert-accessible-brand";
import {
  deleteCampaignIntelligenceProfile,
  getCampaignIntelligenceDocument,
  getCampaignIntelligenceDocumentRow,
  getCampaignIntelligenceProfileById,
  getCampaignIntelligenceProfileForConversation,
  getLatestDocumentForProfile,
  insertCampaignIntelligenceDocument,
  listDocumentsForProfile,
  listSavedCampaignIntelligenceProfiles,
  listRecentCampaignIntelligenceProfiles,
} from "../services/profile-repository";
import {
  elevatedCreateCampaignIntelligenceProfile,
  elevatedLinkDocumentToProfile,
  elevatedSetProfileSourceDocument,
  elevatedUpdateCampaignIntelligenceProfile,
} from "../services/profile-repository-elevated";
import { resolveBriefTextForExtraction } from "../services/resolve-brief-text";
import { runCampaignIntelligencePipeline } from "../services/run-intelligence-pipeline";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import {
  confirmCampaignIntelligenceProfile,
  projectConfirmedCampaignFacts,
  unconfirmCampaignIntelligenceProfile,
} from "../services/campaign-facts-spine";
import {
  normalizeCampaignIntelligenceProfile,
  profileHasExtractedData,
} from "../services/normalize-profile";
import type {
  CampaignIntelligenceProfile,
  CampaignIntelligenceProfileRow,
} from "../types/profile";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";
import type { BrandDetectionResult } from "../services/match-brand-from-profile";
import type { CampaignIntelligenceLibraryItem } from "@/lib/domains/intelligence/types";

const BUCKET = "campaign-intelligence-documents";
const MAX_BYTES = 25 * 1024 * 1024;

export type CampaignIntelligenceWorkspaceState = {
  profileId: string;
  profile: CampaignIntelligenceProfile;
  fileName: string | null;
  fileSizeBytes: number | null;
  hasExtractedData: boolean;
  parsedTextLength: number;
  parsedTextPreview?: string | null;
  brandId?: string | null;
  campaignHeaderId?: string | null;
};

export type CampaignBriefUploadPendingState = {
  documentId: string;
  fileName: string;
  fileSizeBytes: number;
  profile: CampaignIntelligenceProfile;
  brandDetection: BrandDetectionResult;
  existingForBrand: CampaignIntelligenceLibraryItem[];
};

function readUploadFile(formData: FormData): File | null {
  const entry = formData.get("file");
  if (entry == null || typeof entry !== "object") return null;
  const file = entry as File;
  if (typeof file.arrayBuffer !== "function" || !file.name) return null;
  return file;
}

async function buildWorkspaceState(
  supabase: RequestUser["supabase"],
  row: CampaignIntelligenceProfileRow
): Promise<CampaignIntelligenceWorkspaceState> {
  const profile = normalizeCampaignIntelligenceProfile(row.profile);
  const latestMeta = await getLatestDocumentForProfile(supabase, row.id);

  let fileName = latestMeta?.file_name ?? row.title ?? null;
  let parsedTextLength = latestMeta?.parsed_text_length ?? 0;
  let parsedTextPreview: string | null = null;
  if (row.source_document_id) {
    const doc = await getCampaignIntelligenceDocument(supabase, row.source_document_id);
    if (doc?.file_name) fileName = doc.file_name;
    if (doc?.parsed_text) {
      parsedTextLength = doc.parsed_text.length;
      parsedTextPreview = doc.parsed_text.slice(0, 12_000);
    }
  }

  return {
    profileId: row.id,
    profile,
    fileName,
    fileSizeBytes: latestMeta?.file_size_bytes ?? null,
    hasExtractedData: profileHasExtractedData(profile),
    parsedTextLength,
    parsedTextPreview,
    brandId: row.brand_id,
    campaignHeaderId: row.campaign_header_id,
  };
}


export async function listCampaignIntelligenceProfilesAction(): Promise<
  Array<{ id: string; title: string; brandName?: string; updatedAt: string; status: string }>
> {
  const { supabase, userId } = await requireRequestUser();
  const rows = await listSavedCampaignIntelligenceProfiles(supabase, userId);
  return rows.map((row) => ({
    id: row.id,
    title:
      row.title ??
      row.profile.campaignName ??
      row.profile.brandName ??
      "Campaign intelligence",
    brandName: row.profile.brandName,
    updatedAt: row.updated_at,
    status: row.status,
  }));
}

export async function listRecentCampaignIntelligenceProfilesAction(): Promise<
  Array<{ id: string; title: string; brandName?: string; updatedAt: string; status: string }>
> {
  const { supabase, userId } = await requireRequestUser();
  const rows = await listRecentCampaignIntelligenceProfiles(supabase, userId);
  return rows.map((row) => ({
    id: row.id,
    title:
      row.title ??
      normalizeCampaignIntelligenceProfile(row.profile).campaignName ??
      normalizeCampaignIntelligenceProfile(row.profile).brandName ??
      "Campaign intelligence",
    brandName: normalizeCampaignIntelligenceProfile(row.profile).brandName,
    updatedAt: row.updated_at,
    status: row.status,
  }));
}

/** Loads a saved brief workspace. Requires an explicit profile id — search does not auto-restore the latest upload. */
export async function loadCampaignIntelligenceWorkspaceAction(
  profileId?: string | null
): Promise<CampaignIntelligenceWorkspaceState | null> {
  const trimmedId = profileId?.trim();
  if (!trimmedId) return null;

  const { supabase } = await requireRequestUser();
  const row = await getCampaignIntelligenceProfileById(supabase, trimmedId);
  if (!row) return null;

  return buildWorkspaceState(supabase, row);
}

export async function getCampaignIntelligenceProfileAction(
  profileId: string
): Promise<CampaignIntelligenceProfileRow | null> {
  const { supabase } = await requireRequestUser();
  const row = await getCampaignIntelligenceProfileById(supabase, profileId);
  if (!row) return null;
  return {
    ...row,
    profile: normalizeCampaignIntelligenceProfile(row.profile),
  };
}

export async function getConversationCampaignIntelligenceAction(
  conversationId: string
): Promise<CampaignIntelligenceProfileRow | null> {
  const { supabase } = await requireRequestUser();
  return getCampaignIntelligenceProfileForConversation(supabase, conversationId);
}

export async function uploadCampaignBriefAction(
  formData: FormData
): Promise<
  | {
      ok: true;
      phase: "complete";
      profileId: string;
      documentId: string;
      fileName: string;
      workspace: CampaignIntelligenceWorkspaceState;
    }
  | {
      ok: true;
      phase: "brand_selection";
      pending: CampaignBriefUploadPendingState;
    }
  | { ok: false; message: string }
> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const file = readUploadFile(formData);
    const conversationId = String(formData.get("conversationId") ?? "").trim() || null;
    const brandId = String(formData.get("brandId") ?? "").trim() || null;
    const campaignHeaderId = String(formData.get("campaignHeaderId") ?? "").trim() || null;
    const skipBrandDetection = String(formData.get("skipBrandDetection") ?? "") === "true";

    if (!file) {
      return { ok: false, message: "No file provided." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, message: "File exceeds 25 MB limit." };
    }
    if (!isSupportedBriefFile(file)) {
      return { ok: false, message: "Unsupported format. Use PDF, Word, PowerPoint, TXT, MD, or RTF." };
    }

    const mimeType = resolveBriefMime(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return { ok: false, message: uploadError.message };
    }

    let parsedText: string | null = null;
    let llmBriefText: string | null = null;
    let structuredDocument: StructuredBriefDocument | null = null;
    let parseStatus: "parsed" | "failed" = "parsed";
    let parseError: string | null = null;
    try {
      const structured = await extractStructuredBrief(buffer, mimeType, file.name);
      parsedText = structured.plainText;
      llmBriefText = structured.llmText;
      structuredDocument = structured.document;
      if (!parsedText.trim()) parseStatus = "failed";
    } catch (error) {
      parseStatus = "failed";
      parseError = error instanceof Error ? error.message : "Parse failed";
    }

    if (!parsedText?.trim()) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return {
        ok: false,
        message:
          parseError ??
          "Could not read text from this file. Try a different export or paste-friendly PDF.",
      };
    }

    const extractionBriefText = llmBriefText ?? parsedText;
    const { profile: merged } = await runCampaignIntelligencePipeline({
      briefText: extractionBriefText,
      briefTextSource: "upload",
      structuredParserOutput: structuredDocument ?? undefined,
    });

    const doc = await insertCampaignIntelligenceDocument(supabase, {
      userId,
      profileId: null,
      storagePath,
      fileName: file.name,
      mimeType,
      fileSizeBytes: file.size,
      parsedText,
      llmBriefText,
      structuredDocument: structuredDocument as unknown as Record<string, unknown> | null,
      parseStatus,
      parseError,
    });

    if (!brandId || skipBrandDetection) {
      const profileForDetection = {
        ...merged,
        rawBriefExcerpt: merged.rawBriefExcerpt?.trim() || parsedText.slice(0, 500),
      };
      const brandDetection = await detectBrandFromProfile(supabase, profileForDetection);
      const accessibleBrands = await loadAccessibleBrandSelectRows(supabase);
      const resolvedBrandId = pickResolvedBrandId(
        brandDetection,
        brandId,
        accessibleBrands
      );

      if (!resolvedBrandId) {
        const existingForBrand = brandDetection.bestMatch
          ? await listCampaignIntelligenceForBrand(supabase, brandDetection.bestMatch.brandId)
          : [];

        return {
          ok: true,
          phase: "brand_selection",
          pending: {
            documentId: doc.id,
            fileName: file.name,
            fileSizeBytes: file.size,
            profile: merged,
            brandDetection,
            existingForBrand,
          },
        };
      }

      return finalizeCampaignBriefUpload({
        supabase,
        userId,
        documentId: doc.id,
        fileName: file.name,
        fileSizeBytes: file.size,
        profile: merged,
        brandId: resolvedBrandId,
        campaignHeaderId,
        conversationId,
        mode: "create",
      });
    }

    return finalizeCampaignBriefUpload({
      supabase,
      userId,
      documentId: doc.id,
      fileName: file.name,
      fileSizeBytes: file.size,
      profile: merged,
      brandId,
      campaignHeaderId,
      conversationId,
      mode: "create",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

type FinalizeUploadInput = {
  supabase: RequestUser["supabase"];
  userId: string;
  documentId: string;
  fileName: string;
  fileSizeBytes: number;
  profile: CampaignIntelligenceProfile;
  brandId?: string | null;
  campaignHeaderId?: string | null;
  conversationId?: string | null;
  mode: "create" | "link";
  linkProfileId?: string | null;
  allowMissingBrand?: boolean;
};

async function finalizeCampaignBriefUpload(
  input: FinalizeUploadInput
): Promise<
  | {
      ok: true;
      phase: "complete";
      profileId: string;
      documentId: string;
      fileName: string;
      workspace: CampaignIntelligenceWorkspaceState;
    }
  | { ok: false; message: string }
> {
  const brandId = input.brandId?.trim() || null;
  if (brandId) {
    const brandAccess = await assertAccessibleBrandId(input.supabase, brandId);
    if (!brandAccess.ok) {
      return { ok: false, message: brandAccess.message };
    }
  } else if (!input.allowMissingBrand) {
    return { ok: false, message: "Select a brand to continue." };
  }

  const title =
    input.profile.campaignName ??
    input.profile.brandName ??
    input.fileName.replace(/\.[^.]+$/, "");

  let profileId = input.linkProfileId ?? null;

  if (input.mode === "link" && profileId) {
    if (!brandId) {
      return { ok: false, message: "Select a brand to continue." };
    }
    const existingProfile = await getCampaignIntelligenceProfileById(input.supabase, profileId);
    if (!existingProfile) {
      return { ok: false, message: "Selected intelligence record was not found." };
    }
    if (existingProfile.brand_id && existingProfile.brand_id !== brandId) {
      return {
        ok: false,
        message: "Selected intelligence record belongs to a different brand.",
      };
    }

    await elevatedLinkDocumentToProfile(input.supabase, input.userId, input.documentId, profileId);

    await elevatedSetProfileSourceDocument(
      input.supabase,
      input.userId,
      profileId,
      input.documentId
    );
    await elevatedUpdateCampaignIntelligenceProfile(input.supabase, profileId, {
      userId: input.userId,
      profile: { ...input.profile, status: "saved" },
      status: "saved",
      title,
      brandId,
      campaignHeaderId: input.campaignHeaderId ?? null,
      conversationId: input.conversationId ?? null,
    });
  } else {
    const profileRow = await elevatedCreateCampaignIntelligenceProfile(input.supabase, {
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      brandId,
      campaignHeaderId: input.campaignHeaderId ?? null,
      title,
      profile: { ...input.profile, status: "saved" },
      allowMissingBrand: input.allowMissingBrand || !brandId,
    });
    profileId = profileRow.id;

    await elevatedLinkDocumentToProfile(input.supabase, input.userId, input.documentId, profileId);

    await elevatedSetProfileSourceDocument(
      input.supabase,
      input.userId,
      profileId,
      input.documentId
    );
    await elevatedUpdateCampaignIntelligenceProfile(input.supabase, profileId, {
      userId: input.userId,
      profile: { ...input.profile, status: "saved" },
      status: "saved",
      title,
      conversationId: input.conversationId ?? null,
    });
  }

  if (input.campaignHeaderId && profileId) {
    await linkCampaignIntelligenceToCampaign(input.supabase, {
      profileId,
      campaignHeaderId: input.campaignHeaderId,
      userId: input.userId,
    });
  }

  revalidatePath("/discovery/intelligence/library");
  revalidatePath("/discovery/search");

  const refreshed = await getCampaignIntelligenceProfileById(input.supabase, profileId!);
  if (!refreshed) {
    return { ok: false, message: "Profile saved but could not be loaded. Refresh the page." };
  }

  const workspace = await buildWorkspaceState(input.supabase, refreshed);

  return {
    ok: true,
    phase: "complete",
    profileId: profileId!,
    documentId: input.documentId,
    fileName: input.fileName,
    workspace,
  };
}

export async function confirmCampaignBriefUploadAction(input: {
  documentId: string;
  brandId?: string | null;
  campaignHeaderId?: string | null;
  conversationId?: string | null;
  mode: "create" | "link" | "continue_without_brand";
  linkProfileId?: string | null;
}): Promise<
  | {
      ok: true;
      profileId: string;
      documentId: string;
      fileName: string;
      workspace: CampaignIntelligenceWorkspaceState;
    }
  | { ok: false; message: string }
> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const documentId = input.documentId.trim();
    const continueWithoutBrand = input.mode === "continue_without_brand";
    const brandId = continueWithoutBrand ? "" : (input.brandId ?? "").trim();

    if (!documentId) {
      return { ok: false, message: "Upload session expired. Please upload the brief again." };
    }
    if (!continueWithoutBrand && !brandId) {
      return { ok: false, message: "Select a brand to continue." };
    }

    if (brandId) {
      const brandAccess = await assertAccessibleBrandId(supabase, brandId);
      if (!brandAccess.ok) {
        return { ok: false, message: brandAccess.message };
      }
    }

    const document = await getCampaignIntelligenceDocumentRow(supabase, documentId);
    if (!document) {
      return { ok: false, message: "Upload session expired. Please upload the brief again." };
    }
    if (document.uploaded_by !== userId) {
      return { ok: false, message: "You do not have access to this upload." };
    }
    if (document.profile_id) {
      return {
        ok: false,
        message: "This brief was already saved. Refresh the page to continue.",
      };
    }

    const resolved = resolveBriefTextForExtraction({
      profile: createEmptyCampaignIntelligenceProfile(),
      document,
    });
    if (!resolved.text.trim()) {
      return {
        ok: false,
        message: "No text extracted from this upload. Please upload the brief again.",
      };
    }

    const structuredParserOutput =
      (document.structured_document as StructuredBriefDocument | null | undefined) ?? undefined;

    const { profile: merged } = await runCampaignIntelligencePipeline({
      briefText: resolved.text,
      briefTextSource: resolved.source,
      structuredParserOutput,
    });

    const result = await finalizeCampaignBriefUpload({
      supabase,
      userId,
      documentId,
      fileName: document.file_name,
      fileSizeBytes: document.file_size_bytes ?? 0,
      profile: merged,
      brandId: brandId || null,
      campaignHeaderId: input.campaignHeaderId ?? null,
      conversationId: input.conversationId ?? null,
      mode: input.mode === "link" ? "link" : "create",
      linkProfileId: input.linkProfileId ?? null,
      allowMissingBrand: continueWithoutBrand,
    });

    if (!result.ok) return result;
    return {
      ok: true,
      profileId: result.profileId,
      documentId: result.documentId,
      fileName: result.fileName,
      workspace: result.workspace,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save brief";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return {
        ok: false,
        message:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local and restart the dev server.",
      };
    }
    return { ok: false, message };
  }
}

export async function analyzeCampaignBriefAction(
  profileId: string
): Promise<{ ok: true; profile: CampaignIntelligenceProfile } | { ok: false; message: string }> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const row = await getCampaignIntelligenceProfileById(supabase, profileId);
    if (!row) return { ok: false, message: "Profile not found." };

    const persistedProfile = normalizeCampaignIntelligenceProfile(row.profile);
    const doc = row.source_document_id
      ? await getCampaignIntelligenceDocument(supabase, row.source_document_id)
      : null;
    const resolved = resolveBriefTextForExtraction({
      profile: persistedProfile,
      document: doc,
    });

    if (!resolved.text.trim()) {
      return { ok: false, message: "No text extracted from document. Upload a readable brief." };
    }

    const structuredParserOutput =
      (doc?.structured_document as StructuredBriefDocument | null | undefined) ??
      persistedProfile.structuredBrief?.document;

    const { profile: merged } = await runCampaignIntelligencePipeline({
      briefText: resolved.text,
      briefTextSource: resolved.source,
      structuredParserOutput,
    });

    await elevatedUpdateCampaignIntelligenceProfile(supabase, profileId, {
      userId,
      profile: {
        ...merged,
        status: persistedProfile.status === "saved" ? "saved" : "draft",
      },
      title: merged.campaignName ?? merged.brandName ?? row.title,
    });

    revalidatePath("/discovery/intelligence/library");
    revalidatePath("/discovery/search");
    return { ok: true, profile: merged };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Analysis failed",
    };
  }
}

export async function updateCampaignRequirementsAction(
  profileId: string,
  requirementsText: string,
  currentProfile: CampaignIntelligenceProfile
): Promise<
  { ok: true; profile: CampaignIntelligenceProfile } | { ok: false; message: string }
> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const trimmed = requirementsText.trim();
    if (!trimmed) {
      return { ok: false, message: "Campaign requirements cannot be empty." };
    }

    const { profile: piped } = await runCampaignIntelligencePipeline({
      briefText: trimmed,
      briefTextSource: "raw_excerpt",
    });
    const merged: CampaignIntelligenceProfile = {
      ...piped,
      schemaVersion: 1,
      status: currentProfile.status === "saved" ? "saved" : "draft",
      extractedAt: new Date().toISOString(),
    };

    await elevatedUpdateCampaignIntelligenceProfile(supabase, profileId, {
      userId,
      profile: merged,
      status: merged.status,
      title: merged.campaignName ?? merged.brandName ?? undefined,
    });

    revalidatePath("/discovery/search");
    return { ok: true, profile: merged };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update requirements",
    };
  }
}

export async function deleteCampaignBriefAction(
  profileId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const trimmedId = profileId.trim();
    if (!trimmedId) {
      return { ok: false, message: "No brief to remove." };
    }

    const row = await getCampaignIntelligenceProfileById(supabase, trimmedId);
    if (!row || row.created_by !== userId) {
      return { ok: false, message: "Brief not found or access denied." };
    }

    const documents = await listDocumentsForProfile(supabase, trimmedId);
    const storagePaths = documents.map((doc) => doc.storage_path).filter(Boolean);
    if (storagePaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(storagePaths);
    }

    await deleteCampaignIntelligenceProfile(supabase, trimmedId, userId);

    revalidatePath("/discovery/intelligence/library");
    revalidatePath("/discovery/search");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not remove brief",
    };
  }
}

export async function saveCampaignIntelligenceProfileAction(
  profileId: string,
  profile: CampaignIntelligenceProfile
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const saved: CampaignIntelligenceProfile = unconfirmCampaignIntelligenceProfile({
      ...profile,
      schemaVersion: 1,
      status: "saved",
      extractedAt: profile.extractedAt ?? new Date().toISOString(),
    });

    await elevatedUpdateCampaignIntelligenceProfile(supabase, profileId, {
      userId,
      profile: saved,
      status: "saved",
      title: saved.campaignName ?? saved.brandName ?? undefined,
    });

    revalidatePath("/discovery/intelligence/library");
    revalidatePath("/discovery/search");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Save failed",
    };
  }
}

export async function confirmCampaignIntelligenceProfileAction(
  profileId: string,
  profile: CampaignIntelligenceProfile
): Promise<
  { ok: true; profile: CampaignIntelligenceProfile; facts: CampaignFacts } | { ok: false; message: string }
> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const confirmed = confirmCampaignIntelligenceProfile({
      ...profile,
      schemaVersion: 1,
      status: "saved",
      extractedAt: profile.extractedAt ?? new Date().toISOString(),
    });
    const facts = projectConfirmedCampaignFacts(confirmed);
    if (!facts) {
      return { ok: false, message: "Campaign intelligence could not be confirmed." };
    }

    await elevatedUpdateCampaignIntelligenceProfile(supabase, profileId, {
      userId,
      profile: confirmed,
      status: "saved",
      title: confirmed.campaignName ?? confirmed.brandName ?? undefined,
    });

    revalidatePath("/discovery/intelligence/library");
    revalidatePath("/discovery/search");
    return { ok: true, profile: confirmed, facts };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Confirm failed",
    };
  }
}
