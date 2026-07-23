import { getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";

/** Canonical UI label for a platform string (e.g. tiktok → TikTok). */
export function canonicalPlatformLabel(platform: string, fallback = "Instagram"): string {
  const trimmed = platform.trim();
  if (!trimmed) return fallback;
  return getPlatformOptionLabel(trimmed);
}

/** Merge slot counts that share the same platform under different casing or aliases. */
export function mergePlatformAllocation(
  allocation: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const [platform, count] of Object.entries(allocation)) {
    if (count <= 0) continue;
    const label = canonicalPlatformLabel(platform);
    merged[label] = (merged[label] ?? 0) + count;
  }
  return merged;
}
