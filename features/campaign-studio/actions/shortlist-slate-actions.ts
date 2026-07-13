"use server";

import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { getDiscoveryShortlistsV2, getShortlistDetail } from "@/features/discovery/shortlists/queries";
import type { ShortlistListRow } from "@/features/discovery/shortlists/types";

import { stageStudioDraftChangeAction } from "./studio-draft-actions";
import { buildRecommendationsFromShortlistCreators } from "../services/slate-intelligence";
import {
  persistCampaignObjectOnMessage,
  requireStudioUser,
} from "./persist-campaign-object-on-message";

export type ShortlistSlateMode = "replace" | "merge";

export type StudioShortlistOption = Pick<
  ShortlistListRow,
  "id" | "serial_number" | "name" | "client_name" | "brand_name" | "creator_count" | "status"
>;

export type ShortlistSlateActionResult = {
  ok: boolean;
  message: string;
  appliedCount?: number;
  linkedShortlistId?: string;
  draft?: import("@/features/campaign-intelligence/types/section-schemas").StudioDraftState;
};

function filterShortlistsForCampaign(
  rows: ShortlistListRow[],
  clientName?: string,
  brandName?: string
): ShortlistListRow[] {
  const clientKey = clientName?.trim().toLowerCase();
  const brandKey = brandName?.trim().toLowerCase();

  const scoped = rows.filter((row) => {
    if (brandKey && row.brand_name?.trim().toLowerCase() === brandKey) return true;
    if (clientKey && row.client_name?.trim().toLowerCase() === clientKey) return true;
    return !brandKey && !clientKey;
  });

  return scoped.length > 0 ? scoped : rows;
}

export async function listStudioShortlistsAction(input: {
  conversationId: string;
  messageId: string;
}): Promise<{ ok: true; shortlists: StudioShortlistOption[] } | { ok: false; message: string }> {
  try {
    const { supabase, userId } = await requireStudioUser();
    const next = await persistCampaignObjectOnMessage(
      input.conversationId,
      input.messageId,
      userId,
      (object) => object
    );
    if (!next) return { ok: false, message: "Campaign studio message not found." };

    const facts = getCampaignFacts(next);
    const rows = await getDiscoveryShortlistsV2();
    const filtered = filterShortlistsForCampaign(
      rows.filter((row) => row.creator_count > 0),
      facts?.clientName,
      facts?.brandName
    );

    return {
      ok: true,
      shortlists: filtered.map((row) => ({
        id: row.id,
        serial_number: row.serial_number,
        name: row.name,
        client_name: row.client_name,
        brand_name: row.brand_name,
        creator_count: row.creator_count,
        status: row.status,
      })),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load shortlists.",
    };
  }
}

/** Stage shortlist replace/merge — nothing persists until Apply Changes. */
export async function stageShortlistToSlateAction(input: {
  conversationId: string;
  messageId: string;
  shortlistId: string;
  mode: ShortlistSlateMode;
}): Promise<ShortlistSlateActionResult> {
  try {
    const detail = await getShortlistDetail(input.shortlistId);
    if (!detail) return { ok: false, message: "Shortlist not found." };
    if (detail.creators.length === 0) {
      return { ok: false, message: "Shortlist has no creators to import." };
    }

    const unifiedCreators = detail.creators
      .map((item) => item.creator)
      .filter((c): c is NonNullable<typeof c> => Boolean(c?.unified_id));

    if (unifiedCreators.length === 0) {
      return { ok: false, message: "Could not resolve creator profiles from this shortlist." };
    }

    const recommendations = buildRecommendationsFromShortlistCreators(unifiedCreators);
    if (!recommendations?.creatorIds.length) {
      return { ok: false, message: "No valid creators found in shortlist." };
    }

    const kind = input.mode === "replace" ? "replace_shortlist" : "merge_shortlist";
    const result = await stageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      change: {
        kind,
        payload: {
          shortlistId: input.shortlistId,
          shortlistName: detail.name,
          recommendations,
        },
      },
    });

    if (!result.ok) return { ok: false, message: result.message };

    const appliedCount = recommendations.creatorIds.length;
    const modeLabel = input.mode === "replace" ? "Replace" : "Merge";
    return {
      ok: true,
      message: `${modeLabel} staged — ${appliedCount} creator${appliedCount === 1 ? "" : "s"} from "${detail.name}". Apply changes to commit.`,
      appliedCount,
      linkedShortlistId: input.shortlistId,
      draft: result.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stage shortlist.",
    };
  }
}

/** @deprecated Use stageShortlistToSlateAction — kept for compatibility. */
export async function applyShortlistToSlateAction(input: {
  conversationId: string;
  messageId: string;
  shortlistId: string;
  mode: ShortlistSlateMode;
}): Promise<ShortlistSlateActionResult> {
  return stageShortlistToSlateAction(input);
}
