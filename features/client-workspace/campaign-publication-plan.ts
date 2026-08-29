import { clientPostDocumentationScriptUnit } from "@/lib/campaign-script";

import {
  CLIENT_CAMPAIGN_POST_STATUS_LABEL,
  formatClientCampaignPerformance,
  type ClientCampaignPostRow,
  type ClientCampaignPostStatus,
} from "./campaign-execution";
import { normalizeClientDeliverableFormat } from "./campaign-tab-aggregates";

export const PUBLICATION_PLAN_FILTERS = [
  "all",
  "overdue",
  "live",
  "scheduled",
  "scheduling",
  "completed",
] as const;
export type PublicationPlanFilter = (typeof PUBLICATION_PLAN_FILTERS)[number];

export type PublicationPlanViewMode = "grouped" | "rows";

export type PublicationPlanStatusTone = "tbc" | "sched" | "live" | "od" | "done";

const STATUS_RANK: Record<ClientCampaignPostStatus, number> = {
  overdue: 0,
  live: 1,
  due_today: 2,
  scheduled: 3,
  scheduling: 4,
  completed: 5,
};

export function publicationPlanStatusTone(
  status: ClientCampaignPostStatus
): PublicationPlanStatusTone {
  if (status === "overdue") return "od";
  if (status === "live") return "live";
  if (status === "completed") return "done";
  if (status === "scheduling") return "tbc";
  return "sched";
}

export function creatorInitials(name: string): string {
  const cleaned = name.replace(/^@+/, "").trim();
  const parts = cleaned.split(/[^a-zA-Z]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const letters = cleaned.replace(/[^a-zA-Z]/g, "");
  return letters.slice(0, 2).toUpperCase() || "–";
}

export function filterPublicationPlanPosts(
  posts: ClientCampaignPostRow[],
  filter: PublicationPlanFilter,
  query: string,
  format = "all"
): ClientCampaignPostRow[] {
  const q = query.trim().toLowerCase();
  return posts.filter((post) => {
    if (filter === "live" && post.status !== "live") return false;
    if (filter === "overdue" && post.status !== "overdue") return false;
    if (filter === "scheduling" && post.status !== "scheduling") return false;
    if (filter === "completed" && post.status !== "completed") return false;
    if (filter === "scheduled" && post.status !== "scheduled" && post.status !== "due_today") {
      return false;
    }
    const canonical = normalizeClientDeliverableFormat(post.deliverable, post.platform);
    if (format !== "all" && canonical !== format) return false;
    if (!q) return true;
    return (
      post.creatorName.toLowerCase().includes(q) ||
      post.deliverable.toLowerCase().includes(q) ||
      canonical.toLowerCase().includes(q) ||
      post.platformLabel.toLowerCase().includes(q)
    );
  });
}

export type FoldedDeliverableRow = {
  key: string;
  sample: ClientCampaignPostRow;
  count: number;
};

export type CreatorPublicationGroup = {
  creatorName: string;
  posts: ClientCampaignPostRow[];
  kinds: Array<{ label: string; count: number }>;
  statuses: ClientCampaignPostStatus[];
  doneCount: number;
  total: number;
  percent: number;
  folded: FoldedDeliverableRow[];
};

function foldIdenticalDeliverables(posts: ClientCampaignPostRow[]): FoldedDeliverableRow[] {
  const map = new Map<string, FoldedDeliverableRow>();
  for (const post of posts) {
    const format = normalizeClientDeliverableFormat(post.deliverable, post.platform);
    const unitKey = clientPostDocumentationScriptUnit(post)?.unitKey ?? "";
    const key = [
      unitKey,
      format,
      post.status,
      post.scheduledDate ?? "",
      post.publicationDate ?? "",
      formatClientCampaignPerformance(post.performance),
    ].join("|");
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { key, sample: { ...post, deliverable: format }, count: 1 });
    }
  }
  return [...map.values()];
}

function uniqueStatuses(posts: ClientCampaignPostRow[]): ClientCampaignPostStatus[] {
  const seen = new Set<ClientCampaignPostStatus>();
  const statuses: ClientCampaignPostStatus[] = [];
  const ranked = [...posts].sort((left, right) => STATUS_RANK[left.status] - STATUS_RANK[right.status]);
  for (const post of ranked) {
    if (seen.has(post.status)) continue;
    seen.add(post.status);
    statuses.push(post.status);
  }
  return statuses;
}

function kindCounts(posts: ClientCampaignPostRow[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const label = normalizeClientDeliverableFormat(post.deliverable, post.platform);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

export function groupPublicationPlanByCreator(
  posts: ClientCampaignPostRow[]
): CreatorPublicationGroup[] {
  const byCreator = new Map<string, ClientCampaignPostRow[]>();
  for (const post of posts) {
    const name = post.creatorName.trim() || "Creator";
    const list = byCreator.get(name) ?? [];
    list.push(post);
    byCreator.set(name, list);
  }
  return [...byCreator.entries()]
    .map(([creatorName, groupPosts]) => {
      const doneCount = groupPosts.filter(
        (post) => post.status === "live" || post.status === "completed"
      ).length;
      const total = groupPosts.length;
      return {
        creatorName,
        posts: groupPosts,
        kinds: kindCounts(groupPosts),
        statuses: uniqueStatuses(groupPosts),
        doneCount,
        total,
        percent: total > 0 ? Math.round((doneCount / total) * 100) : 0,
        folded: foldIdenticalDeliverables(groupPosts),
      };
    })
    .sort((left, right) => {
      const leftRank = Math.min(...left.posts.map((post) => STATUS_RANK[post.status]));
      const rightRank = Math.min(...right.posts.map((post) => STATUS_RANK[post.status]));
      return leftRank - rightRank || left.creatorName.localeCompare(right.creatorName);
    });
}

/** Creator groups stay collapsed until the client expands a row (or the overdue CTA). */
export function defaultExpandedCreators(_groups: CreatorPublicationGroup[]): string[] {
  return [];
}

export function publicationPlanFilterCounts(posts: ClientCampaignPostRow[]): Record<
  PublicationPlanFilter,
  number
> {
  return {
    all: posts.length,
    overdue: posts.filter((post) => post.status === "overdue").length,
    live: posts.filter((post) => post.status === "live").length,
    scheduled: posts.filter((post) => post.status === "scheduled" || post.status === "due_today").length,
    scheduling: posts.filter((post) => post.status === "scheduling").length,
    completed: posts.filter((post) => post.status === "completed").length,
  };
}

export function publicationPlanFormatCounts(
  posts: ClientCampaignPostRow[]
): Array<{ format: string; count: number }> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const format = normalizeClientDeliverableFormat(post.deliverable, post.platform);
    counts.set(format, (counts.get(format) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([format, count]) => ({ format, count }))
    .sort((left, right) => right.count - left.count || left.format.localeCompare(right.format));
}

export function rankedPublicationRows(posts: ClientCampaignPostRow[]): ClientCampaignPostRow[] {
  return [...posts].sort(
    (left, right) =>
      STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
      left.creatorName.localeCompare(right.creatorName)
  );
}

export { CLIENT_CAMPAIGN_POST_STATUS_LABEL };
