/**
 * AI Campaign Director — deterministic review engine.
 *
 * Reviews the complete Campaign Object and returns grounded recommendations.
 * Every rule reads only from the Campaign Object (facts + slate + benchmarks);
 * nothing is invented. The output is advice for human approval — it never
 * mutates the campaign.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import { resolveSlate, type SlateCreator } from "../output-inputs";
import { benchmarkFor, tierCounts, tierRank } from "../generators/generator-utils";
import { detectMissingInformation } from "../hydration/missing-info";
import type {
  DirectorRecommendation,
  DirectorReview,
} from "./director-types";

const CONFIDENCE_RANK = { High: 0, Medium: 1, Low: 2 } as const;

function sortedByTier(slate: SlateCreator[]): SlateCreator[] {
  return [...slate].sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

export function reviewCampaign(campaignObject: CampaignObject): DirectorReview {
  const facts = getCampaignFacts(campaignObject);
  const slate = resolveSlate(campaignObject);
  const ordered = sortedByTier(slate);
  const platforms = facts?.platforms ?? [];
  const durationWeeks = facts?.durationWeeks;
  const budget = facts?.budget;
  const counts = tierCounts(slate);
  const tierSummary = Object.entries(counts)
    .map(([tier, count]) => `${count} ${tier}`)
    .join(", ");

  const recs: DirectorRecommendation[] = [];

  // 1. Completeness — ask only for what's missing.
  const missing = detectMissingInformation(campaignObject);
  const criticalMissing = missing.missing.filter((f) =>
    (["objective", "budget", "durationWeeks", "creators"] as const).includes(f as never)
  );
  if (criticalMissing.length) {
    recs.push({
      id: "completeness",
      category: "completeness",
      title: "Complete the campaign brief",
      recommendation: `Add the missing inputs to unlock the full output set: ${missing.missingLabels.join(", ")}.`,
      reason: "Several outputs cannot be generated meaningfully until these inputs are known.",
      confidence: "High",
      evidence: [`Missing: ${missing.missingLabels.join(", ")}`],
    });
  }

  // 2. Sequencing — lead with the highest-reach creator.
  if (ordered.length >= 2 && ordered[0]?.tier) {
    const lead = ordered[0]!;
    recs.push({
      id: "sequencing-lead",
      category: "sequencing",
      title: `Lead with ${lead.displayName}`,
      recommendation: `Open the campaign with ${lead.displayName} (${lead.tier}); sequence the remaining creators by descending tier to sustain momentum.`,
      reason: `${lead.displayName} carries the largest projected reach, so leading with them maximizes early awareness and sets the narrative.`,
      confidence: "High",
      evidence: [`Creator tier mix: ${tierSummary}`],
    });
  }

  // 3. Phasing / waves — structure by duration.
  if (durationWeeks !== undefined) {
    const waves = durationWeeks >= 6 ? 3 : durationWeeks >= 3 ? 2 : 1;
    recs.push({
      id: "phasing-waves",
      category: "phasing",
      title: `Run ${waves} activation wave${waves === 1 ? "" : "s"}`,
      recommendation: `Structure the ${durationWeeks}-week flight into ${waves} wave${waves === 1 ? "" : "s"} (awareness → consideration → conversion) to pace reach and frequency.`,
      reason: "Wave planning maintains momentum and lets budget follow performance rather than front-loading everything.",
      confidence: "Medium",
      evidence: [`Campaign duration: ${durationWeeks} weeks`],
    });
  }

  // 4. Platform priority — lead with the higher-engagement platform.
  if (platforms.length >= 2) {
    const ranked = [...platforms].sort(
      (a, b) => benchmarkFor(b).engagementRate - benchmarkFor(a).engagementRate
    );
    const best = ranked[0]!;
    if (best.toLowerCase() !== platforms[0]!.toLowerCase()) {
      recs.push({
        id: "platform-priority",
        category: "platforms",
        title: `Lead with ${best}`,
        recommendation: `Prioritize ${best} as the primary platform ahead of ${platforms[0]}, then use the others for frequency.`,
        reason: `${best} has the stronger engagement benchmark, so anchoring reach there improves expected efficiency.`,
        confidence: "Medium",
        evidence: [
          `Engagement benchmarks: ${ranked
            .map((p) => `${p} ${(benchmarkFor(p).engagementRate * 100).toFixed(1)}%`)
            .join(" vs ")}`,
        ],
        proposedCommand: `Focus more on ${best} than ${platforms.filter((p) => p !== best).join(" and ")}`,
      });
    }
  }

  // 5. Service types — premium video for the leads.
  const leads = ordered.filter((c) => tierRank(c.tier) <= 1);
  if (leads.length) {
    recs.push({
      id: "service-types",
      category: "services",
      title: "Use Reels + Spark Ads on the leads",
      recommendation: `Run premium video (Reels) with paid amplification (Spark Ads / whitelisting) on ${leads.map((c) => c.displayName).join(", ")}; reserve Stories and UGC for the lower tiers.`,
      reason: "Top-tier creators return the most reach on premium video, and amplifying their best content compounds it.",
      confidence: "Medium",
      evidence: [`Lead creators: ${leads.map((c) => `${c.displayName} (${c.tier})`).join(", ")}`],
    });
  }

  // 6. Amplification window.
  if (budget) {
    recs.push({
      id: "amplification-window",
      category: "amplification",
      title: "Delay broad paid until organic stabilizes",
      recommendation: "Hold broad paid amplification until week 1 organic engagement identifies the winning content, then boost the top performers.",
      reason: "Boosting proven organic winners is more efficient than spending paid on unvalidated content.",
      confidence: "Medium",
      evidence: [`Budget available for paid: ${budget.amount.toLocaleString()} ${budget.currency}`],
    });
  }

  // 7. Budget allocation guardrails.
  if (budget) {
    recs.push({
      id: "budget-reserves",
      category: "budget",
      title: "Protect paid + contingency reserves",
      recommendation: "Hold ~20% of budget for paid amplification and ~10% as a contingency reserve, releasing it only in the optimization window.",
      reason: "Reserves let the campaign react to performance and absorb reshoots without derailing the plan.",
      confidence: "Low",
      evidence: [`Total budget: ${budget.amount.toLocaleString()} ${budget.currency}`],
    });
  }

  // 8. Timeline optimization.
  if (durationWeeks !== undefined && slate.length > 0) {
    if (durationWeeks <= 3 && slate.length >= 5) {
      const target = Math.min(8, slate.length);
      recs.push({
        id: "timeline-extend",
        category: "timeline",
        title: `Extend to ~${target} weeks`,
        recommendation: `The slate of ${slate.length} creators is compressed into ${durationWeeks} weeks; extending to ~${target} weeks spaces posts and reduces audience fatigue.`,
        reason: "Too many creators in a short window clusters posting and erodes per-post reach.",
        confidence: "Medium",
        evidence: [`${slate.length} creators over ${durationWeeks} weeks`],
        proposedCommand: `Set the campaign to ${target} weeks`,
      });
    } else if (durationWeeks >= 8 && slate.length <= 3) {
      recs.push({
        id: "timeline-tighten",
        category: "timeline",
        title: "Tighten the timeline",
        recommendation: `A ${durationWeeks}-week flight with only ${slate.length} creators risks losing momentum; consider ~${Math.max(4, slate.length * 2)} weeks.`,
        reason: "A long flight with a thin slate creates gaps between posts and dilutes momentum.",
        confidence: "Medium",
        evidence: [`${slate.length} creators over ${durationWeeks} weeks`],
        proposedCommand: `Set the campaign to ${Math.max(4, slate.length * 2)} weeks`,
      });
    }
  }

  // 9. Creator diversity — reduce audience overlap.
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (dominant && slate.length >= 3 && dominant[1] / slate.length > 0.6) {
    const [tier] = dominant;
    const suggestTier = tierRank(tier) <= 2 ? "micro" : "mid-tier";
    recs.push({
      id: "creator-diversity",
      category: "diversity",
      title: "Increase creator diversity",
      recommendation: `${dominant[1]} of ${slate.length} creators are ${tier}; adding a couple of ${suggestTier} creators broadens unique reach and reduces audience overlap.`,
      reason: "A slate concentrated in one tier duplicates audiences and caps net reach.",
      confidence: "High",
      evidence: [`Tier mix: ${tierSummary}`],
      proposedCommand: `Add 2 ${suggestTier} creators`,
    });
  }

  // 10. Contingency.
  if (durationWeeks !== undefined && durationWeeks >= 3) {
    recs.push({
      id: "contingency",
      category: "contingency",
      title: "Hold a contingency buffer",
      recommendation: "Reserve a contingency window before campaign end for reshoots or rescheduled posts.",
      reason: "Creator availability and content approvals slip; a buffer protects the delivery date.",
      confidence: "Low",
      evidence: [`Campaign duration: ${durationWeeks} weeks`],
    });
  }

  recs.sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]);

  const summary = recs.length
    ? `The Director reviewed ${slate.length} creator${slate.length === 1 ? "" : "s"}${durationWeeks ? ` over ${durationWeeks} weeks` : ""} and has ${recs.length} recommendation${recs.length === 1 ? "" : "s"}.`
    : "The campaign looks well-balanced — no material recommendations from the current inputs.";

  return { recommendations: recs, summary };
}
