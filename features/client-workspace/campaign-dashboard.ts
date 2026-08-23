import {
  clientCampaignGlanceCounts,
  clientCampaignPerformanceHasData,
  emptyClientCampaignPerformance,
  type ClientCampaignPerformance,
  type ClientCampaignPostRow,
} from "./campaign-execution";
import { formatCompactCount, formatEngagementPct } from "./format";

export const CAMPAIGN_SETUP_IN_PROGRESS_COPY = "Campaign setup is in progress.";
export const NO_UPCOMING_PUBLICATIONS_COPY = "No upcoming publications.";
export const NO_OVERDUE_PUBLICATIONS_COPY = "No overdue publications.";
export const PERFORMANCE_PENDING_COPY =
  "Performance data will appear as publications are tracked.";
export const CAMPAIGN_PROGRESS_LIVE_EXPLANATION =
  "Share of campaign creators with at least one live publication.";
export const CAMPAIGN_PROGRESS_COMPLETED_EXPLANATION =
  "Share of campaign publications that are completed.";

export type ClientCampaignDashboardCounts = {
  approvedCreators: number;
  scheduled: number;
  dueToday: number;
  live: number;
  overdue: number;
  completed: number;
};

export type ClientCampaignProgress = {
  current: number;
  total: number;
  percent: number;
  headline: string;
  explanation: string;
  kind: "creators_live" | "posts_completed";
};

export type ClientCampaignPerformanceMetric = {
  key: keyof ClientCampaignPerformance;
  label: string;
  value: number;
  formatted: string;
};

export type ClientCampaignDashboard = {
  ready: boolean;
  counts: ClientCampaignDashboardCounts;
  progress: ClientCampaignProgress | null;
  upcoming: ClientCampaignPostRow[];
  live: ClientCampaignPostRow[];
  overdue: ClientCampaignPostRow[];
  performance: ClientCampaignPerformance;
  performanceMetrics: ClientCampaignPerformanceMetric[];
};

const PERFORMANCE_METRIC_ORDER: Array<{
  key: keyof ClientCampaignPerformance;
  label: string;
}> = [
  { key: "views", label: "Views" },
  { key: "reach", label: "Reach" },
  { key: "impressions", label: "Impressions" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "engagementRate", label: "Engagement Rate" },
];

function emptyDashboardCounts(): ClientCampaignDashboardCounts {
  return {
    approvedCreators: 0,
    scheduled: 0,
    dueToday: 0,
    live: 0,
    overdue: 0,
    completed: 0,
  };
}

