/**
 * Creator Search follower bands — single range or multi-select OR of bands.
 */

import { TIER_FILTER_RANGES } from "@/lib/creators/influencer-tier";

export type CreatorSearchFollowerRange = {
  /** Inclusive lower bound (digits as string for filter state). */
  min: string;
  /** Inclusive upper bound; empty string = open-ended (e.g. Celebrity 5M+). */
  max: string;
};

export type BrowseFollowerRange = {
  min: number;
  /** null = no upper bound */
  max: number | null;
};

export const CREATOR_SEARCH_FOLLOWERS_PARAM = "followers";

function trimDigits(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.trunc(n));
}

export function normalizeFollowerRange(
  range: { min?: string | null; max?: string | null }
): CreatorSearchFollowerRange | null {
  const min = trimDigits(range.min);
  const max = trimDigits(range.max);
  if (!min && !max) return null;
  if (min && max && Number(min) > Number(max)) {
    return { min: max, max: min };
  }
  return { min: min || "0", max };
}

export function normalizeFollowerRanges(
  ranges: ReadonlyArray<{ min?: string | null; max?: string | null }> | null | undefined
): CreatorSearchFollowerRange[] {
  if (!ranges?.length) return [];
  const seen = new Set<string>();
  const out: CreatorSearchFollowerRange[] = [];
  for (const raw of ranges) {
    const range = normalizeFollowerRange(raw);
    if (!range) continue;
    const key = followerRangeKey(range);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(range);
  }
  return out;
}

export function followerRangeKey(range: CreatorSearchFollowerRange): string {
  return `${range.min}:${range.max}`;
}

export function followerRangesEqual(
  a: ReadonlyArray<CreatorSearchFollowerRange>,
  b: ReadonlyArray<CreatorSearchFollowerRange>
): boolean {
  if (a.length !== b.length) return false;
  const keysA = a.map(followerRangeKey).sort();
  const keysB = b.map(followerRangeKey).sort();
  return keysA.every((key, index) => key === keysB[index]);
}

/** Encode one band for URL (`10000-99999`, open max as `5000000-`). */
export function formatFollowerRangeToken(range: CreatorSearchFollowerRange): string {
  return `${range.min}-${range.max}`;
}

export function parseFollowerRangeToken(
  token: string | null | undefined
): CreatorSearchFollowerRange | null {
  const raw = token?.trim() ?? "";
  if (!raw) return null;
  const match = /^(\d+)\s*-\s*(\d*)$/.exec(raw);
  if (!match) return null;
  return normalizeFollowerRange({ min: match[1], max: match[2] ?? "" });
}

/**
 * Resolve UI follower bands: prefer explicit `followerRanges`, else legacy min/max.
 */
export function resolveCreatorSearchFollowerRanges(filters: {
  followerRanges?: ReadonlyArray<CreatorSearchFollowerRange> | null;
  minFollowers?: string | null;
  maxFollowers?: string | null;
}): CreatorSearchFollowerRange[] {
  const fromList = normalizeFollowerRanges(filters.followerRanges);
  if (fromList.length > 0) return fromList;
  const legacy = normalizeFollowerRange({
    min: filters.minFollowers,
    max: filters.maxFollowers,
  });
  return legacy ? [legacy] : [];
}

export function toBrowseFollowerRanges(
  ranges: ReadonlyArray<CreatorSearchFollowerRange>
): BrowseFollowerRange[] {
  const out: BrowseFollowerRange[] = [];
  for (const range of ranges) {
    const min = Number(range.min);
    if (!Number.isFinite(min)) continue;
    const maxRaw = range.max.trim();
    const max = maxRaw === "" ? null : Number(maxRaw);
    if (max != null && !Number.isFinite(max)) continue;
    out.push({ min, max });
  }
  return out;
}

/**
 * Browse filter bands from unified browse params.
 * Multi `followerRanges` wins; otherwise single min/max.
 */
export function resolveBrowseFollowerRanges(filters: {
  followerRanges?: ReadonlyArray<{ min: number; max?: number | null }> | null;
  minFollowers?: number | null;
  maxFollowers?: number | null;
}): BrowseFollowerRange[] {
  if (filters.followerRanges && filters.followerRanges.length > 0) {
    const out: BrowseFollowerRange[] = [];
    for (const range of filters.followerRanges) {
      if (!Number.isFinite(range.min)) continue;
      const max =
        range.max == null || !Number.isFinite(range.max) ? null : range.max;
      out.push({ min: range.min, max });
    }
    return out;
  }
  if (filters.minFollowers == null && filters.maxFollowers == null) return [];
  return [
    {
      min: filters.minFollowers ?? 0,
      max: filters.maxFollowers ?? null,
    },
  ];
}

export function followerCountMatchesBrowseRanges(
  followerCount: number | null | undefined,
  ranges: ReadonlyArray<BrowseFollowerRange>
): boolean {
  if (ranges.length === 0) return true;
  if (followerCount == null || !Number.isFinite(followerCount)) return false;
  return ranges.some((range) => {
    if (followerCount < range.min) return false;
    if (range.max != null && followerCount > range.max) return false;
    return true;
  });
}

/** Single-band chip label; prefer tier preset name when the band matches a preset. */
export function formatFollowerRangeChipLabel(range: CreatorSearchFollowerRange): string {
  const min = Number(range.min);
  const max = range.max.trim() === "" ? null : Number(range.max);
  const preset = TIER_FILTER_RANGES.find(
    (entry) =>
      entry.min === min &&
      (entry.max == null ? max == null : entry.max === max)
  );
  if (preset) return `Followers: ${preset.label}`;
  if (max == null) return `Followers: ${min.toLocaleString()}+`;
  return `Followers: ${min.toLocaleString()}–${max.toLocaleString()}`;
}

export function formatFollowerRangesChipLabel(
  ranges: ReadonlyArray<CreatorSearchFollowerRange>
): string {
  if (ranges.length === 0) return "Followers";
  if (ranges.length === 1) return formatFollowerRangeChipLabel(ranges[0]!);
  return `Followers: ${ranges.map((range) => formatFollowerRangeChipLabel(range).replace(/^Followers:\s*/, "")).join(", ")}`;
}

/** Toggle a preset band in the multi-select list (add if absent, remove if present). */
export function toggleFollowerRangeInList(
  ranges: ReadonlyArray<CreatorSearchFollowerRange>,
  next: CreatorSearchFollowerRange
): CreatorSearchFollowerRange[] {
  const normalized = normalizeFollowerRange(next);
  if (!normalized) return normalizeFollowerRanges(ranges);
  const key = followerRangeKey(normalized);
  const current = normalizeFollowerRanges(ranges);
  if (current.some((range) => followerRangeKey(range) === key)) {
    return current.filter((range) => followerRangeKey(range) !== key);
  }
  return [...current, normalized];
}
