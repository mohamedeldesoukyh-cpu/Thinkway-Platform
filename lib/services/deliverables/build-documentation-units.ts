/**
 * Build documentation units from Assignment hierarchy (D1 granularity).
 */

import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

import {
  documentationUnitKey,
  type DocumentationUnitSummary,
} from "./documentation-types";

export type AssetAgg = {
  contentAssetCount: number;
  totalAssetCount: number;
  revisionCount: number;
  latestVersionLabel: string | null;
  lastUpdatedAt: string | null;
  publicationLinkCount: number;
};

export const emptyAgg = (): AssetAgg => ({
  contentAssetCount: 0,
  totalAssetCount: 0,
  revisionCount: 0,
  latestVersionLabel: null,
  lastUpdatedAt: null,
  publicationLinkCount: 0,
});

export function applyDocumentationAggregates(
  units: DocumentationUnitSummary[],
  aggregates: Record<string, AssetAgg>
): DocumentationUnitSummary[] {
  return units.map((unit) => {
    const agg = aggregates[unit.unitKey] ?? emptyAgg();
    return {
      ...unit,
      ...agg,
      received: agg.contentAssetCount > 0,
    };
  });
}

export function buildDocumentationUnitsFromHierarchy(
  hierarchy: AssignmentHierarchy,
  campaignHeaderId: string,
  aggregates: Map<string, AssetAgg>
): DocumentationUnitSummary[] {
  const units: DocumentationUnitSummary[] = [];

  for (const group of hierarchy.groups ?? []) {
    const line = group.line;
    const creatorId = line.influencer_id ?? null;
    const creatorName = line.influencer_name ?? null;
    const assignmentName = line.name ?? line.document_number ?? "Assignment";

    for (const deliverable of group.deliverables ?? []) {
      if (deliverable.is_synthetic) continue;
      const qty = Math.max(1, Number(deliverable.quantity ?? 1));
      const posts = [...(deliverable.posts ?? [])].sort(
        (a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0)
      );
      const typeLabel =
        deliverable.deliverable_type_label ||
        deliverable.deliverable_type?.replace(/_/g, " ") ||
        "Deliverable";
      const platform = deliverable.platform ?? null;

      if (qty === 1) {
        const unitKey = documentationUnitKey(deliverable.id, null);
        const agg = aggregates.get(unitKey) ?? emptyAgg();
        units.push({
          unitKey,
          campaignHeaderId,
          assignmentDeliverableId: deliverable.id,
          assignmentPostScheduleId: null,
          sequenceNumber: null,
          label: typeLabel,
          creatorId,
          creatorName,
          assignmentLineId: line.id,
          assignmentName,
          platform,
          deliverableType: deliverable.deliverable_type ?? null,
          dueDate: deliverable.live_date ?? posts[0]?.live_date ?? null,
          quantity: qty,
          received: agg.contentAssetCount > 0,
          ...agg,
        });
        continue;
      }

      for (let i = 0; i < qty; i += 1) {
        const post = posts[i] ?? null;
        const sequenceNumber = post?.sequence_number ?? i + 1;
        const unitKey = post
          ? documentationUnitKey(deliverable.id, post.id)
          : `d:${deliverable.id}:seq:${sequenceNumber}`;
        const agg = aggregates.get(unitKey) ?? emptyAgg();
        units.push({
          unitKey,
          campaignHeaderId,
          assignmentDeliverableId: deliverable.id,
          assignmentPostScheduleId: post?.id ?? null,
          sequenceNumber,
          label: `${typeLabel} (#${sequenceNumber})`,
          creatorId,
          creatorName,
          assignmentLineId: line.id,
          assignmentName,
          platform,
          deliverableType: deliverable.deliverable_type ?? null,
          dueDate: post?.live_date ?? deliverable.live_date ?? null,
          quantity: qty,
          received: agg.contentAssetCount > 0,
          ...agg,
        });
      }
    }
  }

  return units;
}
