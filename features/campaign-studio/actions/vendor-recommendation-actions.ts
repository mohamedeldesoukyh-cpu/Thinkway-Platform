"use server";

import { createShortlistV2, addCreatorsToShortlistsV2 } from "@/features/discovery/shortlists/actions";

import {
  stageStudioDraftChangeAction,
  unstageStudioDraftChangeAction,
} from "./studio-draft-actions";
import { resolveGeneratedShortlistName } from "../services/studio-creator-selection";

export type VendorRecommendationDecision = "approved" | "rejected" | "shortlisted";

export type VendorRecommendationActionResult = {
  ok: boolean;
  message: string;
  vendorDecisions?: Record<string, VendorRecommendationDecision>;
  linkedShortlistId?: string;
  shortlistUrl?: string;
  draft?: import("@/features/campaign-intelligence/types/section-schemas").StudioDraftState;
};

export async function decideVendorRecommendationAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  decision: "approved" | "rejected";
  displayName?: string;
}): Promise<VendorRecommendationActionResult> {
  try {
    const kind = input.decision === "approved" ? "approve_creator" : "reject_creator";
    const result = await stageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      change: {
        kind,
        creatorId: input.creatorId,
        displayName: input.displayName,
      },
    });

    if (!result.ok) return { ok: false, message: result.message };

    /*
     * The draft, and nothing else.
     *
     * This used to rebuild `vendorDecisions` from the draft changes alone and
     * the caller REPLACED its state with it — so an already-applied decision
     * vanished, and because the rebuild ignored `shortlist_creator`, approving
     * a selected creator wiped its selection. Approval and selection are
     * separate facts; `resolveCreatorDecisionState` derives both from the
     * persisted decisions plus this draft, without flattening either away.
     */
    return {
      ok: true,
      message:
        input.decision === "approved"
          ? "Approval staged — apply changes to commit."
          : "Rejection staged — apply changes to commit.",
      draft: result.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stage decision.",
    };
  }
}

/**
 * Clear ONE staged decision for a creator, leaving its others intact.
 *
 * Unapproving must not drop a shortlist selection, and removing from the
 * selection must not unapprove — the two were coupled because the unstage path
 * removed every change for the creator.
 */
export async function clearVendorDecisionAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  decision: "approved" | "selected";
}): Promise<VendorRecommendationActionResult> {
  try {
    const result = await unstageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      creatorId: input.creatorId,
      kind: input.decision === "approved" ? "approve_creator" : "shortlist_creator",
    });

    if (!result.ok) return { ok: false, message: result.message };

    return {
      ok: true,
      message: input.decision === "approved" ? "Approval removed." : "Removed from the selection.",
      draft: result.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update the decision.",
    };
  }
}

export async function stageVendorRoleAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  role: "main" | "alternative";
  displayName?: string;
}): Promise<VendorRecommendationActionResult> {
  try {
    const kind = input.role === "main" ? "promote_main" : "demote_alternative";
    const result = await stageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      change: {
        kind,
        creatorId: input.creatorId,
        displayName: input.displayName,
      },
    });
    if (!result.ok) return { ok: false, message: result.message };
    return {
      ok: true,
      message:
        input.role === "main"
          ? "Promote to main staged — apply changes to commit."
          : "Move to alternatives staged — apply changes to commit.",
      draft: result.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stage role change.",
    };
  }
}

/**
 * Put a creator on the Studio SELECTION. Nothing is persisted to a shortlist.
 *
 * This replaces `shortlistVendorRecommendationAction`, which called
 * `createShortlistV2` and `addCreatorsToShortlistsV2` on every "+ Shortlist"
 * click. That made selecting a creator the same operation as generating a
 * shortlist: the first pick created a shortlist, and because the linked id is
 * only persisted when the draft is APPLIED, a fresh unapplied draft created
 * another one on the next pick — hence separate shortlists appearing mid-
 * selection instead of one intentional shortlist at the end.
 *
 * Three operations, kept apart:
 *   A. selecting a creator      — this action: stage a draft change only;
 *   B. applying a Studio draft  — `applyStudioDraftAction`, unchanged;
 *   C. generating a shortlist   — `generateStudioShortlistAction`, and only
 *      from the confirmed Generate Shortlist dialog.
 *
 * No shortlist helper is reachable from here.
 */
