import type { CampaignObject } from "@/features/campaign-intelligence";
import { reviewCampaign } from "@/features/campaign-outputs/director/director-engine";

import type { StudioReviewFinding } from "../components/studio-review-drawer";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";
import {
  outdatedStudioSections,
  studioFreshnessSummary,
} from "./studio-facts-freshness";
import { resolveStudioPackageReadiness } from "./studio-package-readiness";

/**
 * Project review-drawer findings from existing Studio authorities only.
 * Does not invent a parallel findings store.
 */
export function buildStudioReviewFindings(
  campaignObject: CampaignObject | null | undefined,
  draft?: StudioDraftState | null
): StudioReviewFinding[] {
  if (!campaignObject) return [];

  const findings: StudioReviewFinding[] = [];
  const outdated = outdatedStudioSections(
    campaignObject,
    draft ?? { changes: [], updatedAt: "" }
  );
  const freshness = studioFreshnessSummary(campaignObject, outdated);

  if (freshness.showBanner) {
    findings.push({
      id: "freshness",
      severity: "md",
      title: "Campaign information changed",
      detail: `Some recommendations are based on previous campaign facts ${freshness.cause}.`,
      whatToDo: "Regenerate affected outputs from the freshness banner when ready.",
    });
  }

  const readiness = resolveStudioPackageReadiness(campaignObject);
  for (const check of readiness.checks) {
    if (check.ready && check.state === "current") continue;
    if (check.state === "ready" || check.state === "current") continue;
    const severity: StudioReviewFinding["severity"] =
      check.state === "blocked" || check.state === "outdated" ? "hi" : "md";
    findings.push({
      id: `pkg-${check.id}`,
      severity,
      title: check.label,
      detail: check.reason ?? check.attention ?? `${check.label} needs attention.`,
      whatToDo: check.action,
      fixTarget: check.fixTarget,
    });
  }

  for (const issue of readiness.consistencyIssues ?? []) {
    findings.push({
      id: `consistency-${issue.key}`,
      severity: "hi",
      title: issue.label,
      detail: issue.reason,
      fixTarget: issue.fixTarget,
      whatToDo: `Resolve in ${issue.fixTarget}.`,
    });
  }

  try {
    const director = reviewCampaign(campaignObject);
    for (const rec of director.recommendations.slice(0, 8)) {
      findings.push({
        id: `dir-${rec.id}`,
        severity: rec.confidence === "High" ? "hi" : "md",
        title: rec.title,
        detail: rec.recommendation,
        whatToDo: rec.proposedCommand
          ? `Apply via Director: “${rec.proposedCommand}”`
          : rec.reason,
      });
    }
  } catch {
    /* Director review is advisory; skip if campaign object incomplete */
  }

  return findings;
}
