import { sanitizeMetricValue as num } from './merge-metrics';
/** Preserve platform semantics: TikTok playCount is its public view count. */
export function extractVideoCounters(platform: string, row: Record<string, unknown>) {
 if (platform === 'instagram') return {plays:num(row.videoPlayCount ?? row.playCount ?? row.play_count), views:num(row.videoViewCount ?? row.viewCount ?? row.views)};
 if (platform === 'tiktok') return {plays:null, views:num(row.playCount ?? row.videoPlayCount ?? row.play_count ?? row.viewCount ?? row.views)};
 return {plays:num(row.playCount ?? row.videoPlayCount), views:num(row.videoViewCount ?? row.viewCount ?? row.views)};
}
