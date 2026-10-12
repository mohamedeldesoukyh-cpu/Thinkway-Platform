import type { PerformanceReportDocumentData, InfluencerReportSection } from './performance-report-types';
import { formatCompactCount, formatPercent } from '@/lib/campaigns/performance-calculations';
import { chunk, esc } from './performance-report-v2-parts';

export function creatorHighlightPages(data: PerformanceReportDocumentData): InfluencerReportSection[][] {
  const creators = [...data.influencerSections].sort((a, b) => b.summary.engagements - a.summary.engagements || a.name.localeCompare(b.name));
  return creators.length ? chunk(creators, 4) : [[]];
}

export function renderCreatorHighlights(data: PerformanceReportDocumentData, creators: InfluencerReportSection[]): string {
  const all = data.influencerSections;
  const pubs = data.bundle.publications;
  const maxEngagements = Math.max(0, ...all.map(c => c.summary.engagements));
  const maxViews = Math.max(0, ...pubs.map(p => p.views ?? 0));
  const maxEr = Math.max(0, ...pubs.map(p => p.engagement_rate ?? 0));
  return `<div class="creator-highlights">${creators.map(c => {
    const best = [...c.publications].filter(p => p.engagement_rate != null).sort((a,b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))[0];
    const badges = [c.summary.engagements > 0 && c.summary.engagements === maxEngagements ? 'Top engagements' : '', c.publications.some(p => (p.views ?? 0) > 0 && p.views === maxViews) ? 'Most-viewed post' : '', best && maxEr > 0 && best.engagement_rate === maxEr ? 'Highest post ER' : ''].filter(Boolean);
    const method = best?.engagement_rate_method;
    const denominator = method === 'views' ? best?.views : method === 'reach' ? best?.reach : method === 'followers' ? best?.platform_follower_count : null;
    const basis = method === 'followers' ? 'followers (estimate)' : method;
    const context = best ? `${best.total_engagements.toLocaleString('en-US')} interactions${denominator != null ? ` / ${denominator.toLocaleString('en-US')} ${basis}` : ` · ${method === 'manual' ? 'Manually entered rate' : 'Rate basis unavailable'}`}` : 'No engagement rate available';
    return `<article class="creator-highlight">
      <h3 class="bidi">${esc(c.name)}</h3>
      <div class="creator-highlight__badges">${badges.map(b => `<span>${b}</span>`).join('')}</div>
      <p class="note">${c.summary.agreedPublications} agreed · ${c.summary.addedValuePublications} added-value publications</p>
      <div class="creator-highlight__metrics"><div>Views<strong>${esc(formatCompactCount(c.summary.views))}</strong></div><div>Engagements<strong>${esc(formatCompactCount(c.summary.engagements))}</strong></div><div>Avg. ER<strong>${esc(formatPercent(c.summary.averageEr))}</strong></div></div>
      <div class="creator-highlight__best"><b>Best post ER: ${esc(formatPercent(best?.engagement_rate ?? null, 1))}</b><div>${esc(best?.platform_label ?? '')}</div><div>${esc(context)}</div></div>
    </article>`;
  }).join('') || '<p>No creator performance is available yet.</p>'}</div>
  <p class="note" style="margin-top:5mm">Includes agreed and added-value publications. Average ER uses the campaign methodology. Post ER shows its calculation basis; a high percentage on a small audience does not imply the highest overall impact.</p>`;
}
