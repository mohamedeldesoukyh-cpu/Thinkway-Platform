import type { ClientDeliverableItem } from "./types";
import { DELIVERABLES_TO_BE_CONFIRMED } from "./format";

type RawDeliverableLine = {
  platform?: string;
  type?: string;
  types?: string[];
  quantity?: number;
};

export function parseDeliverableItems(raw: unknown): ClientDeliverableItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const items: ClientDeliverableItem[] = [];
  for (const line of raw as RawDeliverableLine[]) {
    const types =
      line.types?.filter((type) => typeof type === "string" && type.trim()) ??
      (line.type?.trim() ? [line.type] : []);
    for (const type of types) {
      items.push({
        platform: line.platform?.trim() || undefined,
        type: type.trim(),
        quantity:
          typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0
            ? line.quantity
            : 1,
      });
    }
  }
  return items;
}

export function formatDeliverableItems(items: ClientDeliverableItem[] | undefined): string | undefined {
  if (!items?.length) return undefined;
  const parts = items.map((item) => {
    const qty = item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : " × 1";
    const platform = item.platform?.trim();
    const type = item.type.trim();
    if (platform) return `${formatPlatformTitle(platform)} ${type}${qty}`;
    return `${type}${qty}`;
  });
  return parts.join(" · ");
}

export function deliverablesLabel(
  items: ClientDeliverableItem[] | undefined,
  fallback?: string
): string {
  return formatDeliverableItems(items) || fallback?.trim() || DELIVERABLES_TO_BE_CONFIRMED;
}

function formatPlatformTitle(platform: string): string {
  const lower = platform.toLowerCase();
  if (lower === "instagram") return "Instagram";
  if (lower === "tiktok") return "TikTok";
  if (lower === "youtube") return "YouTube";
  if (lower === "facebook") return "Facebook";
  return platform;
}

export function activityMixFromCreators(
  creators: Array<{ deliverableItems?: ClientDeliverableItem[]; deliverables?: string }>
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const creator of creators) {
    if (creator.deliverableItems?.length) {
      for (const item of creator.deliverableItems) {
        const label = item.platform
          ? `${formatPlatformTitle(item.platform)} ${item.type}`
          : item.type;
        counts.set(label, (counts.get(label) ?? 0) + (item.quantity && item.quantity > 0 ? item.quantity : 1));
      }
      continue;
    }
    if (creator.deliverables?.trim()) {
      for (const part of creator.deliverables.split(",")) {
        const label = part.trim();
        if (!label) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
