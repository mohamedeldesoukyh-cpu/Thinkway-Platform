/**
 * Deliverable fingerprints — the comparison side of the dependency graph.
 *
 * A deliverable's fingerprint is a stable hash of the input slices it depends
 * on. When a Copilot edit changes an input, the recomputed fingerprint differs
 * from the one stored at generation time, so the deliverable is flagged
 * "Needs Update" — and *only* the deliverables that actually depend on the
 * changed input, never everything.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { DeliverableInputKey } from "./deliverable-types";
import { resolveInputValue } from "./deliverable-inputs";

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
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint the given input keys. Keys are sorted so the fingerprint is
 * independent of the order they were declared in the catalog.
 */
export function computeSourceFingerprint(
  campaignObject: CampaignObject,
  inputKeys: readonly DeliverableInputKey[]
): string {
  const payload = [...inputKeys]
    .sort()
    .map((key) => [key, resolveInputValue(campaignObject, key)] as const);
  return fnv1a(stableStringify(payload));
}
