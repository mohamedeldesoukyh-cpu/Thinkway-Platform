import type { CampaignPublicationRow } from '@/lib/domains/campaign/types';
import { formatCompactCount } from '@/lib/campaigns/performance-calculations';
export type ReportMetric = 'reach' | 'impressions' | 'views';
export function reportedValue(row: CampaignPublicationRow, metric: ReportMetric): number | null {
 const value=row[metric];
 if(value == null || !Number.isFinite(value) || value < 0) return null;
 if(metric !== 'views' && row[`${metric}_source`] !== 'actual' && row[`${metric}_source`] !== 'manual') return null;
 return value;
}
export function metricCoverage(rows: CampaignPublicationRow[], metric: ReportMetric) {
 const values=rows.map(r=>reportedValue(r,metric)).filter((v):v is number=>v!=null);
 return {total:values.length ? values.reduce((a,b)=>a+b,0) : null, available:values.length, missing:rows.length-values.length};
}
export function reportedTotal(rows: CampaignPublicationRow[], metric: ReportMetric): string {
 const m=metricCoverage(rows,metric);return m.total == null ? 'Unavailable' : formatCompactCount(m.total);
}
export function coverageLabel(rows: CampaignPublicationRow[], metric: ReportMetric): string {
 const m=metricCoverage(rows,metric);return m.available ? `Based on ${m.available} of ${rows.length} publications` : "";
}
export function forecastTotal(rows: CampaignPublicationRow[], metric: 'reach'|'impressions'): string {
 const values=rows.filter(r=>r[`${metric}_source`]==='forecast' && r[metric]!=null).map(r=>r[metric]!);
 return values.length ? formatCompactCount(values.reduce((a,b)=>a+b,0)) : 'Unavailable';
}
export function playMetricLabel(row: Pick<CampaignPublicationRow, 'platform'>): string {
 return ['instagram', 'tiktok'].includes((row.platform ?? "").toLowerCase()) ? 'Video Play Count' : 'Views';
}
export function playTotalLabel(rows: CampaignPublicationRow[]): string {
 const labels = new Set(rows.filter(row => row.views != null).map(playMetricLabel));
 return labels.size === 1 ? [...labels][0] : 'Video Plays & Views';
}
export function videoCounters(row: CampaignPublicationRow) {
 if (row.report_video_counters) return row.report_video_counters;
 // Legacy Instagram/TikTok imports stored the play counter in views.
 if (playMetricLabel(row) === 'Video Play Count') return {plays:row.plays ?? row.views, views:null};
 return {plays:row.plays ?? null, views:row.views};
}
export function videoMetricTotals(rows: CampaignPublicationRow[]) {
 return (['plays','views'] as const).flatMap(key=>{
  const values=rows.map(row=>videoCounters(row)[key]).filter((n):n is number=>n!=null && Number.isFinite(n) && n>=0);
  return values.length ? [{label:key==='plays'?'Video Play Count':'Views',value:formatCompactCount(values.reduce((a,b)=>a+b,0)),coverage:`Based on ${values.length} of ${rows.length} publications`}] : [];
 });
}
