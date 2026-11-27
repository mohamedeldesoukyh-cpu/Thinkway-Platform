import assert from 'node:assert/strict';
import test from 'node:test';
import type { CampaignPublicationRow } from '@/lib/domains/campaign/types';
import { setPublicationCollab } from '@/lib/campaigns/publication-content-url';
import { buildPerformanceSummary, buildPerformanceCharts } from './campaign-performance-aggregates';
import { applyPublicationValueScopes, buildAssignmentAgreedPlatformIndexFromAssignments } from './publication-value-scope';

function row(id: string, line: string, platform: string, reach: number): CampaignPublicationRow {
  return { id, campaign_line_id: line, influencer_id: line, influencer_name: line, platform, content_url: `https://example.com/${id}`, notes: null, publication_type: platform + '_video', publication_type_label: 'Video', publication_date: '2026-11-25', created_at: '2026-11-25T00:00:00Z', reach, reach_source: 'actual', impressions: reach * 2, impressions_source: 'actual', views: reach * 3, total_engagements: reach / 10, engagement_rate: 10, cpm: null, cpv: null, currency: 'EGP' } as CampaignPublicationRow;
}

test('attendance classification, collaboration totals and chart totals agree', () => {
  const index = buildAssignmentAgreedPlatformIndexFromAssignments({ hierarchyGroups: ['adham', 'wagdi'].map(id => ({ line: { id, influencer_id: id }, deliverables: [{ platform: 'instagram', deliverable_type: 'instagram_reel' }, { platform: 'youtube', deliverable_type: 'visit' }] })) });
  const youtube = row('yt-a', 'adham', 'youtube', 100);
  youtube.content_url = 'https://youtube.com/shorts/shared';
  youtube.notes = setPublicationCollab(null, true, { id: 'wagdi', name: 'wagdi' });
  const partner = { ...youtube, id: 'yt-w', campaign_line_id: 'wagdi', influencer_id: 'wagdi', influencer_name: 'wagdi', notes: setPublicationCollab(null, true, {id:'adham',name:'adham'}) };
  const publications = applyPublicationValueScopes([row('ig', 'adham', 'instagram', 50), youtube, partner], index);
  assert.deepEqual(publications.map(p => p.value_scope), ['agreed','added_value','added_value']);
  const summary = buildPerformanceSummary(publications);
  const charts = buildPerformanceCharts(publications);
  assert.equal(summary.total_publications, 2);
  assert.equal(summary.agreed_publications, 1);
  assert.equal(summary.added_value_publications, 1);
  assert.equal(summary.total_reach, 150);
  assert.equal(summary.total_engagements, 15);
  assert.equal(charts.platform_split.reduce((sum, p) => sum + p.count, 0), summary.total_publications);
  assert.equal(charts.performance_over_time.reduce((sum, p) => sum + p.reach, 0), summary.total_reach);
  const selected = publications.filter(p => p.platform === 'youtube');
  assert.equal(buildPerformanceSummary(selected).total_reach, 100);
  assert.equal(buildPerformanceSummary(selected).agreed_publications, 0);
  assert.equal(buildPerformanceCharts(selected).platform_split.length, 1);
});
