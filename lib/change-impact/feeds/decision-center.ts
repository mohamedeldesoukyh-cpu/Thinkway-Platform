import type { DecisionBlocker } from "@/features/campaigns/lifecycle/campaign-decision-center";
import type {
  ChangeImpactDecisionSignal,
  ChangeImpactSeverity,
} from "@/lib/change-impact/types";

/**
 * Map Change Impact severity → Decision Center three-tier severity.
 * Vendor IO compliance stays operational_attention unless campaign-critical.
 */
export function mapChangeImpactToDecisionSeverity(
  severity: ChangeImpactSeverity,
  eventType: string
): DecisionBlocker["severity"] {
  if (eventType === "campaign_cancelled" || severity === "critical") {
    return "business_blocker";
  }
  if (severity === "high" || severity === "medium") {
    return "operational_attention";
  }
  return "optimization";
}

/** Convert persisted/open impact signals into Decision Center blockers. */
export function changeImpactSignalsToDecisionBlockers(
  signals: ChangeImpactDecisionSignal[],
  options?: { sinceLabel?: string }
): DecisionBlocker[] {
  const since = options?.sinceLabel ?? "Recently";

  return signals.map((signal) => {
    const severity = mapChangeImpactToDecisionSeverity(
      signal.severity,
      // Prefer high/critical mapping; event type carried in title/reason when needed
      signal.severity === "critical" ? "campaign_cancelled" : "creator_price_updated"
    );

    return {
      id: `change_impact_${signal.assessmentId}`,
      objectKind: signal.objectKind,
      objectLabel: signal.objectLabel,
      objectRef: signal.objectRef,
      recordId: signal.recordId,
      title: signal.title,
      severity,
      owner: "Operations",
      waitingFor: "Operations",
      waitingLabel: "Change impact follow-up",
      sinceLabel: since,
      reason: signal.reason,
      whyBlocks: signal.reason,
      impact: signal.impact,
      unlockLabel: signal.primaryAction,
      primaryAction: signal.primaryAction,
      actionTab: signal.actionTab,
      focusQuery:
        signal.recordId &&
        (signal.objectKind === "vendor_io" || signal.objectKind === "client_io")
          ? {
              key: "io" as const,
              value: signal.recordId,
            }
          : null,
      relatedLabel: null,
      expectedResult: "Impact addressed and documents aligned to current business terms.",
    };
  });
}

export function assessmentRowToDecisionSignal(row: {
  id: string;
  severity: ChangeImpactSeverity;
  business_impact_summary: string;
  business_impact_detail: string | null;
  recommended_actions: string[] | null;
  event_type: string;
  created_at: string;
  primary_document?: {
    document_type: string;
    document_id: string;
    document_label: string | null;
  } | null;
}): ChangeImpactDecisionSignal {
  const primaryAction =
    row.recommended_actions?.[0] ?? "Review change impact";
  const doc = row.primary_document;
  const isVendor = doc?.document_type === "vendor_io";
  const isClient = doc?.document_type === "client_io";

  return {
    assessmentId: row.id,
    severity: row.severity,
    title:
      row.severity === "critical"
        ? "Critical business change"
        : "Business change requires follow-up",
    reason: row.business_impact_summary,
    impact:
      row.business_impact_detail?.trim() ||
      "Campaign documents or commercial packaging may be out of date.",
    primaryAction,
    actionTab: isClient
      ? "client-io"
      : isVendor
        ? "vendor-io"
        : row.event_type === "campaign_cancelled"
          ? "overview"
          : "vendor-io",
    objectKind: isClient
      ? "client_io"
      : isVendor
        ? "vendor_io"
        : "campaign",
    objectLabel: isClient
      ? "Client IO"
      : isVendor
        ? "Vendor IO"
        : "Campaign",
    objectRef: doc?.document_label?.trim() || "Change impact",
    recordId: doc?.document_id ?? null,
    createdAt: row.created_at,
  };
}
