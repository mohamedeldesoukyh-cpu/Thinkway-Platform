import { formatLifecycleReasonLabel } from "@/lib/document-lifecycle/reason-codes";
import type { PlannedDocumentReaction } from "@/lib/document-lifecycle/types";
import type {
  ApplyChangeImpactInput,
  ChangeImpactAssessment,
  ChangeImpactDocumentImpact,
  ChangeImpactSeverity,
} from "@/lib/change-impact/types";

function docLabel(reaction: PlannedDocumentReaction): string {
  const num = reaction.aiContext?.document_number;
  if (typeof num === "string" && num.trim()) return num.trim();
  return reaction.documentType === "vendor_io" ? "Vendor IO" : "Client IO";
}

function severityForEvent(
  input: ApplyChangeImpactInput,
  reactions: PlannedDocumentReaction[]
): ChangeImpactSeverity {
  if (input.eventType === "campaign_cancelled") return "critical";
  if (
    input.eventType === "creator_removed" ||
    input.eventType === "creator_replaced"
  ) {
    return "high";
  }

  const touchesAccepted = reactions.some(
    (r) =>
      r.fromStatus === "approved" && r.toStatus === "revision_required"
  );
  if (touchesAccepted) return "high";

  if (
    input.eventType === "creator_price_updated" ||
    input.eventType === "campaign_budget_changed"
  ) {
    return reactions.length > 0 ? "high" : "medium";
  }

  if (
    input.eventType === "deliverables_changed" ||
    input.eventType === "payment_terms_changed"
  ) {
    return reactions.length > 0 ? "medium" : "low";
  }

  return reactions.length > 0 ? "medium" : "info";
}

function documentImpactSeverity(
  reaction: PlannedDocumentReaction,
  assessmentSeverity: ChangeImpactSeverity
): ChangeImpactSeverity {
  if (reaction.toStatus === "cancelled") {
    return assessmentSeverity === "critical" ? "critical" : "high";
  }
  if (reaction.fromStatus === "approved") return "high";
  if (reaction.toStatus === "revision_required") return "medium";
  return "low";
}

