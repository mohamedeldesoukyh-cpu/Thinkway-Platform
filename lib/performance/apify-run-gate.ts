/**
 * Process-local gate to stop duplicate Apify launches from burning credits.
 *
 * Same actor + same profile key within the cooldown window is rejected.
 * This covers races between batch acquisition, per-creator enrichment,
 * Instagram backfill, and double-clicks.
 */

const recentLaunches = new Map<string, number>();

/** Default: 2 minutes — long enough to collapse parallel duplicate refreshes. */
export const APIFY_RUN_COOLDOWN_MS = 120_000;

function prune(now: number, cooldownMs: number): void {
  for (const [key, at] of recentLaunches) {
    if (now - at > cooldownMs) recentLaunches.delete(key);
  }
}

export function apifyRunGateKey(input: {
  actorId: string;
  platform: string;
  /** Usernames, profile URLs, or other identity tokens for this run. */
  identities: string[];
  label?: string;
}): string {
  const identities = input.identities
    .map((value) => value.replace(/^@+/, "").trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return [
    input.actorId.trim().toLowerCase(),
    input.platform.trim().toLowerCase(),
    input.label?.trim().toLowerCase() || "run",
    identities.join("|") || "empty",
  ].join("::");
}

export type ApifyRunGateDecision =
  | { allowed: true; key: string }
  | { allowed: false; key: string; retryAfterMs: number; reason: string };

export function beginApifyRunGate(
  key: string,
  cooldownMs = APIFY_RUN_COOLDOWN_MS,
  now = Date.now()
): ApifyRunGateDecision {
  prune(now, cooldownMs);
  const last = recentLaunches.get(key);
  if (last != null && now - last < cooldownMs) {
    return {
      allowed: false,
      key,
      retryAfterMs: cooldownMs - (now - last),
      reason: `Duplicate Apify run blocked (${Math.ceil((cooldownMs - (now - last)) / 1000)}s cooldown).`,
    };
  }
  recentLaunches.set(key, now);
  return { allowed: true, key };
}

/** Test helper — clears in-memory gate state. */
export function resetApifyRunGateForTests(): void {
  recentLaunches.clear();
}
