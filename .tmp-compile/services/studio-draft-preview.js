import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { normalizeCreatorId } from "./studio-draft";
function sameCreator(a, b) {
    return normalizeCreatorId(a) === normalizeCreatorId(b);
}
function mergeRecommendations(existing, incoming) {
    const existingIds = existing?.creatorIds ?? [];
    const existingReasoning = existing?.selectedReasoning ?? [];
    const existingFit = existing?.creatorFitScores ?? {};
    const seen = new Set(existingIds.map(normalizeCreatorId));
    const mergedIds = [...existingIds];
    const mergedReasoning = [...existingReasoning];
    const mergedFit = { ...existingFit };
    for (const id of incoming.creatorIds) {
        const normalized = normalizeCreatorId(id);
        if (seen.has(normalized))
            continue;
        seen.add(normalized);
        mergedIds.push(id);
    }
    for (const entry of incoming.selectedReasoning ?? []) {
        const normalized = normalizeCreatorId(entry.creatorId);
        if (mergedReasoning.some((r) => sameCreator(r.creatorId, normalized)))
            continue;
        mergedReasoning.push(entry);
    }
    for (const [id, score] of Object.entries(incoming.creatorFitScores ?? {})) {
        if (mergedFit[id] == null)
            mergedFit[id] = score;
    }
    return {
        ...existing,
        creatorIds: mergedIds,
        selectedReasoning: mergedReasoning,
        creatorFitScores: Object.keys(mergedFit).length ? mergedFit : undefined,
        rationale: incoming.rationale ?? existing?.rationale,
    };
}
/** Replay draft changes on recommendations without persisting — drives live review UI. */
export function previewRecommendationsFromDraft(recommendations, changes) {
    let next = {
        creatorIds: recommendations?.creatorIds ?? [],
        selectedReasoning: recommendations?.selectedReasoning ?? [],
        rejectedReasoning: recommendations?.rejectedReasoning,
        creatorFitScores: recommendations?.creatorFitScores,
        avgFitScore: recommendations?.avgFitScore,
        rationale: recommendations?.rationale,
    };
    const replaceShortlist = [...changes]
        .reverse()
        .find((c) => c.kind === "replace_shortlist");
    if (replaceShortlist?.kind === "replace_shortlist") {
        next = { ...replaceShortlist.payload.recommendations };
    }
    for (const change of changes) {
        if (change.kind === "merge_shortlist") {
            next = mergeRecommendations(next, change.payload.recommendations);
        }
    }
    const removedIds = new Set(changes.filter((c) => c.kind === "remove_creator").map((c) => normalizeCreatorId(c.creatorId)));
    const keep = (id) => !removedIds.has(normalizeCreatorId(id));
    for (const change of changes) {
        if (change.kind !== "replace_creator")
            continue;
        const normalized = normalizeCreatorId(change.creatorId);
        next.creatorIds = next.creatorIds.map((id) => sameCreator(id, normalized) ? change.replacement.creatorId : id);
        next.selectedReasoning = (next.selectedReasoning ?? []).map((entry) => sameCreator(entry.creatorId, normalized)
            ? { ...entry, creatorId: change.replacement.creatorId, displayName: change.replacement.displayName ?? entry.displayName }
            : entry);
    }
    const existingIds = new Set(next.creatorIds.map(normalizeCreatorId));
    for (const change of changes) {
        if (change.kind !== "add_creator")
            continue;
        const ref = change.creator;
        if (existingIds.has(normalizeCreatorId(ref.creatorId)) || !keep(ref.creatorId))
            continue;
        existingIds.add(normalizeCreatorId(ref.creatorId));
        next.creatorIds = [...next.creatorIds, ref.creatorId];
        next.selectedReasoning = [
            ...(next.selectedReasoning ?? []),
            reasoningForPreviewAddition(ref),
        ];
    }
    next.creatorIds = next.creatorIds.filter(keep);
    next.selectedReasoning = (next.selectedReasoning ?? []).filter((r) => keep(r.creatorId));
    if (next.creatorFitScores) {
        next.creatorFitScores = Object.fromEntries(Object.entries(next.creatorFitScores).filter(([id]) => keep(id)));
    }
    return next;
}
/** Merge shortlist recommendations into an existing slate — shared by preview and actions. */
export function mergeRecommendationsForApply(existing, incoming) {
    return mergeRecommendations(existing, incoming);
}
function reasoningForPreviewAddition(ref) {
    const tier = resolveCreatorTierLabel({ followers: ref.followers });
    return {
        creatorId: ref.creatorId,
        displayName: ref.displayName,
        whySelected: "Staged for addition — preview only until Apply Changes.",
        expectedRole: tier,
        audienceMatch: "",
        risk: "",
        alternative: "",
        confidence: 0.5,
        evidence: "Draft preview",
        tradeoff: "",
    };
}
/** Preview vendor decisions from staged approve/reject changes. */
export function previewVendorDecisionsFromDraft(existing, changes) {
    const decisions = { ...(existing ?? {}) };
    for (const change of changes) {
        if (change.kind === "approve_creator")
            decisions[change.creatorId] = "approved";
        if (change.kind === "reject_creator")
            decisions[change.creatorId] = "rejected";
        if (change.kind === "shortlist_creator")
            decisions[change.creatorId] = "shortlisted";
    }
    return decisions;
}
/** Apply promote/demote draft overrides on slate intelligence recommendations. */
export function previewSlateIntelligenceFromDraft(slateIntelligence, changes) {
    if (!slateIntelligence?.recommendations?.length)
        return slateIntelligence;
    const roleOverrides = new Map();
    for (const change of changes) {
        if (change.kind === "promote_main")
            roleOverrides.set(normalizeCreatorId(change.creatorId), "main");
        if (change.kind === "demote_alternative") {
            roleOverrides.set(normalizeCreatorId(change.creatorId), "maybe");
        }
    }
    if (roleOverrides.size === 0)
        return slateIntelligence;
    const recommendations = slateIntelligence.recommendations.map((rec) => {
        const override = roleOverrides.get(normalizeCreatorId(rec.creatorId));
        if (!override)
            return rec;
        return {
            ...rec,
            role: override,
            priority: override === "main" ? "high" : "medium",
        };
    });
    return { ...slateIntelligence, recommendations };
}
/** Full creators-section preview for the review UI during draft. */
export function previewCreatorsSectionFromDraft(campaignObject, draft) {
    const creatorsData = (campaignObject.sections.creators.data ?? {});
    const activeDraft = draft ?? creatorsData.studioDraft ?? { changes: [], updatedAt: "" };
    if (activeDraft.changes.length === 0)
        return creatorsData;
    const recommendations = previewRecommendationsFromDraft(creatorsData.recommendations, activeDraft.changes);
    const vendorDecisions = previewVendorDecisionsFromDraft(creatorsData.vendorDecisions, activeDraft.changes);
    const slateIntelligence = previewSlateIntelligenceFromDraft(creatorsData.slateIntelligence, activeDraft.changes);
    const replaceShortlist = [...activeDraft.changes]
        .reverse()
        .find((c) => c.kind === "replace_shortlist");
    const mergeShortlist = [...activeDraft.changes]
        .reverse()
        .find((c) => c.kind === "merge_shortlist");
    const shortlistChange = replaceShortlist ?? mergeShortlist;
    const shortlistCreatorChange = [...activeDraft.changes]
        .reverse()
        .find((c) => c.kind === "shortlist_creator" && c.linkedShortlistId);
    return {
        ...creatorsData,
        recommendations,
        vendorDecisions,
        slateIntelligence,
        ...(shortlistChange && (shortlistChange.kind === "replace_shortlist" || shortlistChange.kind === "merge_shortlist")
            ? {
                linkedShortlistId: shortlistChange.payload.shortlistId,
                phase: "shortlist",
            }
            : shortlistCreatorChange?.kind === "shortlist_creator" && shortlistCreatorChange.linkedShortlistId
                ? {
                    linkedShortlistId: shortlistCreatorChange.linkedShortlistId,
                    phase: "shortlist",
                }
                : {}),
    };
}
