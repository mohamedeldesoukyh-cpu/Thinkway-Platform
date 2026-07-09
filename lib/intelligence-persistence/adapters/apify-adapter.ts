/**
 * Apify provider adapter — wraps existing normalization from creator-enrichment.
 */

import { normalizeApifyProfileData } from "@/lib/creator-enrichment/apify-profile";

import type { ProviderAdapter } from "./types";
import type { RawProviderPayload } from "../types";

function jsonByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

/** Apify compute unit estimate: ~$0.25 per CU, profile scrape ~0.01-0.05 CU. */
function estimateApifyCost(durationMs: number, payloadBytes: number): number {
  const baseCost = 0.002;
  const durationFactor = Math.min(durationMs / 60_000, 2) * 0.001;
  const payloadFactor = (payloadBytes / 100_000) * 0.0005;
  return Number((baseCost + durationFactor + payloadFactor).toFixed(6));
}

export const apifyAdapter: ProviderAdapter = {
  provider: "apify",

  normalize(raw: RawProviderPayload) {
    return normalizeApifyProfileData({
      platformKey: raw.platformKey,
      username: raw.username,
      profileUrl: raw.profileUrl,
      profileRows: raw.profileRows,
      postRows: raw.postRows,
      apifyRunId: raw.apifyRunId ?? null,
    });
  },

  estimatePayloadBytes(raw: RawProviderPayload): number {
    return jsonByteSize(raw.profileRows) + jsonByteSize(raw.postRows);
  },

  estimateCostUsd(raw: RawProviderPayload, durationMs: number): number {
    return estimateApifyCost(durationMs, this.estimatePayloadBytes(raw));
  },
};
