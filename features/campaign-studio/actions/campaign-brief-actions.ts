"use server";

import {
  extractBriefDocumentText,
  isSupportedBriefFile,
  resolveBriefMime,
} from "@/features/campaign-intelligence-profile/services/brief-document-parser";
import {
  loadCampaignObjectFromPersistence,
  saveCampaignObject,
  serializeCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import { getOutputDefinition } from "@/features/campaign-outputs/output-catalog";
import { staleCampaignOutputKinds } from "@/features/campaign-outputs/output-registry";
import { syncLatestStudioMessageCampaignObject } from "@/features/ai-workspace/services/conversation-campaign-hydration";
import { getConversationWithMessages } from "@/features/ai-workspace/services/conversation-service";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { profileToCampaignFacts } from "@/features/campaign-intelligence-profile/services/profile-to-facts";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

import { mergeBriefIntoCampaignObject } from "../services/merge-campaign-brief";
import { reanalyzeAndPersistBriefIntelligence } from "../services/persist-reanalyzed-brief-intelligence";
import {
  campaignObjectFromLatestStudioMessage,
  resolveCampaignObjectForBriefEdit,
} from "../services/resolve-campaign-object-for-edit";
import { loadCampaignObjectFromMessage, requireStudioUser } from "./persist-campaign-object-on-message";

/** 25 MB — same ceiling as the Campaign Brief upload action. */
const MAX_BRIEF_FILE_BYTES = 25 * 1024 * 1024;

export type ExtractBriefFileTextResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; message: string };

/**
 * Signatures of an undecoded document container. A `.docx`/`.pptx` is a ZIP, so
 * reading it as text in the browser yields `PK…[Content_Types].xml…`. Nothing
 * that still looks like a container may reach the brief textarea.
 */
const BINARY_DOCUMENT_MARKERS = [
  "[Content_Types].xml",
  "word/document.xml",
  "ppt/presentation.xml",
  "\u0000",
];

const PLAIN_TEXT_BRIEF_MIME = new Set(["text/plain", "text/markdown"]);
const PLAIN_TEXT_BRIEF_EXTENSIONS = new Set(["txt", "md"]);

/** True for formats that are already UTF-8 text, needing no container parsing. */
function isPlainTextBrief(mimeType: string, fileName: string): boolean {
  if (PLAIN_TEXT_BRIEF_MIME.has(mimeType.trim().toLowerCase())) return true;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return PLAIN_TEXT_BRIEF_EXTENSIONS.has(ext);
}

function looksLikeRawDocumentContainer(text: string): boolean {
  if (text.startsWith("PK\u0003\u0004")) return true;
  if (BINARY_DOCUMENT_MARKERS.some((marker) => text.includes(marker))) return true;
  // Replacement characters mean the bytes were decoded as text, not parsed.
  const replacements = (text.match(/\uFFFD/g) ?? []).length;
  return replacements > 0 && replacements / text.length > 0.01;
}

/**
 * Read an uploaded brief file into editable text for the Edit Brief dialog.
 *
 * Runs the canonical document parser the Campaign Brief upload flow uses, so
 * `.docx`, `.pdf`, `.pptx`, `.rtf`, `.txt` and `.md` all resolve through one
 * implementation. The dialog previously used FileReader.readAsText(), which
 * put raw ZIP bytes in the textarea for every Office format.
 */
export async function extractBriefFileTextAction(
  formData: FormData
): Promise<ExtractBriefFileTextResult> {
  try {
    await requireStudioUser();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "No file provided." };
    }
    if (file.size > MAX_BRIEF_FILE_BYTES) {
      return { ok: false, message: "File exceeds 25 MB limit." };
    }
    if (!isSupportedBriefFile(file)) {
      return {
        ok: false,
        message: "Unsupported format. Use PDF, Word, PowerPoint, TXT, MD, or RTF.",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = resolveBriefMime(file);

    // Plain-text briefs are already text: decode them directly so the editable
    // content stays byte-for-byte what the author wrote. Round-tripping them
    // through the block parser would collapse the blank lines that separate
    // labelled sections. Every binary container goes to the canonical parser.
    const text = isPlainTextBrief(mimeType, file.name)
      ? buffer.toString("utf8").trim()
      : (await extractBriefDocumentText(buffer, mimeType, file.name)).trim();

    if (!text) {
      return {
        ok: false,
        message: "Could not read text from this file. Try a different export or paste the brief.",
      };
    }
    if (looksLikeRawDocumentContainer(text)) {
      return {
        ok: false,
        message: "Could not read text from this file. Try a different export or paste the brief.",
      };
    }

    return { ok: true, text, fileName: file.name };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to read the brief file.",
    };
  }
}