function buildSummary(
  input: ApplyChangeImpactInput,
  reactions: PlannedDocumentReaction[],
  severity: ChangeImpactSeverity
): { summary: string; detail: string } {
  const reason =
    formatLifecycleReasonLabel(input.reasonCode, input.reasonDetail) ??
    input.reasonDetail;
  const vio = reactions.filter((r) => r.documentType === "vendor_io").length;
  const cio = reactions.filter((r) => r.documentType === "client_io").length;
  const docBits = [
    vio > 0 ? `${vio} Vendor IO${vio === 1 ? "" : "s"}` : null,
    cio > 0 ? `${cio} Client IO${cio === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  if (input.eventType === "campaign_cancelled") {
    return {
      summary: "Campaign cancelled — outstanding documents closed; accepted history preserved.",
      detail: `${reason}. ${docBits.length ? `Cancelled: ${docBits.join(" · ")}.` : "No open documents to cancel."} Accepted documents remain Accepted.`,
    };
  }

  if (reactions.length === 0) {
    return {
      summary: `${reason} — no issued documents required updates.`,
      detail:
        "Business change recorded. Draft / unissued documents can absorb the change without Revision Required.",
    };
  }

  const revisionCount = reactions.filter(
    (r) => r.toStatus === "revision_required"
  ).length;

  return {
    summary:
      revisionCount > 0
        ? `${reason} — ${revisionCount} document${revisionCount === 1 ? "" : "s"} require revision.`
        : `${reason} — ${docBits.join(" · ")} impacted.`,
    detail: [
      `Severity: ${severity}.`,
      docBits.length ? `Impacted: ${docBits.join(" · ")}.` : null,
      "Issued documents were not silently mutated. Regenerate and re-issue updated versions where required.",
      input.estimatedImpact?.amountDelta != null
        ? `Estimated commercial delta: ${input.estimatedImpact.amountDelta} ${input.estimatedImpact.currencyCode ?? ""}`.trim()
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Pure assessment: interpret a business change + planned document reactions.
 * Does not write to the database.
 */
export function assessBusinessChangeImpact(
  input: ApplyChangeImpactInput,
  lifecycleReactions: PlannedDocumentReaction[]
): ChangeImpactAssessment {
  const severity = severityForEvent(input, lifecycleReactions);
  const { summary, detail } = buildSummary(input, lifecycleReactions, severity);

  const documentImpacts: ChangeImpactDocumentImpact[] = lifecycleReactions.map(
    (reaction) => ({
      documentType: reaction.documentType,
      documentId: reaction.documentId,
      documentLabel: docLabel(reaction),
      fromStatus: reaction.fromStatus,
      plannedToStatus: reaction.toStatus,
      severity: documentImpactSeverity(reaction, severity),
      impactExplanation:
        reaction.toStatus === "revision_required"
          ? `${docLabel(reaction)} is no longer valid for the current commercial terms (${formatLifecycleReasonLabel(reaction.reasonCode, reaction.reasonDetail)}).`
          : reaction.toStatus === "cancelled"
            ? `${docLabel(reaction)} cancelled — execution stopped; audit history retained.`
            : `${docLabel(reaction)} impacted by business change.`,
      recommendedActions: reaction.recommendedActions.map(String),
    })
  );

  const affectedObjects = [
    {
      objectType: "campaign" as const,
      objectId: input.campaignHeaderId,
      objectLabel: "Campaign",
      role: "related" as const,
    },
    ...(input.campaignLineIds ?? []).map((id) => ({
      objectType: "campaign_line" as const,
      objectId: id,
      objectLabel: "Assignment line",
      role: "source" as const,
    })),
    ...(input.influencerId
      ? [
          {
            objectType: "influencer" as const,
            objectId: input.influencerId,
            objectLabel: "Creator",
            role: "source" as const,
          },
        ]
      : []),
    ...documentImpacts.map((d) => ({
      objectType: d.documentType as "vendor_io" | "client_io",
      objectId: d.documentId,
      objectLabel: d.documentLabel,
      role: "affected" as const,
    })),
  ];

  const needsRegenerate = documentImpacts.some(
    (d) => d.plannedToStatus === "revision_required"
  );

  const recommendedActions = needsRegenerate
    ? [
        {
          id: "regenerate_vendor_io",
          label: "Regenerate impacted Vendor IOs",
          actionTab: "vendor-io" as const,
          priority: 1,
        },
        {
          id: "review_client_io",
          label: "Review Client IO commercial impact",
          actionTab: "client-io" as const,
          priority: 2,
        },
        {
          id: "send_updated",
          label: "Send updated document versions",
          actionTab: "vendor-io" as const,
          priority: 3,
        },
      ]
    : input.eventType === "campaign_cancelled"
      ? [
          {
            id: "review_campaign",
            label: "Review cancelled campaign history",
            actionTab: "overview" as const,
            priority: 1,
          },
        ]
      : [
          {
            id: "acknowledge",
            label: "Acknowledge business change",
            actionTab: "overview" as const,
            priority: 1,
          },
        ];

  const notificationIntents =
    severity === "info" && lifecycleReactions.length === 0
      ? []
      : [
          {
            audience: "operations" as const,
            channel: "in_app" as const,
            title: summary,
            body: detail,
            payload: {
              event_type: input.eventType,
              reason_code: input.reasonCode,
              severity,
              document_count: documentImpacts.length,
            },
          },
          ...(severity === "critical" || severity === "high"
            ? [
                {
                  audience: "commercial" as const,
                  channel: "in_app" as const,
                  title: summary,
                  body: detail,
                  payload: {
                    event_type: input.eventType,
                    severity,
                  },
                },
              ]
            : []),
        ];

  const amountDelta = input.estimatedImpact?.amountDelta ?? null;

  return {
    eventType: input.eventType,
    reasonCode: input.reasonCode,
    reasonDetail: input.reasonDetail,
    severity,
    businessImpactSummary: summary,
    businessImpactDetail: detail,
    affectedObjects,
    documentImpacts,
    recommendedActions,
    notificationIntents,
    aiRecommendation: {
      summary,
      recommendBulkRegenerate: needsRegenerate && documentImpacts.length >= 2,
      estimatedImpact: {
        amountDelta,
        currencyCode: input.estimatedImpact?.currencyCode ?? null,
        note: input.estimatedImpact?.note ?? input.reasonDetail,
      },
      suggestedActions: recommendedActions.map((a) => a.label),
      confidence: needsRegenerate ? "high" : "medium",
    },
    lifecycleReactions,
  };
}
