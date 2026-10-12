import { sanitizeMetricValue as num } from './merge-metrics';
/** Preserve provider counters separately; never derive views from plays. */
export function extractVideoCounters(platform: string, row: Record<string, unknown>) {
 if (platform === 'instagram') return {plays:num(row.videoPlayCount ?? row.playCount ?? row.play_count), views:num(row.videoViewCount ?? row.viewCount ?? row.views)};
 if (platform === 'tiktok') return {plays:num(row.playCount ?? row.videoPlayCount ?? row.play_count), views:num(row.viewCount ?? row.views)};
 return {plays:num(row.playCount ?? row.videoPlayCount), views:num(row.videoViewCount ?? row.viewCount ?? row.views)};
}
