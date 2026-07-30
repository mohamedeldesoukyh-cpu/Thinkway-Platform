/**
 * Release 2.1 — Enterprise Timeline event contract.
 *
 * Single spine: `audit_logs`. No parallel timeline / history tables.
 * Modules emit normalized metadata; Campaign Timeline tab projects the feed.
 */

export const ENTERPRISE_TIMELINE_SOURCE = "enterprise_timeline" as const;

/** Canonical event names shared across modules. */
export type EnterpriseTimelineEventType =
  | "campaign.created"
  | "assignment.created"
  | "assignment.updated"
  | "media_plan.created"
  | "media_plan.draft_created"
  | "media_plan.regenerated"
  | "media_plan.locked"
  | "media_plan.unlocked"
  | "media_plan.client_approved"
  | "media_plan.approved_on_behalf"
  | "media_plan.revision_created"
  | "media_plan.baseline_published"
  | "media_plan.changes_requested"
  | "media_plan.rejected"
  | "deliverable.submitted"
  | "publication.verified"
  | "performance.updated"
  | "commercial.revision"
  | "invoice.issued"
  | "payment.received";

export const ENTERPRISE_TIMELINE_EVENT_LABELS: Record<
  EnterpriseTimelineEventType,
  string
> = {
  "campaign.created": "Campaign created",
  "assignment.created": "Assignment created",
  "assignment.updated": "Assignment updated",
  "media_plan.created": "Media Plan created",
  "media_plan.draft_created": "Media Plan draft created",
  "media_plan.regenerated": "Media Plan regenerated",
  "media_plan.locked": "Media Plan locked",
  "media_plan.unlocked": "Media Plan unlocked",
  "media_plan.client_approved": "Media Plan approved by client",
  "media_plan.approved_on_behalf": "Media Plan approved on behalf",
  "media_plan.revision_created": "Media Plan revision created",
  "media_plan.baseline_published": "Media Plan baseline published",
  "media_plan.changes_requested": "Media Plan changes requested",
  "media_plan.rejected": "Media Plan rejected",
  "deliverable.submitted": "Deliverable submitted",
  "publication.verified": "Publication verified",
  "performance.updated": "Performance updated",
  "commercial.revision": "Commercial revision",
  "invoice.issued": "Invoice issued",
  "payment.received": "Payment received",
};

/**
 * Normalized metadata payload written to `audit_logs.metadata`.
 * All fields optional except `event` + `source` for contract compliance.
 */
export type EnterpriseTimelineEventMetadata = {
  source: typeof ENTERPRISE_TIMELINE_SOURCE | string;
  event: EnterpriseTimelineEventType | string;
  label: string;
  summary: string;
  campaign_id?: string;
  campaign_header_id?: string;
  /** Assignment operational backbone. */
  campaign_line_id?: string | null;
  assignment_deliverable_id?: string | null;
  assignment_post_schedule_id?: string | null;
  media_plan_id?: string | null;
  campaign_object_id?: string | null;
  version?: number | null;
  module?: string;
};

/** Map legacy Media Plan engine event types → enterprise contract names. */
export function mapMediaPlanEngineEventToEnterprise(
  type: string
): EnterpriseTimelineEventType | null {
  switch (type) {
    case "media_plan_created":
      return "media_plan.created";
    case "draft_created":
      return "media_plan.draft_created";
    case "media_plan_regenerated":
      return "media_plan.regenerated";
    case "media_plan_locked":
      return "media_plan.locked";
    case "media_plan_unlocked":
      return "media_plan.unlocked";
    case "client_approved":
      return "media_plan.client_approved";
    case "approved_on_behalf":
      return "media_plan.approved_on_behalf";
    case "revision_created":
      return "media_plan.revision_created";
    case "baseline_published":
      return "media_plan.baseline_published";
    case "changes_requested":
      return "media_plan.changes_requested";
    case "rejected":
      return "media_plan.rejected";
    default:
      return null;
  }
}

export function buildEnterpriseTimelineMetadata(
  partial: Omit<EnterpriseTimelineEventMetadata, "source" | "label"> & {
    label?: string;
    source?: string;
  }
): EnterpriseTimelineEventMetadata {
  const event = partial.event;
  const knownLabel =
    event in ENTERPRISE_TIMELINE_EVENT_LABELS
      ? ENTERPRISE_TIMELINE_EVENT_LABELS[event as EnterpriseTimelineEventType]
      : null;
  return {
    source: partial.source ?? ENTERPRISE_TIMELINE_SOURCE,
    event,
    label: partial.label?.trim() || knownLabel || String(event),
    summary: partial.summary,
    campaign_id: partial.campaign_id,
    campaign_header_id: partial.campaign_header_id,
    campaign_line_id: partial.campaign_line_id ?? null,
    assignment_deliverable_id: partial.assignment_deliverable_id ?? null,
    assignment_post_schedule_id: partial.assignment_post_schedule_id ?? null,
    media_plan_id: partial.media_plan_id ?? null,
    campaign_object_id: partial.campaign_object_id ?? null,
    version: partial.version ?? null,
    module: partial.module,
  };
}
