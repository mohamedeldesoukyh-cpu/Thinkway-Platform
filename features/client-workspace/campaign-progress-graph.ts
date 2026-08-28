import {
  dateOnly,
  formatClientDashboardDate,
  formatClientScheduleDate,
  todayYmd,
  type ClientCampaignPostRow,
} from "./campaign-execution";
import { normalizeClientDeliverableFormat } from "./campaign-tab-aggregates";

export const CAMPAIGN_PROGRESS_COPY =
  "Each creator has a line per content type. Circles are live-ad dates. The line fills as each post goes live.";

export function campaignProgressRangeCopy(startLabel: string, endLabel: string): string {
  return `Start ${startLabel} · End ${endLabel}`;
}

export type CampaignProgressDotTone = "live" | "od" | "sched" | "tbc" | "done";

export type CampaignProgressCheckpoint = {
  id: string;
  date: string | null;
  percent: number;
  reached: boolean;
  overdue: boolean;
  tone: CampaignProgressDotTone;
  label: string;
  showLabel: boolean;
  title: string;
  contentUrl: string | null;
};

export type CampaignProgressTrack = {
  key: string;
  format: string;
  platform: string;
  checkpoints: CampaignProgressCheckpoint[];
  filledPercent: number;
  reachedCount: number;
  totalCount: number;
};

export type CampaignProgressCreator = {
  creatorName: string;
  avatarUrl: string | null;
  tracks: CampaignProgressTrack[];
  reachedCount: number;
  totalCount: number;
};

export type CampaignProgressGraph = {
  startDate: string;
  endDate: string;
  startLabel: string;
  endLabel: string;
  startFullLabel: string;
  endFullLabel: string;
  todayPercent: number | null;
  creators: CampaignProgressCreator[];
};

const INNER_START = 4;
const INNER_END = 96;

function dayMs(ymd: string): number {
  return new Date(`${ymd}T12:00:00`).getTime();
}

function postDates(posts: ClientCampaignPostRow[]): string[] {
  const dates: string[] = [];
  for (const post of posts) {
    const scheduled = dateOnly(post.scheduledDate);
    const published = dateOnly(post.publicationDate);
    if (scheduled) dates.push(scheduled);
    if (published) dates.push(published);
  }
  return dates;
}

export function dateToCampaignPercent(
  date: string,
  startDate: string,
  endDate: string
): number {
  const start = dayMs(startDate);
  const end = dayMs(endDate);
  const at = dayMs(date);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(at)) {
    return INNER_START;
  }
  if (end <= start) return 50;
  const raw = ((at - start) / (end - start)) * 100;
  const inner = INNER_START + (Math.max(0, Math.min(100, raw)) / 100) * (INNER_END - INNER_START);
  return Math.round(inner * 10) / 10;
}

export function resolveCampaignProgressWindow(input: {
  posts: ClientCampaignPostRow[];
  startDate?: string | null;
  endDate?: string | null;
  today?: string;
}): { startDate: string; endDate: string } | null {
  const today = input.today ?? todayYmd();
  const fromPosts = postDates(input.posts).sort();
  const headerStart = dateOnly(input.startDate);
  const headerEnd = dateOnly(input.endDate);
  const all = [...fromPosts];
  if (headerStart) all.push(headerStart);
  if (headerEnd) all.push(headerEnd);
  if (all.length === 0) return null;
  all.sort();
  let startDate = headerStart ?? all[0]!;
  let endDate = headerEnd ?? all[all.length - 1]!;
  if (fromPosts.length > 0) {
    if (fromPosts[0]! < startDate) startDate = fromPosts[0]!;
    if (fromPosts[fromPosts.length - 1]! > endDate) {
      endDate = fromPosts[fromPosts.length - 1]!;
    }
  }
  if (!headerEnd && today > endDate) endDate = today;
  if (startDate > endDate) {
    const swap = startDate;
    startDate = endDate;
    endDate = swap;
  }
  return { startDate, endDate };
}

function checkpointReached(post: ClientCampaignPostRow): boolean {
  return post.status === "live" || post.status === "completed";
}

function checkpointTone(post: ClientCampaignPostRow): CampaignProgressDotTone {
  if (post.status === "completed") return "done";
  if (post.status === "live") return "live";
  if (post.status === "overdue") return "od";
  if (post.status === "scheduling") return "tbc";
  return "sched";
}

function spreadPercents(percents: number[]): number[] {
  if (percents.length <= 1) return percents;
  const items = percents.map((percent, index) => ({ percent, index }));
  items.sort((left, right) => left.percent - right.percent || left.index - right.index);
  const span = INNER_END - INNER_START;
  const minGap = Math.min(2.4, span / Math.max(1, items.length - 1));
  for (let index = 1; index < items.length; index += 1) {
    const prev = items[index - 1]!;
    const current = items[index]!;
    if (current.percent < prev.percent + minGap) {
      current.percent = prev.percent + minGap;
    }
  }
  const overflow = items[items.length - 1]!.percent - INNER_END;
  if (overflow > 0) {
    for (const item of items) {
      item.percent = Math.max(
        INNER_START,
        Math.round((item.percent - overflow * ((item.percent - INNER_START) / span)) * 10) / 10
      );
    }
    for (let index = 1; index < items.length; index += 1) {
      if (items[index]!.percent <= items[index - 1]!.percent) {
        items[index]!.percent = Math.min(INNER_END, items[index - 1]!.percent + 0.4);
      }
    }
  }
  const next = [...percents];
  for (const item of items) next[item.index] = Math.round(item.percent * 10) / 10;
  return next;
}

