"use server";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { commitCreatorSlateAndRegeneratePlan } from "../services/commit-creator-slate";
import { applyStudioDraftChanges, getStudioDraft, stageDraftChange, unstageDraftChange, updateDraftCreatorEnrichment, withStudioDraft, } from "../services/studio-draft";
import { previewCreatorsSectionFromDraft } from "../services/studio-draft-preview";
import { persistCampaignObjectOnMessage, requireStudioUser, } from "./persist-campaign-object-on-message";
async function patchDraftOnMessage(ref, patch) {
    const { userId } = await requireStudioUser();
    const next = await persistCampaignObjectOnMessage(ref.conversationId, ref.messageId, userId, (object) => withStudioDraft(object, patch(getStudioDraft(object))));
    return next ? getStudioDraft(next) : null;
}
function stageMessageForKind(kind) {
    switch (kind) {
        case "remove_creator":
            return "Removal staged — apply changes to regenerate the plan.";
        case "add_creator":
            return "Creator staged for addition — apply changes to commit.";
        case "replace_creator":
            return "Replacement staged — apply changes to commit.";
        case "replace_shortlist":
            return "Shortlist replace staged — apply changes to commit.";
        case "merge_shortlist":
            return "Shortlist merge staged — apply changes to commit.";
        case "approve_creator":
            return "Approval staged — apply changes to commit.";
        case "reject_creator":
            return "Rejection staged — apply changes to commit.";
        case "promote_main":
            return "Promote to main staged — apply changes to commit.";
        case "demote_alternative":
            return "Move to alternatives staged — apply changes to commit.";
        case "shortlist_creator":
            return "Shortlist staged — apply changes to commit.";
        default:
            return "Change staged — apply changes to regenerate the plan.";
    }
}
export async function stageStudioDraftChangeAction(input) {
    try {
        const change = {
            ...input.change,
            stagedAt: new Date().toISOString(),
        };
        const draft = await patchDraftOnMessage(input, (current) => stageDraftChange(current, change));
        if (!draft)
            return { ok: false, message: "Campaign studio message not found." };
        return { ok: true, message: stageMessageForKind(input.change.kind), draft };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not stage the change.",
        };
    }
}
export async function unstageStudioDraftChangeAction(input) {
    try {
        const draft = await patchDraftOnMessage(input, (current) => unstageDraftChange(current, input.creatorId));
        if (!draft)
            return { ok: false, message: "Campaign studio message not found." };
        return { ok: true, message: "Pending change undone.", draft };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not undo the change.",
        };
    }
}
export async function updateStudioDraftEnrichmentAction(input) {
    try {
        const draft = await patchDraftOnMessage(input, (current) => updateDraftCreatorEnrichment(current, input.creatorId, input.enrichmentStatus));
        if (!draft)
            return { ok: false, message: "Campaign studio message not found." };
        return { ok: true, message: "Enrichment status updated.", draft };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not update enrichment status.",
        };
    }
}
export async function discardStudioDraftAction(input) {
    try {
        const draft = await patchDraftOnMessage(input, () => ({
            changes: [],
            updatedAt: new Date().toISOString(),
        }));
        if (!draft)
            return { ok: false, message: "Campaign studio message not found." };
        return { ok: true, message: "All pending changes discarded.", draft };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not discard the draft.",
        };
    }
}
export async function previewStudioDraftAction(input) {
    try {
        const { userId } = await requireStudioUser();
        const object = await persistCampaignObjectOnMessage(input.conversationId, input.messageId, userId, (current) => current);
        if (!object)
            return { ok: false, message: "Campaign studio message not found." };
        const draft = getStudioDraft(object);
        return {
            ok: true,
            message: "Draft preview computed.",
            draft,
            preview: previewCreatorsSectionFromDraft(object, draft),
        };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not preview draft.",
        };
    }
}
/**
 * Apply Changes — one deterministic regeneration of the entire Campaign Plan.
 */
export async function applyStudioDraftAction(input) {
    try {
        const { supabase, userId } = await requireStudioUser();
        let removedCreatorIds = [];
        let addedCreatorIds = [];
        const next = await persistCampaignObjectOnMessage(input.conversationId, input.messageId, userId, async (object) => {
            const unenrichedCreatorIds = getStudioDraft(object)
                .changes.filter((c) => c.kind === "add_creator" && c.creator.enrichmentStatus !== "enriched")
                .map((c) => (c.kind === "add_creator" ? c.creator.creatorId : ""))
                .filter(Boolean);
            const result = applyStudioDraftChanges(object);
            removedCreatorIds = result.removedCreatorIds;
            addedCreatorIds = result.addedCreatorIds;
            return commitCreatorSlateAndRegeneratePlan(supabase, result.campaignObject, {
                unenrichedCreatorIds,
            });
        });
        if (!next)
            return { ok: false, message: "Campaign studio message not found." };
        await saveCampaignObject(input.conversationId, next, {
            persistToDb: true,
            supabase,
            userId,
            saveReason: "manual",
        });
        const remaining = getStudioDraft(next);
        const removedCount = removedCreatorIds.length;
        const addedCount = addedCreatorIds.length;
        const performanceData = next.sections.performance.data;
        const overallScore = performanceData?.campaignScores?.overall;
        const applied = [
            removedCount > 0 ? `${removedCount} removal${removedCount === 1 ? "" : "s"}` : null,
            addedCount > 0 ? `${addedCount} addition${addedCount === 1 ? "" : "s"}` : null,
        ]
            .filter(Boolean)
            .join(" and ");
        const scoreNote = overallScore != null ? ` Overall campaign score: ${overallScore}/100.` : "";
        return {
            ok: true,
            message: `Campaign plan regenerated — ${applied || "pending changes"} applied across slate, timeline, budget, KPIs, risks, and outputs.${scoreNote}`,
            draft: remaining,
            removedCount,
            removedCreatorIds,
            addedCreatorIds,
            overallScore,
        };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not apply updates.",
        };
    }
}
