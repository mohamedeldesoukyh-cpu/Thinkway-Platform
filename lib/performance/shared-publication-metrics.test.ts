import assert from 'node:assert/strict';
import test from 'node:test';
import type { CampaignPublicationRow } from '@/lib/domains/campaign/types';
import { setPublicationCollab, uniqueCollabPublications } from '@/lib/campaigns/publication-content-url';
import { alignSharedPublicationMetrics } from './shared-publication-metrics';
import { buildPerformanceSummary } from './campaign-performance-aggregates';
import { applyPublicationValueScopes, buildAssignmentAgreedPlatformIndexFromAssignments } from './publication-value-scope';
import { mapApifyPayloadToMetrics } from './metrics-collector/providers/apify-mapper';
import { renderPcard } from './report/performance-report-v2-parts';

test('Instagram and Facebook retain separate counters, shared creator rows agree, and totals count each post once', () => {
  const make = (id: string, creator: string, platform: string, likes: number, comments: number, time: string) => ({
    id, campaign_line_id: creator, influencer_id: creator, influencer_name: creator,
    platform, platform_label: platform, publication_type: platform + '_reel', publication_type_label: 'Reel',
    content_url: platform === 'instagram' ? 'https://instagram.com/p/shared/' : 'https://facebook.com/reel/123',
    notes: setPublicationCollab(null, true, {id: creator === 'wagdi' ? 'adham' : 'wagdi', name: 'Partner'}),
    ...mapApifyPayloadToMetrics(platform, {likesCount: likes, commentsCount: comments}),
    total_engagements: likes + comments, last_synced_at: time, created_at: time,
    currency: 'EGP', views: null, reach: null, impressions: null,
  } as CampaignPublicationRow);
  const input = [
    make('ig-w', 'wagdi', 'instagram', 19347, 392, '2026-11-27T17:58:00Z'),
    make('ig-a', 'adham', 'instagram', 19344, 392, '2026-11-27T17:57:00Z'),
    make('fb-w', 'wagdi', 'facebook', 26317, 791, '2026-11-27T17:57:00Z'),
    make('fb-a', 'adham', 'facebook', 26300, 790, '2026-11-27T17:56:00Z'),
  ];
  const index = buildAssignmentAgreedPlatformIndexFromAssignments({hierarchyGroups: ['wagdi','adham'].map(id => ({line:{id,influencer_id:id},deliverables:[{platform:'instagram',deliverable_type:'instagram_reel'}]}))});
  const rows = applyPublicationValueScopes(alignSharedPublicationMetrics(input), index);
  assert.deepEqual(rows.map(row => [row.likes,row.comments]), [[19347,392],[19347,392],[26317,791],[26317,791]]);
  assert.deepEqual(rows.map(row => row.value_scope), ['agreed','agreed','added_value','added_value']);
  assert.equal(input[1].likes,19344, 'stored records must not be mutated');
  assert.equal(rows[1].influencer_name,'adham');
  const summary = buildPerformanceSummary(rows);
  assert.equal(summary.total_publications,2);
  assert.equal(summary.added_value_publications,1);
  assert.equal(summary.total_engagements,19347+392+26317+791);
  assert.equal(uniqueCollabPublications(rows).reduce((sum,row)=>sum+(row.likes??0),0),45664);
  // The report cards render the same values as the table bundle, including Added value.
  const report = renderPcard(rows[3]);
  assert.match(report,/26\.3K/);
  assert.match(report,/791/);
  assert.match(report,/Added value/i);
  const mixedScope = alignSharedPublicationMetrics(rows.map(row => row.id === 'fb-a' ? {...row,value_scope:'agreed' as const} : row));
  assert.equal(mixedScope[2].value_scope,'added_value');
  assert.equal(mixedScope[3].value_scope,'agreed', 'creator assignment scope must not follow the partner');
  const noUrl = input.map(row => ({...row,content_url:null}));
  assert.deepEqual(alignSharedPublicationMetrics(noUrl),noUrl, 'missing URLs cannot identify a shared post');
  const otherPlatform = [{...input[0],platform:'facebook'},input[1]];
  assert.equal(alignSharedPublicationMetrics(otherPlatform)[1].likes,19344, 'never copy counters between platforms');
});
