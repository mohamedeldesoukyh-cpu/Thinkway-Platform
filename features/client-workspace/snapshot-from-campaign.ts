import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignWorkspace } from "@/lib/domains/campaign/workspace-types";

import { buildMediaPlanSummary } from "./media-plan-summary";
import type { ClientReviewSourceSnapshot, ClientReviewSourceSnapshotCreator } from "./types";

export function snapshotCreatorsFromAssignmentHierarchy(
  hierarchy: AssignmentHierarchy
): ClientReviewSourceSnapshotCreator[] {
  const byCreator = new Map<string, ClientReviewSourceSnapshotCreator>();
  for (const group of hierarchy.groups ?? []) {
    const influencerId = group.line.influencer_id?.trim();
    if (!influencerId) continue;
    const creatorId = `inf:${influencerId}`;
    const deliverableLabels = (group.deliverables ?? [])
      .filter((row) => !row.is_synthetic)
      .map((row) => row.deliverable_type_label || row.deliverable_type?.replace(/_/g, " ") || "Deliverable")
      .filter(Boolean);
    const existing = byCreator.get(creatorId);
    if (existing) {
      const merged = new Set(
        [...(existing.deliverables?.split(", ") ?? []), ...deliverableLabels].filter(Boolean)
      );
      existing.deliverables = [...merged].join(", ");
      continue;
    }
    byCreator.set(creatorId, {
      creatorId,
      displayName: group.line.influencer_name?.trim() || "Creator",
      influencerId,
      platform: group.deliverables?.[0]?.platform ?? undefined,
      deliverables: deliverableLabels.join(", ") || undefined,
    });
  }
  return [...byCreator.values()];
}

export function snapshotFromCampaignAssignments(input: {
  workspace: Pick<
    CampaignWorkspace,
    "name" | "document_number" | "currency_code" | "client" | "brand" | "target_market"
  >;
  creators: ClientReviewSourceSnapshotCreator[];
}): ClientReviewSourceSnapshot {
  const brandName = input.workspace.brand?.name?.trim() || "Brand";
  const clientLabel =
    input.workspace.client?.name?.trim() ||
    input.workspace.client?.legal_name?.trim() ||
    brandName;
  const campaignName = input.workspace.name?.trim() || input.workspace.document_number;
  const platforms = [
    ...new Set(input.creators.map((creator) => creator.platform).filter((value): value is string => Boolean(value))),
  ];
  const deliverables = [
    ...new Set(
      input.creators.flatMap((creator) => creator.deliverables?.split(", ") ?? []).filter(Boolean)
    ),
  ];
  const snapshot: ClientReviewSourceSnapshot = {
    source: "studio",
    brandName,
    campaignName,
    clientLabel,
    market: input.workspace.target_market ?? undefined,
    platforms,
    deliverables,
    whyThisApproach: `Campaign ${input.workspace.document_number} for ${brandName}.`,
    creators: input.creators,
    content: input.creators.flatMap((creator) =>
      (creator.deliverables?.split(", ") ?? []).map((deliverable) => ({
        creatorId: creator.creatorId,
        creatorName: creator.displayName,
        platform: creator.platform ?? "",
        deliverable,
      }))
    ),
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: input.workspace.currency_code,
      creatorInvestment: 0,
      totalInvestment: 0,
      quotationTotal: 0,
      lines: [],
      selectedCount: input.creators.length,
      totalCount: input.creators.length,
    },
    creatorIds: input.creators.map((creator) => creator.creatorId),
  };
  snapshot.mediaPlanSummary = buildMediaPlanSummary(snapshot);
  return snapshot;
}
