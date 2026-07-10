import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  buildCreatorMixFromFacts,
  formatFactsBudgetDisplay,
  getCampaignFacts,
  resolveFactsDurationWeeks,
} from "@/features/campaign-director/facts/facts-display-bridge";
import { SHORTLIST_PALETTE } from "@/features/discovery/shortlists/export/shortlist-document-styles";

import {
  resolveCampaignSummary,
  resolveExecutiveStrategy,
  resolveExecutiveSummaryData,
  resolveBudgetData,
  resolveKpiData,
  resolvePresentationData,
  resolvePresentationCompletion,
} from "../services/section-data-resolver";
import { buildCreatorContentIdea, isTrendCampaign } from "../services/creator-slate";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ProposalVendor = {
  displayName: string;
  handle?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  tier?: string;
  reason?: string;
  contentIdea?: string;
};

/** Creator rows for the proposal — hydrated vendors first, section reasoning as fallback. */
function resolveProposalVendors(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[]
): ProposalVendor[] {
  if (hydratedVendors.length > 0) return hydratedVendors;

  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const reasoning: VendorSelectedReasoning[] =
    creatorsData.recommendations?.selectedReasoning ?? [];

  return reasoning
    .filter((r) => r.displayName?.trim())
    .map((r) => ({
      displayName: r.displayName!.trim(),
      reason: r.whySelected,
      tier: r.expectedRole,
    }));
}

/** Activation waves: tier order over the campaign window sustains trend momentum. */
function buildActivationWaves(
  campaignObject: CampaignObject
): Array<{ window: string; wave: string; goal: string }> {
  const facts = getCampaignFacts(campaignObject);
  if (!facts) return [];

  const weeks = resolveFactsDurationWeeks(facts);
  const mix = buildCreatorMixFromFacts(facts);
  const trend = isTrendCampaign(facts);

  const waves: Array<{ wave: string; goal: string }> = mix.map((tier) => ({
    wave: `${tier.tier} creators (${tier.percent}%)`,
    goal: tier.reasoning,
  }));
  if (trend) {
    waves.push({
      wave: "UGC competition + best-video spotlight",
      goal: "Convert audience participation into a self-sustaining trend",
    });
  }

  const windowWeeks = Math.max(1, Math.floor(weeks / Math.max(waves.length, 1)));
  let start = 1;
  return waves.map((w, index) => {
    const end = index === waves.length - 1 ? weeks : Math.min(weeks, start + windowWeeks - 1);
    const window = start === end ? `Week ${start}` : `Weeks ${start}–${end}`;
    start = end + 1;
    return { window, ...w };
  });
}

const TREND_AMPLIFICATION = [
  "TikTok Spark Ads on top-performing creator posts (reactive boost within 24h of a spike)",
  "Official hashtag challenge with the campaign sound pinned",
  "Duet and stitch chains seeded between anchor creators",
  "Best-video competition to convert viewers into participants",
  "Celebrity reposts of standout community videos",
  "Official brand account reshares top UGC daily during peak weeks",
];

const GENERIC_AMPLIFICATION = [
  "Paid boost on top-performing creator posts",
  "Cross-posting of best content to brand channels",
  "Creator collaboration formats (duets, joint posts) to pool audiences",
];