export type ApplyCampaignBriefInput = {
  conversationId: string;
  messageId: string;
  briefText: string;
};

export type ApplyCampaignBriefResult = {
  ok: boolean;
  message: string;
  campaignObject?: Record<string, unknown>;
  /** Re-analyzed canonical intelligence, so Intake updates without re-polling. */
  profileId?: string;
  profile?: CampaignIntelligenceProfile;
};

export async function applyCampaignBriefAction(
  input: ApplyCampaignBriefInput
): Promise<ApplyCampaignBriefResult> {
  const trimmed = input.briefText.trim();
  if (trimmed.length < 40) {
    return {
      ok: false,
      message: "Add a fuller brief — at least a short paragraph with objective, audience, and timing.",
    };
  }

  try {
    const { userId, supabase } = await requireStudioUser();
    const conversation = await getConversationWithMessages(
      supabase,
      input.conversationId,
      userId
    );
    if (!conversation) {
      return { ok: false, message: "Could not find the campaign workspace to update." };
    }

    const contextSnapshot = (conversation.contextSnapshot ?? {}) as Record<string, unknown>;
    const fromPersistence = await loadCampaignObjectFromPersistence(
      supabase,
      input.conversationId,
      contextSnapshot
    );
    const fromLatestMessage = campaignObjectFromLatestStudioMessage(conversation.messages);
    const fromBoundMessage = await loadCampaignObjectFromMessage(
      input.conversationId,
      input.messageId,
      userId
    );
    const canonical = resolveCampaignObjectForBriefEdit({
      fromPersistence,
      fromLatestStudioMessage: fromLatestMessage,
      fromBoundMessage,
    });

    if (!canonical) {
      return { ok: false, message: "Could not find the campaign workspace to update." };
    }

    const result = mergeBriefIntoCampaignObject(canonical, trimmed);
    if (!result.change) {
      return {
        ok: false,
        message: "Brief unchanged — add more detail or edit the existing text.",
      };
    }

    // The brief is the source of campaign intelligence, so an edited brief must
    // be re-analyzed — mergeBriefIntoCampaignObject deliberately carries the old
    // facts forward and never rewrites the SSOT. Operator-entered values are
    // preserved inside the re-analysis merge, keyed off both canonical records.
    let campaignObject = result.campaignObject;
    const reanalyzed = await reanalyzeAndPersistBriefIntelligence({
      supabase,
      userId,
      conversationId: input.conversationId,
      briefText: trimmed,
      previousFacts: getCampaignFacts(canonical),
    });

    if (reanalyzed) {
      campaignObject = {
        ...campaignObject,
        meta: {
          ...campaignObject.meta,
          campaignFacts: profileToCampaignFacts(reanalyzed.profile),
        },
      };
    }

    const saved = await saveCampaignObject(input.conversationId, campaignObject, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });

    await syncLatestStudioMessageCampaignObject(
      supabase,
      input.conversationId,
      userId,
      saved
    );

    const staleLabels = staleCampaignOutputKinds(saved).map(
      (kind) => getOutputDefinition(kind)?.label ?? kind
    );
    const message =
      staleLabels.length > 0
        ? `Campaign brief saved — ${staleLabels.join(", ")} need updating. Regenerate from Outputs when ready.`
        : "Campaign brief saved — creator slate preserved.";

    return {
      ok: true,
      message,
      campaignObject: serializeCampaignObject(saved) as unknown as Record<string, unknown>,
      profileId: reanalyzed?.profileId,
      profile: reanalyzed?.profile,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to save the campaign brief.",
    };
  }
}