export async function selectCreatorForShortlistAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  displayName?: string;
}): Promise<VendorRecommendationActionResult> {
  try {
    const stageResult = await stageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      change: {
        kind: "shortlist_creator",
        creatorId: input.creatorId,
        displayName: input.displayName,
      },
    });

    if (!stageResult.ok) return { ok: false, message: stageResult.message };

    // The draft only — see `decideVendorRecommendationAction`. A flattened
    // decision map cannot carry approval and selection for one creator.
    return {
      ok: true,
      message: "Added to the selection.",
      draft: stageResult.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update the selection.",
    };
  }
}

export type GenerateStudioShortlistResult = {
  ok: boolean;
  message: string;
  /** Creators actually written to the shortlist by this call. */
  added?: number;
  /** Creators that were already on it — still part of the generated shortlist. */
  alreadyOnList?: number;
  /** The selection size this generation covered. */
  selectedCount?: number;
  linkedShortlistId?: string;
  shortlistUrl?: string;
};

/**
 * The ONLY place the Studio selection flow writes a shortlist.
 *
 * One call for the whole selection, so A, B, C, D become one shortlist with
 * four creators rather than four shortlists with one each. It uses the same two
 * helpers as the rest of the product — `createShortlistV2` and
 * `addCreatorsToShortlistsV2`, the latter built to take an array — and adds no
 * shortlist mechanism or identifier of its own.
 *
 * The campaign name is optional. `resolveGeneratedShortlistName` owns that
 * policy: with a name the shortlist is "<campaign> — Studio picks", without one
 * it carries the product's existing reference label. Generation is never
 * blocked for want of a name, and no campaign name is invented.
 *
 * The result reports what the helper actually did — added, already on the list,
 * and the selection size — so the UI cannot claim a success the write did not
 * produce.
 */
export async function generateStudioShortlistAction(input: {
  conversationId: string;
  messageId: string;
  /** Canonical unified ids for the selected creators. */
  creatorUnifiedIds: string[];
  /**
   * `new` creates one shortlist for the selection; `existing` adds the
   * selection to the shortlist the operator chose. Defaults to `new`, the
   * safer behaviour.
   */
  mode?: "new" | "existing";
  /** Required for `existing` — the shortlist the operator picked. */
  shortlistId?: string;
  /** Read for `new` only. Optional by design, and ignored for `existing`. */
  campaignName?: string;
}): Promise<GenerateStudioShortlistResult> {
  try {
    const unifiedIds = [...new Set(input.creatorUnifiedIds.map((id) => id.trim()).filter(Boolean))];
    if (unifiedIds.length === 0) {
      return { ok: false, message: "Select at least one creator before generating a shortlist." };
    }

    const mode = input.mode ?? "new";

    /*
     * ONE write, whichever branch runs.
     *
     * `existing` adds the whole selection to the shortlist the operator chose —
     * it never creates a shortlist, never renames the chosen one, and never
     * reads a campaign name, because the operator already named that list.
     */
    let shortlistId: string | undefined;
    if (mode === "existing") {
      shortlistId = input.shortlistId?.trim();
      if (!shortlistId) {
        return { ok: false, message: "Choose a shortlist to add these creators to." };
      }
    } else {
      const created = await createShortlistV2({
        name: resolveGeneratedShortlistName(input.campaignName),
        visibility: "private",
      });
      shortlistId = created.id;
    }

    const addResult = await addCreatorsToShortlistsV2({
      shortlistIds: [shortlistId],
      creators: unifiedIds.map((unifiedId) => ({ unifiedId })),
    });

    if (!addResult.ok) {
      return {
        ok: false,
        message: addResult.message ?? "Could not generate the shortlist.",
        selectedCount: unifiedIds.length,
        linkedShortlistId: shortlistId,
      };
    }

    const added = addResult.added ?? 0;
    const alreadyOnList = addResult.alreadyOnList ?? 0;

    /*
     * Report what the write did, never the selection size. The helper already
     * skips creators that are on the list, so a duplicate is impossible — and
     * saying "8 added" when 6 were added would be a lie.
     */
    const parts = [`${unifiedIds.length} selected`];
    if (added > 0) parts.push(`${added} added`);
    if (alreadyOnList > 0) parts.push(`${alreadyOnList} already in shortlist`);
    if (added === 0 && alreadyOnList === 0) parts.push("nothing to add");

    return {
      ok: true,
      message:
        mode === "existing"
          ? `Added to shortlist — ${parts.join(", ")}.`
          : `Shortlist generated — ${parts.join(", ")}.`,
      added,
      alreadyOnList,
      selectedCount: unifiedIds.length,
      linkedShortlistId: shortlistId,
      shortlistUrl: `/discovery/shortlists/${shortlistId}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not generate the shortlist.",
    };
  }
}
