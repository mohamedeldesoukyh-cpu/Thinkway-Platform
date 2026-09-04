import type { CampaignIntelligenceLibraryItem } from "@/lib/domains/intelligence/types";

export type IntelligenceDuplicateGroup = {
  title: string;
  brandName: string | null;
  clientName: string | null;
  hoursApart: number;
  recordCount: number;
};

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupKey(item: CampaignIntelligenceLibraryItem): string {
  return [
    item.title.trim().toLowerCase(),
    (item.brandId ?? item.brandName ?? "").trim().toLowerCase(),
    (item.clientId ?? item.clientName ?? "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Same brief + brand + legal entity on the same calendar day, ≥2 rows.
 * Pack example: two NBK Bank records three hours apart → masthead Duplicates 2.
 */
export function findIntelligenceDuplicateGroups(
  items: CampaignIntelligenceLibraryItem[]
): IntelligenceDuplicateGroup[] {
  const buckets = new Map<string, CampaignIntelligenceLibraryItem[]>();
  for (const item of items) {
    if (item.status === "archived") continue;
    const key = `${groupKey(item)}::${dayKey(item.createdAt)}`;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }

  const groups: IntelligenceDuplicateGroup[] = [];
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const times = list
      .map((item) => new Date(item.createdAt).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
    const hoursApart =
      times.length >= 2
        ? Math.max(1, Math.round((times[times.length - 1]! - times[0]!) / 3_600_000))
        : 0;
    const sample = list[0]!;
    groups.push({
      title: sample.title,
      brandName: sample.brandName,
      clientName: sample.clientName,
      hoursApart,
      recordCount: list.length,
    });
  }
  return groups;
}

export function countDuplicateRecords(
  items: CampaignIntelligenceLibraryItem[]
): number {
  return findIntelligenceDuplicateGroups(items).reduce(
    (sum, group) => sum + group.recordCount,
    0
  );
}

export function buildIntelligenceLibraryNote(
  groups: IntelligenceDuplicateGroup[]
): string {
  const action =
    "Each row is a saved brief. Search runs Discovery against it; Open shows the brief itself.";
  if (groups.length === 0) return action;
  const first = groups[0]!;
  const hours =
    first.hoursApart === 1 ? "1 hour" : `${first.hoursApart} hours`;
  return `${action} Two ${first.title} records were created ${hours} apart on the same day — worth checking one is not a duplicate.`;
}
