import { meanOfPresent, presentCount } from "./stats";
import type { CreatorInsightMetricKey } from "./types";
import { MIN_TREND_EACH_SIDE } from "./types";
import { metricValue, type CreatorPublicationObservation } from "./observations";

export type BaselineWindow = {
  windowSize: number;
  recent: CreatorPublicationObservation[];
  prior: CreatorPublicationObservation[];
};

/** Prefer 5 vs 5 when 10 exist; else 3 vs 3 when 6 exist. Never one publication. */
export function chooseBaselineWindow(
  observations: readonly CreatorPublicationObservation[]
): BaselineWindow | null {
  if (observations.length >= 10) {
    return {
      windowSize: 5,
      recent: observations.slice(0, 5),
      prior: observations.slice(5, 10),
    };
  }
  if (observations.length >= MIN_TREND_EACH_SIDE * 2) {
    return {
      windowSize: MIN_TREND_EACH_SIDE,
      recent: observations.slice(0, MIN_TREND_EACH_SIDE),
      prior: observations.slice(MIN_TREND_EACH_SIDE, MIN_TREND_EACH_SIDE * 2),
    };
  }
  return null;
}

export function baselineMeans(
  window: BaselineWindow,
  metricKey: CreatorInsightMetricKey
): { recentMean: number | null; priorMean: number | null; sampleSize: number } {
  const recentValues = window.recent.map((row) => metricValue(row, metricKey));
  const priorValues = window.prior.map((row) => metricValue(row, metricKey));
  const recentPresent = presentCount(recentValues);
  const priorPresent = presentCount(priorValues);
  if (recentPresent < window.windowSize || priorPresent < window.windowSize) {
    return { recentMean: null, priorMean: null, sampleSize: recentPresent + priorPresent };
  }
  return {
    recentMean: meanOfPresent(recentValues),
    priorMean: meanOfPresent(priorValues),
    sampleSize: recentPresent + priorPresent,
  };
}

export function sameFormatObservations(
  observations: readonly CreatorPublicationObservation[],
  family: CreatorPublicationObservation["formatFamily"]
): CreatorPublicationObservation[] {
  return observations.filter((row) => row.formatFamily === family);
}

export function samePlatformObservations(
  observations: readonly CreatorPublicationObservation[],
  platform: string
): CreatorPublicationObservation[] {
  return observations.filter((row) => row.platform === platform);
}