/** Client-facing campaign proposal HTML — Thinkway document quality (VIO/CIO palette). */
export function buildCampaignProposalDocumentHtml(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = []
): string {
  const P = SHORTLIST_PALETTE;
  const generated = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const facts = getCampaignFacts(campaignObject);
  const summary = resolveCampaignSummary(campaignObject);
  const strategy = resolveExecutiveStrategy(campaignObject);
  const budget = resolveBudgetData(campaignObject);
  const executive = resolveExecutiveSummaryData(campaignObject);
  const presentation = resolvePresentationData(campaignObject);
  const kpis = resolveKpiData(campaignObject);
  const presentationVersion = resolvePresentationCompletion(campaignObject).version;

  const client = summary?.client ?? presentation?.brandName ?? "Client";
  const brand = presentation?.brandName ?? summary?.brand ?? client;
  const campaignName = presentation?.campaignName ?? `${brand} Campaign Proposal`;
  const trend = isTrendCampaign(facts);

  const understandingRows = [
    ["Client", summary?.client],
    ["Brand", summary?.brand],
    ["Product", summary?.product],
    ["Market", summary?.market],
    ["Objective", summary?.objective],
    ["Audience", summary?.targetAudience],
    ["Budget", facts ? formatFactsBudgetDisplay(facts) : summary?.budget],
    ["Duration", summary?.duration],
    ["Platforms", summary?.platforms],
    ["Deliverables", summary?.deliverables],
  ]
    .filter(([, value]) => value?.toString().trim())
    .map(
      ([label, value]) =>
        `<tr><th style="width:150px">${escapeHtml(String(label))}</th><td>${escapeHtml(String(value))}</td></tr>`
    )
    .join("");

  const vendors = resolveProposalVendors(campaignObject, hydratedVendors);
  const vendorRows =
    vendors.length > 0
      ? vendors
          .map((v, i) => {
            const idea =
              v.contentIdea ??
              buildCreatorContentIdea({ categories: [v.reason ?? ""] }, facts, i);
            return `
        <tr>
          <td><strong>${escapeHtml(v.displayName)}</strong>${v.handle ? `<br/><span class="muted">@${escapeHtml(v.handle.replace(/^@/, ""))}</span>` : ""}</td>
          <td>${escapeHtml(v.tier ?? "—")}</td>
          <td>${escapeHtml(v.platform ?? "—")}</td>
          <td>${v.followers != null ? v.followers.toLocaleString() : "—"}</td>
          <td class="muted">${escapeHtml(v.reason ?? "")}</td>
          <td class="muted">${escapeHtml(idea)}</td>
        </tr>`;
          })
          .join("")
      : `<tr><td colspan="6" class="muted">Creator slate pending discovery run.</td></tr>`;

  const waves = buildActivationWaves(campaignObject);
  const waveRows = waves
    .map(
      (w) =>
        `<tr><th style="width:110px">${escapeHtml(w.window)}</th><td><strong>${escapeHtml(w.wave)}</strong><br/><span class="muted">${escapeHtml(w.goal)}</span></td></tr>`
    )
    .join("");

  const kpiItems = Array.isArray(kpis) ? [] : (kpis?.kpis ?? []);
  const kpiRows = kpiItems
    .slice(0, 8)
    .map(
      (k) =>
        `<tr><td>${escapeHtml(k.metric)}</td><td>${escapeHtml(k.target ?? "")}</td><td class="muted">${escapeHtml(k.benchmark ?? k.platform ?? "")}</td></tr>`
    )
    .join("");

  const amplification = (trend ? TREND_AMPLIFICATION : GENERIC_AMPLIFICATION)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  const budgetBlock = budget
    ? `<p><strong>Total budget:</strong> ${escapeHtml(budget.currency ?? "USD")} ${budget.total?.toLocaleString() ?? "—"}</p>
       <table><tbody>${(budget.allocations ?? [])
         .map(
           (a) =>
             `<tr><th style="width:220px">${escapeHtml(a.category)} · ${a.percent ?? 0}%</th><td class="muted">${escapeHtml(a.notes ?? "")}</td></tr>`
         )
         .join("")}</tbody></table>`
    : `<p class="muted">Budget to be confirmed with client.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(campaignName)} — Thinkway</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, "Segoe UI", system-ui, sans-serif; color: ${P.ink}; background: #fff; font-size: 12px; line-height: 1.55; }
    .cover { background: ${P.primary}; color: #fff; min-height: 100vh; padding: 48px; display: flex; flex-direction: column; justify-content: space-between; }
    .cover h1 { font-size: 34px; font-weight: 700; margin-top: 12px; max-width: 640px; }
    .cover .goal { margin-top: 20px; font-size: 15px; opacity: 0.95; max-width: 560px; }
    .cover .brand { color: ${P.accent}; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
    .cover .meta { opacity: 0.85; font-size: 11px; margin-top: 24px; }
    .page { max-width: 210mm; margin: 0 auto; padding: 32px 40px; }
    h2 { font-size: 16px; color: ${P.accent}; margin: 30px 0 12px; border-bottom: 2px solid ${P.accentLight}; padding-bottom: 6px; }
    p { margin-bottom: 10px; }
    ul { margin: 6px 0 10px 18px; }
    li { margin-bottom: 4px; }
    .muted { color: ${P.muted}; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { text-align: left; background: ${P.card}; padding: 8px; border-bottom: 1px solid ${P.rule}; vertical-align: top; }
    td { padding: 8px; border-bottom: 1px solid ${P.rule}; vertical-align: top; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid ${P.rule}; font-size: 10px; color: ${P.muted}; }
    @media print { .cover { page-break-after: always; } h2 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="brand">Thinkway · Campaign Intelligence</div>
      <h1>${escapeHtml(campaignName)}</h1>
      ${summary?.objective ? `<p class="goal">${escapeHtml(summary.objective)}</p>` : ""}
      <p class="meta">Prepared for ${escapeHtml(client)} · ${escapeHtml(generated)}</p>
    </div>
    <p class="meta">Confidential — for client review only</p>
  </section>
  <div class="page">
    <h2>Campaign Understanding</h2>
    <table><tbody>${understandingRows}</tbody></table>

    <h2>Executive Summary</h2>
    <p>${escapeHtml(executive?.summary ?? summary?.objective ?? "Campaign proposal prepared by Thinkway.")}</p>
    ${executive?.recommendedActions?.length ? `<ul>${executive.recommendedActions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>` : ""}

    <h2>Strategy</h2>
    <p>${escapeHtml(strategy?.creatorStrategy ?? strategy?.objective ?? strategy?.keyMessage ?? "Strategy aligned to brief objectives and audience.")}</p>

    <h2>Activation Plan — Momentum Waves</h2>
    <p class="muted">Staggered creator waves keep the campaign trending instead of peaking on day one.</p>
    <table><tbody>${waveRows || `<tr><td class="muted">Timeline pending.</td></tr>`}</tbody></table>

    <h2>Recommended Creators &amp; Content Concepts</h2>
    <table>
      <thead>
        <tr>
          <th>Creator</th>
          <th>Tier</th>
          <th>Platform</th>
          <th>Followers</th>
          <th>Why selected</th>
          <th>Content concept</th>
        </tr>
      </thead>
      <tbody>${vendorRows}</tbody>
    </table>

    <h2>Budget</h2>
    ${budgetBlock}

    <h2>Amplification Recommendations</h2>
    <ul>${amplification}</ul>

    ${kpiRows ? `<h2>Success Metrics</h2><table><thead><tr><th>Metric</th><th>Target</th><th>Basis</th></tr></thead><tbody>${kpiRows}</tbody></table>` : ""}

    <div class="footer">
      Generated by Thinkway Platform · ${escapeHtml(generated)} · Document ref ${escapeHtml(presentationVersion)}
    </div>
  </div>
</body>
</html>`;
}

/** Open proposal preview in a new browser tab (print / Save as PDF). */
export function openCampaignProposalPreview(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = []
): void {
  const html = buildCampaignProposalDocumentHtml(campaignObject, hydratedVendors);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Re-export for components that hydrate vendors client-side
export { resolveCreatorIds } from "../services/section-data-resolver";
