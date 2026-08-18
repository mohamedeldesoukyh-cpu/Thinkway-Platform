import { canonicalPlatformKey, deliverableTypeShortLabel } from "@/lib/campaigns/deliverable-taxonomy";
import {
  normalizeQuotationPostType,
  postTypePlatformKey,
  quotationPostTypeLabel,
} from "@/lib/quotations/quotation-deliverable-types";

import { DELIVERABLES_TO_BE_CONFIRMED } from "./format";
import type { ClientDeliverableItem } from "./types";

const PLATFORM_ORDER = ["instagram", "tiktok", "youtube", "facebook", "snapchat", "twitter", "linkedin"];
const KNOWN_PLATFORMS = new Set(PLATFORM_ORDER);

type RawTypeLine = {
  type?: string;
  quantity?: number;
};

type RawDeliverableLine = {
  platform?: string;
  type?: string;
  types?: string[];
  type_lines?: RawTypeLine[];
  quantity?: number;
};

export type ClientDeliverableSummary = {
  platforms: string[];
  lines: Array<{ key: string; label: string; quantity: number }>;
};

export function parseDeliverableItems(raw: unknown): ClientDeliverableItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const items: ClientDeliverableItem[] = [];
  for (const line of raw as RawDeliverableLine[]) {
    const typeLines = line.type_lines?.filter((entry) => typeof entry.type === "string" && entry.type.trim());
    if (typeLines?.length) {
      for (const entry of typeLines) {
        items.push({
          platform: line.platform?.trim() || undefined,
          type: entry.type!.trim(),
          quantity: positiveQuantity(entry.quantity) ?? 1,
        });
      }
      continue;
    }
    const types =
      line.types?.filter((type) => typeof type === "string" && type.trim()) ??
      (line.type?.trim() ? [line.type] : []);
    for (const type of types) {
      items.push({
        platform: line.platform?.trim() || undefined,
        type: type.trim(),
        quantity: positiveQuantity(line.quantity) ?? 1,
      });
    }
  }
  return items;
}

export function splitPlatformTokens(platform?: string): string[] {
  if (!platform?.trim()) return [];
  const keys = platform
    .split(/[,|/]/)
    .map((part) => canonicalPlatformKey(part.trim()))
    .filter((key) => Boolean(key) && KNOWN_PLATFORMS.has(key));
  return sortPlatforms([...new Set(keys)]);
}

export function shortDeliverableLabel(type: string): string {
  const trimmed = type.trim();
  if (!trimmed) return trimmed;
  const normalized = normalizeQuotationPostType(trimmed);
  const quotation = quotationPostTypeLabel(normalized);
  if (quotation && quotation !== normalized.replace(/_/g, " ")) return quotation;
  const short = deliverableTypeShortLabel(normalized);
  if (short && short !== normalized.replace(/_/g, " ")) return short;
  return quotation || trimmed;
}

export function summarizeCreatorDeliverables(
  items: ClientDeliverableItem[] | undefined
): ClientDeliverableSummary {
  const platforms = new Set<string>();
  const counts = new Map<string, { label: string; quantity: number }>();
  for (const item of items ?? []) {
    for (const platform of splitPlatformTokens(item.platform)) platforms.add(platform);
    const fromType = postTypePlatformKey(normalizeQuotationPostType(item.type));
    if (fromType) platforms.add(fromType);
    const key = normalizeQuotationPostType(item.type) || item.type.trim().toLowerCase();
    if (!key) continue;
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const existing = counts.get(key);
    if (existing) existing.quantity += quantity;
    else counts.set(key, { label: shortDeliverableLabel(item.type), quantity });
  }
  return {
    platforms: sortPlatforms([...platforms]),
    lines: [...counts.entries()].map(([key, line]) => ({ key, ...line })),
  };
}

export function formatDeliverableItems(items: ClientDeliverableItem[] | undefined): string | undefined {
  const summary = summarizeCreatorDeliverables(items);
  if (summary.lines.length === 0) return undefined;
  return summary.lines.map((line) => `${line.label} × ${line.quantity}`).join(" · ");
}

export function looksLikePlatformList(value?: string): boolean {
  if (!value?.trim()) return false;
  const parts = value
    .split(/[,·|/]/)
    .map((part) => canonicalPlatformKey(part.trim()))
    .filter(Boolean);
  return parts.length > 0 && parts.every((part) => KNOWN_PLATFORMS.has(part));
}

export function deliverablesLabel(
  items: ClientDeliverableItem[] | undefined,
  fallback?: string
): string {
  const formatted = formatDeliverableItems(items);
  if (formatted) return formatted;
  const trimmed = fallback?.trim();
  if (trimmed && !looksLikePlatformList(trimmed)) return trimmed;
  return DELIVERABLES_TO_BE_CONFIRMED;
}

export function canonicalDeliverableFamily(type: string): string {
  const value = type.toLowerCase();
  if (value.includes("reel") || value.includes("short")) return "Reels";
  if (value.includes("stor")) return "Stories";
  if (value.includes("carousel")) return "Carousels";
  if (value.includes("post") || value.includes("feed") || value.includes("photo") || value.includes("image")) {
    return "Posts";
  }
  if (value.includes("tiktok") || value.includes("video")) return "Videos";
  return type.trim();
}

export function groupedActivityMix(
  items: Array<{ label: string; count: number }>
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const family = canonicalDeliverableFamily(item.label);
    counts.set(family, (counts.get(family) ?? 0) + item.count);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function activityMixFromCreators(
  creators: Array<{ deliverableItems?: ClientDeliverableItem[]; deliverables?: string }>
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const creator of creators) {
    if (creator.deliverableItems?.length) {
      for (const line of summarizeCreatorDeliverables(creator.deliverableItems).lines) {
        counts.set(line.label, (counts.get(line.label) ?? 0) + line.quantity);
      }
      continue;
    }
    if (creator.deliverables?.trim() && !looksLikePlatformList(creator.deliverables)) {
      for (const part of creator.deliverables.split(",")) {
        const label = part.trim();
        if (!label) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }
  return groupedActivityMix(
    [...counts.entries()].map(([label, count]) => ({ label, count }))
  );
}

function positiveQuantity(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function sortPlatforms(platforms: string[]): string[] {
  return [...platforms].sort((a, b) => {
    const left = PLATFORM_ORDER.indexOf(a);
    const right = PLATFORM_ORDER.indexOf(b);
    return (left === -1 ? 99 : left) - (right === -1 ? 99 : right) || a.localeCompare(b);
  });
}