function trackFilledPercent(checkpoints: CampaignProgressCheckpoint[]): number {
  if (checkpoints.length === 0) return 0;
  const reached = checkpoints.filter((checkpoint) => checkpoint.reached);
  if (reached.length === checkpoints.length) return 100;
  if (reached.length === 0) return INNER_START;
  return Math.max(...reached.map((checkpoint) => checkpoint.percent));
}

function creatorKey(name: string): string {
  return name.trim() || "Creator";
}

export function projectCampaignProgressGraph(input: {
  posts: ClientCampaignPostRow[];
  startDate?: string | null;
  endDate?: string | null;
  today?: string;
}): CampaignProgressGraph | null {
  const today = input.today ?? todayYmd();
  const window = resolveCampaignProgressWindow({
    posts: input.posts,
    startDate: input.startDate,
    endDate: input.endDate,
    today,
  });
  if (!window || input.posts.length === 0) return null;

  const grouped = new Map<
    string,
    { creatorName: string; avatarUrl: string | null; tracks: Map<string, ClientCampaignPostRow[]> }
  >();
  for (const post of input.posts) {
    const name = creatorKey(post.creatorName);
    const format = normalizeClientDeliverableFormat(post.deliverable, post.platform);
    let creator = grouped.get(name);
    if (!creator) {
      creator = { creatorName: name, avatarUrl: post.avatarUrl?.trim() || null, tracks: new Map() };
      grouped.set(name, creator);
    } else if (!creator.avatarUrl && post.avatarUrl?.trim()) {
      creator.avatarUrl = post.avatarUrl.trim();
    }
    const trackKey = `${post.platform || "any"}:${format}`;
    const rows = creator.tracks.get(trackKey) ?? [];
    rows.push(post);
    creator.tracks.set(trackKey, rows);
  }

  const creators: CampaignProgressCreator[] = [...grouped.values()]
    .sort((left, right) => left.creatorName.localeCompare(right.creatorName))
    .map((creator) => {
      const tracks: CampaignProgressTrack[] = [...creator.tracks.entries()]
        .map(([key, rows]) => {
          const ordered = [...rows].sort((left, right) => {
            const leftDate = left.scheduledDate ?? left.publicationDate ?? "9999-12-31";
            const rightDate = right.scheduledDate ?? right.publicationDate ?? "9999-12-31";
            return leftDate.localeCompare(rightDate) || left.id.localeCompare(right.id);
          });
          const rawPercents = ordered.map((post) => {
            const date = post.scheduledDate ?? post.publicationDate;
            return date
              ? dateToCampaignPercent(date, window.startDate, window.endDate)
              : INNER_START;
          });
          const percents = spreadPercents(rawPercents);
          const checkpoints: CampaignProgressCheckpoint[] = ordered.map((post, index) => {
            const date = post.scheduledDate ?? post.publicationDate;
            const reached = checkpointReached(post);
            const label = formatClientDashboardDate(date) ?? "TBC";
            const previousDate = ordered[index - 1]?.scheduledDate ?? ordered[index - 1]?.publicationDate;
            return {
              id: post.id,
              date,
              percent: percents[index] ?? INNER_START,
              reached,
              overdue: post.status === "overdue",
              tone: checkpointTone(post),
              label,
              showLabel: date !== previousDate,
              title: `${normalizeClientDeliverableFormat(post.deliverable, post.platform)} · ${label}${
                reached ? " · live" : post.status === "overdue" ? " · overdue" : ""
              }`,
              contentUrl: post.contentUrl,
            };
          });
          const format = normalizeClientDeliverableFormat(
            ordered[0]?.deliverable,
            ordered[0]?.platform
          );
          return {
            key,
            format,
            platform: ordered[0]?.platform ?? "",
            checkpoints,
            filledPercent: trackFilledPercent(checkpoints),
            reachedCount: checkpoints.filter((checkpoint) => checkpoint.reached).length,
            totalCount: checkpoints.length,
          };
        })
        .sort((left, right) => left.format.localeCompare(right.format));
      const reachedCount = tracks.reduce((sum, track) => sum + track.reachedCount, 0);
      const totalCount = tracks.reduce((sum, track) => sum + track.totalCount, 0);
      return {
        creatorName: creator.creatorName,
        avatarUrl: creator.avatarUrl,
        tracks,
        reachedCount,
        totalCount,
      };
    });

  const todayInWindow = today >= window.startDate && today <= window.endDate;
  return {
    startDate: window.startDate,
    endDate: window.endDate,
    startLabel: formatClientDashboardDate(window.startDate) ?? window.startDate,
    endLabel: formatClientDashboardDate(window.endDate) ?? window.endDate,
    startFullLabel: formatClientScheduleDate(window.startDate) ?? window.startDate,
    endFullLabel: formatClientScheduleDate(window.endDate) ?? window.endDate,
    todayPercent: todayInWindow
      ? dateToCampaignPercent(today, window.startDate, window.endDate)
      : null,
    creators,
  };
}
