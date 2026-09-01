import { calculateCpe, calculateCpv } from "@/lib/campaigns/performance-calculations";
import { formatMoneyDetail } from "@/lib/finance/currency-format";

import { contentFormatSingular } from "./content-format";
import { allocateCreatorPostFee, type CreatorAssignmentFeeShare } from "./fees";
import {
  chooseComparableMetric,
  hasAnyMetric,
  metricValue,
  sortNewestFirst,
  type CreatorPublicationObservation,
} from "./observations";
import { formatMetricNumber, meanOfPresent, percentChange, presentCount } from "./stats";
import type { CreatorInsightConfidence, CreatorInsightMetricKey, UnitCompactInsight } from "./types";

export const MIN_POST_BASELINE = 3;

export type PostPerformanceVerdict = "strong" | "on_track" | "underperforming" | "collecting";

export type PostPerformanceAnalysis = {
  publicationId: string;
  campaignHeaderId: string | null;
  assignmentDeliverableId: string | null;
  assignmentPostScheduleId: string | null;
  formatLabel: string;
  verdict: PostPerformanceVerdict;
  title: string;
  explanation: string;
  advice: string;
  confidence: CreatorInsightConfidence;
  metricKey: CreatorInsightMetricKey | null;
  metricValue: number | null;
  baselineValue: number | null;
  deltaPct: number | null;
  feeAmount: number | null;
  currency: string | null;
  feeLabel: string | null;
  cpv: number | null;
  cpe: number | null;
  cpvLabel: string | null;
  extraDelivery: boolean;
};

function hasCampaignPublication(row: CreatorPublicationObservation): boolean {
  return row.source === "thinkway_publication" || row.source === "merged";
}

function shareFor(
  row: CreatorPublicationObservation,
  shares: readonly CreatorAssignmentFeeShare[]
): CreatorAssignmentFeeShare | null {
  if (!row.assignmentDeliverableId) return null;
  return (
    shares.find((share) => share.assignmentDeliverableId === row.assignmentDeliverableId) ?? null
  );
}

function verdictFromDelta(delta: number | null): PostPerformanceVerdict {
  if (delta == null) return "collecting";
  if (delta >= 0.1) return "strong";
  if (delta <= -0.1) return "underperforming";
  return "on_track";
}

function confidenceFor(sampleSize: number, hasFee: boolean): CreatorInsightConfidence {
  if (sampleSize >= 8) return "high";
  if (sampleSize >= 5) return "medium";
  if (sampleSize >= MIN_POST_BASELINE || hasFee) return "low";
  return "low";
}

function money(amount: number | null, currency: string | null): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return formatMoneyDetail(amount, currency);
}

export function postPerformanceCopy(input: {
  formatLabel: string;
  verdict: PostPerformanceVerdict;
  metricKey: CreatorInsightMetricKey | null;
  metricLabel: string | null;
  baselineLabel: string | null;
  deltaPct: number | null;
  feeLabel: string | null;
  cpvLabel: string | null;
  extraDelivery: boolean;
  peerCount: number;
}): { title: string; explanation: string; advice: string } {
  const format = input.formatLabel;
  if (input.verdict === "collecting") {
    const feeBit = input.feeLabel
      ? ` The agreed fee on this post is ${input.feeLabel}${
          input.cpvLabel ? `, or ${input.cpvLabel} per view so far` : ""
        }.`
      : "";
    return {
      title: `Still collecting a read on this ${format}`,
      explanation: input.metricLabel
        ? `This ${format} has ${input.metricLabel}. Thinkway needs more of your own ${format} history before calling it strong or weak.${feeBit}`
        : `Thinkway does not have comparable numbers on this ${format} yet.${feeBit}`,
      advice: input.feeLabel
        ? `Protect the agreed fee by posting the remaining ${format}s in the same window and style so the paid mix has a fair chance to land.`
        : `Add the live link and keep posting so Thinkway can compare this ${format} with your own history.`,
    };
  }

  const vsAverage =
    input.metricLabel && input.baselineLabel
      ? `This ${format} delivered ${input.metricLabel} versus your recent ${format} average of ${input.baselineLabel}`
      : `This ${format} has a readable result`;
  const paid =
    input.extraDelivery
      ? " It was posted beyond the agreed mix, so there is no extra fee against it."
      : input.feeLabel
        ? ` Against the ${input.feeLabel} agreed for this post${
            input.cpvLabel ? `, that is ${input.cpvLabel} per view` : ""
          }.`
        : "";

  if (input.verdict === "strong") {
    return {
      title: `This ${format} is performing well`,
      explanation: `${vsAverage}.${paid}`,
      advice: input.cpvLabel
        ? `The agreed fee is working. Keep this ${format} hook and posting window for similar briefs so the next paid post has the same chance.`
        : `Lean into this ${format} on the next similar brief — it is beating your own recent bar.`,
    };
  }

  if (input.verdict === "underperforming") {
    return {
      title: `This ${format} is below your usual`,
      explanation: `${vsAverage}.${paid}`,
      advice: input.feeLabel
        ? `The agreed fee is working harder than it should. Tighten the opening seconds and the call-to-action on the next ${format} so paid delivery catches up with your average.`
        : `Review the hook and CTA before the next ${format}. This one is behind your recent average.`,
    };
  }

  return {
    title: `This ${format} is on track`,
    explanation: `${vsAverage}.${paid}`,
    advice: input.feeLabel
      ? `The post is in line with your recent ${format}s for the agreed fee. Hold the same quality bar on the remaining paid posts.`
      : `Stay with this ${format} approach — it matches your recent average.`,
  };
}