function uniqueCreatorNames(posts: ClientCampaignPostRow[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const post of posts) {
    const name = post.creatorName.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function countByStatus(posts: ClientCampaignPostRow[], status: ClientCampaignPostRow["status"]): number {
  return posts.filter((post) => post.status === status).length;
}

function compareDateThenName(
  leftDate: string | null,
  rightDate: string | null,
  leftName: string,
  rightName: string
): number {
  const left = leftDate ?? "9999-12-31";
  const right = rightDate ?? "9999-12-31";
  return left.localeCompare(right) || leftName.localeCompare(rightName);
}

function sumStoredMetric(
  posts: ClientCampaignPostRow[],
  key: Exclude<keyof ClientCampaignPerformance, "engagementRate">
): number | null {
  let total = 0;
  let found = false;
  for (const post of posts) {
    const value = post.performance[key];
    if (value == null) continue;
    found = true;
    total += value;
  }
  return found ? total : null;
}

function aggregatedEngagementRate(posts: ClientCampaignPostRow[]): number | null {
  const withRate = posts.filter((post) => post.performance.engagementRate != null);
  if (withRate.length === 0) return null;
  const withViews = withRate.filter(
    (post) => post.performance.views != null && post.performance.views > 0
  );
  if (withViews.length > 0) {
    let weighted = 0;
    let weight = 0;
    for (const post of withViews) {
      weighted += (post.performance.engagementRate ?? 0) * (post.performance.views ?? 0);
      weight += post.performance.views ?? 0;
    }
    return weight > 0 ? weighted / weight : null;
  }
  return (
    withRate.reduce((sum, post) => sum + (post.performance.engagementRate ?? 0), 0) /
    withRate.length
  );
}

export function clientCampaignDashboardCounts(
  posts: ClientCampaignPostRow[]
): ClientCampaignDashboardCounts {
  return {
    approvedCreators: uniqueCreatorNames(posts).length,
    scheduled: countByStatus(posts, "scheduled"),
    dueToday: countByStatus(posts, "due_today"),
    live: countByStatus(posts, "live"),
    overdue: countByStatus(posts, "overdue"),
    completed: countByStatus(posts, "completed"),
  };
}

export function clientCampaignProgress(
  posts: ClientCampaignPostRow[]
): ClientCampaignProgress | null {
  if (posts.length === 0) return null;
  const creators = uniqueCreatorNames(posts);
  const completed = countByStatus(posts, "completed");
  if (completed === posts.length) {
    const percent = Math.round((completed / posts.length) * 100);
    return {
      current: completed,
      total: posts.length,
      percent,
      headline: `${completed} / ${posts.length} completed`,
      explanation: CAMPAIGN_PROGRESS_COMPLETED_EXPLANATION,
      kind: "posts_completed",
    };
  }
  const liveCreators = uniqueCreatorNames(posts.filter((post) => post.status === "live")).length;
  const total = creators.length;
  const percent = total > 0 ? Math.round((liveCreators / total) * 100) : 0;
  return {
    current: liveCreators,
    total,
    percent,
    headline: `${liveCreators} of ${total} creators live`,
    explanation: CAMPAIGN_PROGRESS_LIVE_EXPLANATION,
    kind: "creators_live",
  };
}

export function clientCampaignUpcomingPosts(posts: ClientCampaignPostRow[]): ClientCampaignPostRow[] {
  return posts
    .filter(
      (post) =>
        (post.status === "scheduled" || post.status === "due_today") && Boolean(post.scheduledDate)
    )
    .sort((left, right) =>
      compareDateThenName(left.scheduledDate, right.scheduledDate, left.creatorName, right.creatorName)
    );
}

export function clientCampaignLivePosts(posts: ClientCampaignPostRow[]): ClientCampaignPostRow[] {
  return posts
    .filter((post) => post.status === "live")
    .sort((left, right) =>
      compareDateThenName(
        right.publicationDate,
        left.publicationDate,
        left.creatorName,
        right.creatorName
      )
    );
}

export function clientCampaignOverduePosts(posts: ClientCampaignPostRow[]): ClientCampaignPostRow[] {
  return posts
    .filter((post) => post.status === "overdue")
    .sort((left, right) =>
      compareDateThenName(left.scheduledDate, right.scheduledDate, left.creatorName, right.creatorName)
    );
}

export function clientCampaignDashboardPerformance(
  posts: ClientCampaignPostRow[]
): ClientCampaignPerformance {
  return {
    views: sumStoredMetric(posts, "views"),
    likes: sumStoredMetric(posts, "likes"),
    comments: sumStoredMetric(posts, "comments"),
    shares: sumStoredMetric(posts, "shares"),
    reach: sumStoredMetric(posts, "reach"),
    impressions: sumStoredMetric(posts, "impressions"),
    engagementRate: aggregatedEngagementRate(posts),
  };
}

export function clientCampaignDashboardPerformanceMetrics(
  performance: ClientCampaignPerformance
): ClientCampaignPerformanceMetric[] {
  if (!clientCampaignPerformanceHasData(performance)) return [];
  const metrics: ClientCampaignPerformanceMetric[] = [];
  for (const item of PERFORMANCE_METRIC_ORDER) {
    const value = performance[item.key];
    if (value == null) continue;
    metrics.push({
      key: item.key,
      label: item.label,
      value,
      formatted:
        item.key === "engagementRate" ? formatEngagementPct(value) : formatCompactCount(value),
    });
  }
  return metrics;
}

export function projectClientCampaignDashboard(
  posts: ClientCampaignPostRow[]
): ClientCampaignDashboard {
  if (posts.length === 0) {
    return {
      ready: false,
      counts: emptyDashboardCounts(),
      progress: null,
      upcoming: [],
      live: [],
      overdue: [],
      performance: emptyClientCampaignPerformance(),
      performanceMetrics: [],
    };
  }
  const performance = clientCampaignDashboardPerformance(posts);
  return {
    ready: true,
    counts: clientCampaignDashboardCounts(posts),
    progress: clientCampaignProgress(posts),
    upcoming: clientCampaignUpcomingPosts(posts),
    live: clientCampaignLivePosts(posts),
    overdue: clientCampaignOverduePosts(posts),
    performance,
    performanceMetrics: clientCampaignDashboardPerformanceMetrics(performance),
  };
}

/** Dashboard KPIs must match Stage 3 grouped execution rows. */
export function clientCampaignDashboardReconcilesWithPosts(
  posts: ClientCampaignPostRow[]
): boolean {
  const dashboard = projectClientCampaignDashboard(posts);
  const glance = clientCampaignGlanceCounts(posts);
  const scheduling = countByStatus(posts, "scheduling");
  return (
    dashboard.counts.live === glance.live &&
    dashboard.counts.overdue === glance.overdue &&
    dashboard.counts.completed === glance.completed &&
    dashboard.counts.scheduled + dashboard.counts.dueToday + scheduling === glance.upcoming &&
    dashboard.live.length === glance.live &&
    dashboard.overdue.length === glance.overdue
  );
}
