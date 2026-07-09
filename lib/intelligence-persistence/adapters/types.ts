/**
 * Provider adapter contract — normalization is provider-independent.
 */

import type { ApifyProfileData } from "@/lib/creator-enrichment/types";
import type { IplProvider, RawProviderPayload } from "../types";

export type ProviderAdapter = {
  provider: IplProvider;
  /** Normalize raw provider payload to provider-agnostic shape. */
  normalize(raw: RawProviderPayload): ApifyProfileData | null;
  /** Estimate payload size in bytes for audit metadata. */
  estimatePayloadBytes(raw: RawProviderPayload): number;
  /** Estimate cost in USD for a completed run (best-effort). */
  estimateCostUsd(raw: RawProviderPayload, durationMs: number): number | null;
};
