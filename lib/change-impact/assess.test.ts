import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assessBusinessChangeImpact } from "@/lib/change-impact/assess";
import {
  changeImpactSignalsToDecisionBlockers,
  mapChangeImpactToDecisionSeverity,
} from "@/lib/change-impact/feeds/decision-center";
import { formatChangeImpactAiBrief } from "@/lib/change-impact/feeds/ai-recommendations";
import type { PlannedDocumentReaction } from "@/lib/document-lifecycle/types";

const baseInput = {
  eventType: "creator_price_updated" as const,
  reasonCode: "creator_price_changed" as const,
  reasonDetail: "Creator price changed after document issuance.",
  campaignHeaderId: "camp-1",
  campaignLineIds: ["line-1"],
  estimatedImpact: {
    amountDelta: 12500,
    currencyCode: "EGP",
    note: "Creator price changed",
  },
};

function reaction(
  overrides: Partial<PlannedDocumentReaction> = {}
): PlannedDocumentReaction {
  return {
    documentType: "vendor_io",
    documentId: "vio-1",
    fromStatus: "approved",
    toStatus: "revision_required",
    reasonCode: "creator_price_changed",
    reasonDetail: "Creator price changed after document issuance.",
    recommendedActions: ["regenerate", "send_updated_version"],
    aiContext: { document_number: "VIO-1" },
    ...overrides,
  };
}

describe("Enterprise Change Impact Engine", () => {
  it("assigns high severity when an Accepted document becomes Revision Required", () => {
    const assessment = assessBusinessChangeImpact(baseInput, [reaction()]);
    assert.equal(assessment.severity, "high");
    assert.equal(assessment.severityLabel, "Major");
    assert.match(assessment.businessImpactSummary, /require revision/i);
    assert.equal(assessment.documentImpacts.length, 1);
    assert.equal(assessment.documentImpacts[0]?.plannedToStatus, "revision_required");
    assert.ok(assessment.recommendedActions.some((a) => /Regenerate/i.test(a.label)));
    assert.equal(assessment.responsibleOwner, "Operations");
    assert.match(assessment.explainability.whatChanged, /Creator price changed/i);
    assert.match(assessment.explainability.whatShouldHappenNext, /Regenerate/i);
    assert.equal(assessment.explainability.whoOwnsTheAction, "Operations");
    assert.equal(assessment.aiRecommendation.recommendBulkRegenerate, false);
    assert.equal(assessment.aiRecommendation.estimatedImpact?.amountDelta, 12500);
  });

  it("recommends bulk regenerate when multiple documents are outdated", () => {
    const assessment = assessBusinessChangeImpact(baseInput, [
      reaction(),
      reaction({
        documentId: "vio-2",
        aiContext: { document_number: "VIO-2" },
      }),
    ]);
    assert.equal(assessment.aiRecommendation.recommendBulkRegenerate, true);
    assert.equal(assessment.notificationIntents.length >= 1, true);
  });

  it("treats campaign cancel as critical and preserves accepted history in explanation", () => {
    const assessment = assessBusinessChangeImpact(
      {
        eventType: "campaign_cancelled",
        reasonCode: "campaign_cancelled",
        reasonDetail: "Campaign cancelled",
        campaignHeaderId: "camp-1",
      },
      [
        reaction({
          fromStatus: "sent",
          toStatus: "cancelled",
          reasonCode: "campaign_cancelled",
        }),
      ]
    );
    assert.equal(assessment.severity, "critical");
    assert.match(assessment.businessImpactDetail, /Accepted documents remain Accepted/i);
  });

  it("feeds Decision Center with mapped operational severity", () => {
    assert.equal(
      mapChangeImpactToDecisionSeverity("high", "creator_price_updated"),
      "operational_attention"
    );
    assert.equal(
      mapChangeImpactToDecisionSeverity("critical", "campaign_cancelled"),
      "business_blocker"
    );

    const blockers = changeImpactSignalsToDecisionBlockers([
      {
        assessmentId: "a1",
        severity: "high",
        severityLabel: "Major",
        title: "Business change requires follow-up",
        reason: "Creator price changed — 1 document requires revision.",
        impact: "Regenerate Vendor IO",
        primaryAction: "Regenerate impacted Vendor IOs",
        actionTab: "vendor-io",
        objectKind: "vendor_io",
        objectLabel: "Vendor IO",
        objectRef: "VIO-1",
        recordId: "vio-1",
        responsibleOwner: "Operations",
        createdAt: "2026-08-02T00:00:00Z",
      },
    ]);
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0]?.severity, "operational_attention");
    assert.equal(blockers[0]?.actionTab, "vendor-io");
  });

  it("exposes AI-ready brief without executing AI", () => {
    const assessment = assessBusinessChangeImpact(baseInput, [reaction()]);
    const brief = formatChangeImpactAiBrief(assessment.aiRecommendation);
    assert.match(brief, /AI detected/i);
    assert.match(brief, /12500/);
  });
});
