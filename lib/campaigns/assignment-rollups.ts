import type {
  AssignmentHierarchyRollups,
} from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import { formatMarginPercent } from "@/features/billing/types";

/** Never crash the assignments grid when rollups are missing from the payload. */
export function coalesceAssignmentRollups(
  line: CampaignLineWorkspace,
  rollups?: AssignmentHierarchyRollups | null
): AssignmentHierarchyRollups {
  if (rollups && Number.isFinite(rollups.revenue)) {
    return rollups;
  }

  const revenue = Number(line.revenue) || 0;
  const cost = Number(line.cost) || 0;
  const gp = Number.isFinite(Number(line.gp)) ? Number(line.gp) : revenue - cost;
  const revenueBeforeVat = Number(line.revenue_before_vat) || revenue;

  return {
    deliverable_count: line.deliverable_count ?? 0,
    revenue,
    cost,
    gp,
    margin_percent: Number.isFinite(line.margin_percent as number)
      ? (line.margin_percent as number)
      : formatMarginPercent(revenue, gp),
    invoiced_value: 0,
    remaining_value: revenueBeforeVat,
    collected_value: 0,
  };
}
