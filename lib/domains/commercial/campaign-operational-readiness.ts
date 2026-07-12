import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignWorkspace } from "@/lib/domains/campaign/workspace-types";
import {
  POSTING_DATE_STATUS_CONFIRMED,
  type ExecutionScheduleMetadata,
} from "@/lib/campaigns/execution-schedule-metadata";

export type CampaignOperationalReadinessItemId =
  | "campaign_lines"
  | "vendor_assignments"
  | "assignment_deliverables"
  | "commercials"
  | "posting_dates";

export type CampaignOperationalReadinessOptionalId =
  | "posting_dates_confirmed"
  | "client_io"
  | "po_budget"
  | "plan_provenance"
  | "quotation_provenance";

export type CampaignOperationalReadinessItem = {
  id: CampaignOperationalReadinessItemId | CampaignOperationalReadinessOptionalId;
  label: string;
  satisfied: boolean;
  required: boolean;
};

export type CampaignOperationalReadinessStatus = "operational_ready" | "needs_attention";

export type CampaignOperationalReadiness = {
  items: CampaignOperationalReadinessItem[];
  mandatory: CampaignOperationalReadinessItem[];
  optional: CampaignOperationalReadinessItem[];
  mandatoryMissing: CampaignOperationalReadinessItem[];
  optionalRemaining: number;
  status: CampaignOperationalReadinessStatus;
  statusLabel: string;
};

const MANDATORY_DEFINITIONS: Array<{ id: CampaignOperationalReadinessItemId; label: string }> = [
  { id: "campaign_lines", label: "Campaign Lines" },
  { id: "vendor_assignments", label: "Vendor Assignments" },
  { id: "assignment_deliverables", label: "Assignment Deliverables" },
  { id: "commercials", label: "Commercials" },
  { id: "posting_dates", label: "Posting Dates" },
];

const OPTIONAL_DEFINITIONS: Array<{ id: CampaignOperationalReadinessOptionalId; label: string }> = [
  { id: "posting_dates_confirmed", label: "Posting Dates Confirmed" },
  { id: "client_io", label: "Client IO" },
  { id: "po_budget", label: "PO / Budget" },
  { id: "plan_provenance", label: "Plan Provenance" },
  { id: "quotation_provenance", label: "Quotation Provenance" },
];

function readExecutionMetadata(
  metadata: Record<string, unknown> | null | undefined
): ExecutionScheduleMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const status = metadata.posting_date_status;
  if (status !== "tentative" && status !== "confirmed") return null;
  return metadata as ExecutionScheduleMetadata;
}

function lineHasVendor(
  line: CampaignWorkspace["lines"][number]
): boolean {
  return Boolean(
    line.influencer_id?.trim() ||
      line.campaign_influencer_id?.trim() ||
      line.assignment?.influencer_id?.trim()
  );
}

function deliverableHasCommercials(
  deliverable: AssignmentHierarchy["groups"][number]["deliverables"][number]
): boolean {
  return deliverable.revenue_before_vat > 0 && deliverable.cost_before_vat > 0;
}

function deliverableHasPostingDate(
  deliverable: AssignmentHierarchy["groups"][number]["deliverables"][number]
): boolean {
  if (deliverable.live_date?.trim()) return true;

  for (const post of deliverable.posts) {
    if (post.live_date?.trim()) return true;
    const schedule = readExecutionMetadata(post.metadata);
    if (schedule?.planned_posting_date?.trim()) return true;
    if (schedule?.posting_date_status) return true;
  }

  return false;
}

function postDateIsConfirmed(
  post: AssignmentHierarchy["groups"][number]["deliverables"][number]["posts"][number]
): boolean {
  const schedule = readExecutionMetadata(post.metadata);
  if (schedule?.posting_date_status) {
    return schedule.posting_date_status === POSTING_DATE_STATUS_CONFIRMED;
  }
  return Boolean(post.live_date?.trim());
}

function evaluateMandatoryItem(
  workspace: CampaignWorkspace,
  hierarchy: AssignmentHierarchy,
  id: CampaignOperationalReadinessItemId
): boolean {
  const groups = hierarchy.groups;
  const lines = workspace.lines;
  const allDeliverables = groups.flatMap((group) => group.deliverables);

  switch (id) {
    case "campaign_lines":
      return lines.length > 0;
    case "vendor_assignments":
      return lines.length > 0 && lines.every(lineHasVendor);
    case "assignment_deliverables":
      return (
        groups.length > 0 &&
        groups.every((group) => group.deliverables.length > 0) &&
        allDeliverables.length > 0
      );
    case "commercials":
      return allDeliverables.length > 0 && allDeliverables.every(deliverableHasCommercials);
    case "posting_dates":
      return allDeliverables.length > 0 && allDeliverables.every(deliverableHasPostingDate);
    default:
      return false;
  }
}

function evaluateOptionalItem(
  workspace: CampaignWorkspace,
  hierarchy: AssignmentHierarchy,
  id: CampaignOperationalReadinessOptionalId
): boolean {
  const allPosts = hierarchy.groups.flatMap((group) =>
    group.deliverables.flatMap((deliverable) => deliverable.posts)
  );

  switch (id) {
    case "posting_dates_confirmed":
      return allPosts.length > 0 && allPosts.every(postDateIsConfirmed);
    case "client_io":
      return Boolean(workspace.client_io);
    case "po_budget":
      return Boolean(
        workspace.po.po_number?.trim() ||
          workspace.po.po_amount_campaign_currency > 0 ||
          workspace.financials.budget > 0
      );
    case "plan_provenance":
      return Boolean(workspace.campaign_object_id?.trim());
    case "quotation_provenance":
      return Boolean(workspace.quotation_id?.trim());
    default:
      return false;
  }
}

/** Evaluate mandatory + optional operational readiness for campaign workspace. */
export function evaluateCampaignOperationalReadiness(
  workspace: CampaignWorkspace,
  hierarchy: AssignmentHierarchy
): CampaignOperationalReadiness {
  const mandatory: CampaignOperationalReadinessItem[] = MANDATORY_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    required: true,
    satisfied: evaluateMandatoryItem(workspace, hierarchy, def.id),
  }));

  const optional: CampaignOperationalReadinessItem[] = OPTIONAL_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    required: false,
    satisfied: evaluateOptionalItem(workspace, hierarchy, def.id),
  }));

  const mandatoryMissing = mandatory.filter((item) => !item.satisfied);
  const optionalRemaining = optional.filter((item) => !item.satisfied).length;
  const status: CampaignOperationalReadinessStatus =
    mandatoryMissing.length === 0 ? "operational_ready" : "needs_attention";

  return {
    items: [...mandatory, ...optional],
    mandatory,
    optional,
    mandatoryMissing,
    optionalRemaining,
    status,
    statusLabel: status === "operational_ready" ? "Operationally Ready" : "Needs Attention",
  };
}
