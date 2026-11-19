import { notesHaveCollabMarker, publicationCollabLabel, uniqueCollabPublications } from '@/lib/campaigns/publication-content-url';
import type { CampaignPublicationRow } from '@/lib/domains/campaign/types';
import { videoMetricTotals } from './reported-metrics';

/** Shared-post results, never an inference from duplicate URLs alone. */
export function collabAnalysis(publications: CampaignPublicationRow[]): string[] {
  return uniqueCollabPublications(publications).filter(p => notesHaveCollabMarker(p.notes)).map(p => {
    const metrics = videoMetricTotals([p]).map(m => m.label + ': ' + m.value).join(' · ');
    const engagements = p.total_engagements == null ? 'not available' : p.total_engagements.toLocaleString('en-US');
    return publicationCollabLabel(p.influencer_name, p.notes) + ' — ' + p.platform_label + '. ' + metrics + ' · Engagements: ' + engagements + '. Shared results credit both creators and count once in campaign totals; they do not measure each creator’s separate contribution.';
  });
}
