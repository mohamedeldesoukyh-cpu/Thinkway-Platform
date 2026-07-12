/**
 * Director ↔ Copilot — format a campaign review as a Copilot reply.
 *
 * Read-only: it never mutates the campaign. Each recommendation is presented for
 * human approval with its reasoning, confidence, evidence, and (when
 * applicable) the exact command that applies it through the existing Copilot.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import { reviewCampaign } from "./director-engine";
import type { DirectorReview } from "./director-types";

export type DirectorReviewResult = {
  campaignObject: CampaignObject;
  reply: string;
  changed: false;
  review: DirectorReview;
};

export function runReviewCampaign(campaignObject: CampaignObject): DirectorReviewResult {
  const review = reviewCampaign(campaignObject);

  const lines: string[] = [review.summary];
  review.recommendations.forEach((rec, index) => {
    lines.push("");
    lines.push(`${index + 1}. [${rec.confidence}] ${rec.title}`);
    lines.push(`   ${rec.recommendation}`);
    lines.push(`   Reason: ${rec.reason}`);
    if (rec.evidence.length) lines.push(`   Evidence: ${rec.evidence.join("; ")}`);
    if (rec.proposedCommand) lines.push(`   Apply: "${rec.proposedCommand}"`);
  });

  if (review.recommendations.length) {
    lines.push("");
    lines.push("Tell me to apply any of these and I'll make the change (you stay the approver).");
  }

  return { campaignObject, reply: lines.join("\n"), changed: false, review };
}