export function detectPostPerformanceAnalyses(
  observations: readonly CreatorPublicationObservation[],
  shares: readonly CreatorAssignmentFeeShare[] = []
): PostPerformanceAnalysis[] {
  const ordered = sortNewestFirst(observations).filter(hasCampaignPublication);
  const out: PostPerformanceAnalysis[] = [];

  for (const row of ordered) {
    const formatLabel = contentFormatSingular(row.formatFamily);
    const share = shareFor(row, shares);
    const extraDelivery = !row.assignmentDeliverableId || share == null;
    const feeAmount = share
      ? allocateCreatorPostFee(share.agreedFee, share.contractedSlots)
      : null;
    const currency = share?.currency ?? null;
    const feeLabel = money(feeAmount, currency);
    const cpv = calculateCpv(feeAmount, row.views);
    const cpe = calculateCpe(feeAmount, {
      impressions: row.impressions,
      reach: row.reach,
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
      clicks: null,
      cost: feeAmount,
    });
    const cpvLabel = cpv != null ? money(cpv, currency) : null;

    const peers = ordered.filter(
      (peer) => peer.id !== row.id && peer.formatFamily === row.formatFamily
    );
    const metricKey = chooseComparableMetric([row, ...peers], 1);
    const own = metricKey ? metricValue(row, metricKey) : null;
    const peerValues = metricKey
      ? peers.map((peer) => metricValue(peer, metricKey))
      : [];
    const peerPresent = presentCount(peerValues);
    const baseline =
      peerPresent >= MIN_POST_BASELINE ? meanOfPresent(peerValues) : null;
    const delta = percentChange(own, baseline);
    const hasMetrics = hasAnyMetric(row);
    const verdict =
      !hasMetrics || own == null
        ? "collecting"
        : baseline == null
          ? "collecting"
          : verdictFromDelta(delta);

    const metricLabel =
      own != null && metricKey ? `${formatMetricNumber(own, metricKey)} ${metricKey === "engagementRate" ? "engagement" : metricKey}` : null;
    const baselineLabel =
      baseline != null && metricKey
        ? `${formatMetricNumber(baseline, metricKey)} ${metricKey === "engagementRate" ? "engagement" : metricKey}`
        : null;

    const copy = postPerformanceCopy({
      formatLabel,
      verdict,
      metricKey,
      metricLabel,
      baselineLabel,
      deltaPct: delta == null ? null : Math.round(delta * 1000) / 10,
      feeLabel,
      cpvLabel,
      extraDelivery: extraDelivery && feeAmount == null,
      peerCount: peerPresent,
    });

    out.push({
      publicationId: row.id,
      campaignHeaderId: row.campaignHeaderId,
      assignmentDeliverableId: row.assignmentDeliverableId,
      assignmentPostScheduleId: row.assignmentPostScheduleId,
      formatLabel,
      verdict,
      title: copy.title,
      explanation: copy.explanation,
      advice: copy.advice,
      confidence: confidenceFor(peerPresent + (own != null ? 1 : 0), feeAmount != null),
      metricKey,
      metricValue: own,
      baselineValue: baseline,
      deltaPct: delta == null ? null : Math.round(delta * 1000) / 10,
      feeAmount,
      currency,
      feeLabel,
      cpv,
      cpe,
      cpvLabel,
      extraDelivery: extraDelivery && feeAmount == null,
    });
  }

  return out;
}

export function compactLinesFromPostAnalyses(
  analyses: readonly PostPerformanceAnalysis[]
): UnitCompactInsight[] {
  return analyses
    .filter((row) => row.assignmentDeliverableId && row.campaignHeaderId)
    .map((row) => ({
      assignmentDeliverableId: row.assignmentDeliverableId as string,
      assignmentPostScheduleId: row.assignmentPostScheduleId,
      campaignHeaderId: row.campaignHeaderId as string,
      line: row.title,
    }));
}
