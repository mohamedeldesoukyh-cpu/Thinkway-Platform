/**
 * Output fingerprints — the comparison side of the dependency graph.
 *
 * An output's fingerprint is a stable hash of the input slices it depends on.
 * When a Copilot edit changes an input, the recomputed fingerprint differs from
 * the one stored at generation time, so the output is flagged "Needs Update" —
 * and *only* the outputs that actually depend on the changed input, never
 * everything.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { CampaignOutputInputKey } from "./output-types";
import { resolveInputValue } from "./output-inputs";

/** Deterministic JSON: object keys sorted so equal data always serializes equally. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** FNV-1a 32-bit — small, dependency-free, browser-safe; sufficient for change detection. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Fingerprint a single input slice. */
export function computeInputFingerprint(
  campaignObject: CampaignObject,
  key: CampaignOutputInputKey
): string {
  return fnv1a(stableStringify(resolveInputValue(campaignObject, key)));
}

/**
 * Fingerprint the given input keys. Keys are sorted so the fingerprint is
 * independent of the order they were declared in the catalog.
 */
export function computeSourceFingerprint(
  campaignObject: CampaignObject,
  inputKeys: readonly CampaignOutputInputKey[]
): string {
  const payload = [...inputKeys]
    .sort()
    .map((key) => [key, resolveInputValue(campaignObject, key)] as const);
  return fnv1a(stableStringify(payload));
}

/** Per-input fingerprints — used to name exactly which input made an output stale. */
export function computeInputFingerprints(
  campaignObject: CampaignObject,
  inputKeys: readonly CampaignOutputInputKey[]
): Partial<Record<CampaignOutputInputKey, string>> {
  const map: Partial<Record<CampaignOutputInputKey, string>> = {};
  for (const key of inputKeys) {
    map[key] = computeInputFingerprint(campaignObject, key);
  }
  return map;
}

/** Memoize `resolveInputValue` within a single outputs pass — avoids re-parsing the slate N times. */
export class CampaignInputCache {
  private readonly values = new Map<CampaignOutputInputKey, unknown>();

  constructor(private readonly campaignObject: CampaignObject) {}

  resolve(key: CampaignOutputInputKey): unknown {
    const cached = this.values.get(key);
    if (cached !== undefined) return cached;
    const value = resolveInputValue(this.campaignObject, key);
    this.values.set(key, value);
    return value;
  }

  fingerprint(inputKeys: readonly CampaignOutputInputKey[]): string {
    const payload = [...inputKeys]
      .sort()
      .map((key) => [key, this.resolve(key)] as const);
    return fnv1a(stableStringify(payload));
  }

  inputFingerprint(key: CampaignOutputInputKey): string {
    return fnv1a(stableStringify(this.resolve(key)));
  }
}
