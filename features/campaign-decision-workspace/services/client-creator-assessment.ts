import type { ClientCreatorEvaluation } from "@/features/campaign-decision-engine";
import {
  isRawClientCreatorId,
  resolveClientCreatorDisplayName,
} from "@/features/campaign-decision-engine/client-creator-identity";

import type { ClientCreatorAssessment, ClientCreatorRecommendation } from "../types";

export function assessClientCreator(
  evaluation: ClientCreatorEvaluation
): ClientCreatorAssessment {
  const audienceMatch = Math.min(
    100,
    Math.max(0, 70 + (evaluation.audienceDiff > 0 ? 10 : -10) + evaluation.thinkwayFitScore * 0.1)
  );
  const brandFit = evaluation.fitScore;
  const overlap = Math.min(
    100,
    Math.max(0, 100 - Math.abs(evaluation.audienceDiff) / 10_000)
  );

  let recommendation: ClientCreatorRecommendation;
  if (evaluation.replaceRecommended && evaluation.fitScore < 60) {
    recommendation = "replace";
  } else if (evaluation.replaceRecommended) {
    recommendation = "need_review";
  } else if (evaluation.fitScore < evaluation.thinkwayFitScore - 8) {
    recommendation = "hybrid";
  } else {
    recommendation = "keep_thinkway";
  }

  return {
    ...evaluation,
    recommendation,
    audienceMatch: Math.round(audienceMatch),
    brandFit: Math.round(brandFit),
    overlap: Math.round(overlap),
  };
}

export function recommendationLabel(rec: ClientCreatorRecommendation): string {
  switch (rec) {
    case "keep_thinkway":
      return "Keep Thinkway Creator";
    case "replace":
      return "Replace";
    case "hybrid":
      return "Hybrid";
    case "need_review":
      return "Need Review";
  }
}

export function recommendationColor(rec: ClientCreatorRecommendation): string {
  switch (rec) {
    case "keep_thinkway":
      return "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30";
    case "replace":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "hybrid":
      return "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400";
    case "need_review":
      return "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400";
  }
}

export function parseCreatorUrl(url: string): { platform: string; handle: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const patterns = [
    { platform: "instagram", regex: /instagram\.com\/([^/?#]+)/i },
    { platform: "tiktok", regex: /tiktok\.com\/@([^/?#]+)/i },
    { platform: "youtube", regex: /youtube\.com\/(?:@|channel\/)([^/?#]+)/i },
  ];

  for (const { platform, regex } of patterns) {
    const match = trimmed.match(regex);
    if (match?.[1]) {
      return { platform, handle: match[1].replace("@", "") };
    }
  }

  if (trimmed.startsWith("@")) {
    return { platform: "instagram", handle: trimmed.slice(1) };
  }

  return null;
}

export function creatorIdFromUrl(url: string): string | null {
  const parsed = parseCreatorUrl(url);
  if (!parsed) return null;
  return `client_${parsed.platform}_${parsed.handle}`;
}

export function resolveAssessmentDisplayName(assessment: ClientCreatorAssessment): string {
  const { displayName, handle } = assessment.clientCreator;
  if (!isRawClientCreatorId(displayName)) return displayName ?? handle ?? "Client Creator";
  if (handle && !isRawClientCreatorId(handle)) return handle;
  return resolveClientCreatorDisplayName(assessment.creatorId, {
    displayName,
    handle,
  }).displayName;
}
