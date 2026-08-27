import type { ClientCampaignPostRow } from "./campaign-execution";
import { formatClientScheduleDate } from "./campaign-execution";
import type { ClientContentReviewItem } from "./content-approval";
import type { ClientCreatorCard } from "./types";

export function joinClientNames(names: string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  if (unique.length <= 2) return unique.join(" and ");
  return `${unique.slice(0, 2).join(", ")} and ${unique.length - 2} more`;
}

export function pluralizeClientCount(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export type ClientReviewAttention = {
  count: number;
  headline: string;
  detail: string;
};

export function clientReviewAttention(
  items: ClientContentReviewItem[]
): ClientReviewAttention | null {
  if (items.length === 0) return null;
  const names = joinClientNames(items.map((item) => item.creatorName));
  const allVideo = items.every((item) => item.previewKind === "video");
  const noun = allVideo ? "video" : "file";
  return {
    count: items.length,
    headline: `${pluralizeClientCount(items.length, noun)} awaiting your approval`,
    detail: `From ${names} · release for publishing or request changes`,
  };
}

export type ClientOverdueStrip = {
  count: number;
  creatorCount: number;
  headline: string;
  detail: string;
};

export function clientOverdueStrip(posts: ClientCampaignPostRow[]): ClientOverdueStrip | null {
  const overdue = posts.filter((post) => post.status === "overdue");
  if (overdue.length === 0) return null;
  const byCreator = new Map<string, number>();
  for (const post of overdue) {
    const name = post.creatorName.trim() || "Creator";
    byCreator.set(name, (byCreator.get(name) ?? 0) + 1);
  }
  const ranked = [...byCreator.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const names = ranked.map(([name, count]) => `${name} (${count})`).join(" · ");
  const dates = [
    ...new Set(
      overdue
        .map((post) => post.scheduledDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .map((iso) => formatClientScheduleDate(iso))
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const dateLabel =
    dates.length === 0
      ? ""
      : dates.length === 1
        ? ` · scheduled ${dates[0]}`
        : ` · scheduled ${dates[0]} – ${dates[dates.length - 1]}`;
  return {
    count: overdue.length,
    creatorCount: ranked.length,
    headline: `${pluralizeClientCount(overdue.length, "publication")} overdue across ${pluralizeClientCount(ranked.length, "creator")}`,
    detail: `${names}${dateLabel} — Thinkway is chasing, no action needed from you`,
  };
}

export type ClientContentCreatorGroup = {
  creatorName: string;
  items: ClientContentReviewItem[];
};

export function groupClientContentByCreator(
  items: ClientContentReviewItem[]
): ClientContentCreatorGroup[] {
  const groups: ClientContentCreatorGroup[] = [];
  for (const item of items) {
    const name = item.creatorName.trim() || "Creator";
    const existing = groups.find((group) => group.creatorName === name);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ creatorName: name, items: [item] });
    }
  }
  return groups;
}

export type ClientCampaignBarSegment = {
  key: "live" | "overdue" | "scheduled" | "scheduling" | "completed";
  label: string;
  count: number;
  percent: number;
};

export function clientCampaignBarSegments(
  posts: ClientCampaignPostRow[]
): ClientCampaignBarSegment[] {
  const total = posts.length;
  if (total === 0) return [];
  const counts: Record<ClientCampaignBarSegment["key"], number> = {
    live: posts.filter((post) => post.status === "live").length,
    overdue: posts.filter((post) => post.status === "overdue").length,
    scheduled: posts.filter((post) => post.status === "scheduled" || post.status === "due_today").length,
    scheduling: posts.filter((post) => post.status === "scheduling").length,
    completed: posts.filter((post) => post.status === "completed").length,
  };
  const labels: Record<ClientCampaignBarSegment["key"], string> = {
    live: "Live",
    overdue: "Overdue",
    scheduled: "Scheduled",
    scheduling: "To be confirmed",
    completed: "Completed",
  };
  const order: ClientCampaignBarSegment["key"][] = [
    "live",
    "overdue",
    "scheduled",
    "scheduling",
    "completed",
  ];
  return order.map((key) => ({
    key,
    label: labels[key],
    count: counts[key],
    percent: (counts[key] / total) * 100,
  }));
}

export function matchClientCreatorByName(
  name: string,
  creators: Array<
    Pick<
      ClientCreatorCard,
      "displayName" | "handle" | "avatarUrl" | "profileUrl" | "platform" | "platformAccounts"
    >
  >
) {
  const key = name.trim().replace(/^@+/, "").toLowerCase();
  if (!key) return undefined;
  return creators.find((creator) => {
    const display = creator.displayName.trim().replace(/^@+/, "").toLowerCase();
    const handle = creator.handle?.trim().replace(/^@+/, "").toLowerCase();
    return display === key || handle === key;
  });
}

const PLATFORM_PREFIX: Record<string, string> = {
  instagram: "IG",
  tiktok: "TT",
  facebook: "FB",
  youtube: "YT",
  snapchat: "SC",
};

export function clientDeliverablePlatformPrefix(platform: string | null | undefined): string {
  const key = (platform ?? "").trim().toLowerCase();
  return PLATFORM_PREFIX[key] ?? "";
}

/** Canonical client-facing format so "ig reel" and "IG Reel" fold together. */
export function normalizeClientDeliverableFormat(
  kind: string | null | undefined,
  platform: string | null | undefined
): string {
  const raw = (kind ?? "").trim();
  const k = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  const prefix = clientDeliverablePlatformPrefix(platform);
  if (/spotlight/.test(k)) return `${prefix || "SC"} Spotlight`;
  if (/reel/.test(k)) return `${prefix || "IG"} Reel`;
  if (/stor/.test(k)) return `${prefix || "IG"} Story`;
  if (/snap/.test(k)) return `${prefix || "SC"} Snap`;
  if (/short/.test(k)) return `${prefix || "YT"} Short`;
  if (/video/.test(k)) return `${prefix || "TT"} Video`;
  if (/carousel/.test(k)) return `${prefix || "IG"} Carousel`;
  if (/live/.test(k)) return `${prefix || "IG"} Live`;
  if (/photo|image/.test(k)) return `${prefix || "IG"} Photo`;
  if (/post/.test(k)) return `${prefix || "IG"} Post`;
  return raw || "—";
}
