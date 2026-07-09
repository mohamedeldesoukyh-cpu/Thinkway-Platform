import type { CampaignObject } from "@/features/campaign-intelligence";
import { SHORTLIST_PALETTE } from "@/features/discovery/shortlists/export/shortlist-document-styles";
import {
  resolveCampaignSummary,
  resolveExecutiveStrategy,
  resolveExecutiveSummaryData,
  resolveBudgetData,
  resolvePresentationData,
  resolvePresentationCompletion,
} from "../services/section-data-resolver";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Client-facing campaign proposal HTML — Thinkway document quality (VIO/CIO palette). */
export function buildCampaignProposalDocumentHtml(
  campaignObject: CampaignObject,
  hydratedVendors: Array<{
    displayName: string;
    handle: string;
    platform: string;
    followers?: number;
    engagementRate?: number;
    reason?: string;
  }> = []
): string {
  const P = SHORTLIST_PALETTE;
  const generated = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const summary = resolveCampaignSummary(campaignObject);
  const strategy = resolveExecutiveStrategy(campaignObject);
  const budget = resolveBudgetData(campaignObject);
  const executive = resolveExecutiveSummaryData(campaignObject);
  const presentation = resolvePresentationData(campaignObject);
  const presentationVersion = resolvePresentationCompletion(campaignObject).version;
  const brand = presentation?.brandName ?? summary?.brand ?? "Campaign";
  const campaignName = presentation?.campaignName ?? `${brand} Campaign Proposal`;

  const vendorRows =
    hydratedVendors.length > 0
      ? hydratedVendors
          .map(
            (v) => `
        <tr>
          <td>${escapeHtml(v.displayName)}</td>
          <td>@${escapeHtml(v.handle.replace(/^@/, ""))}</td>
          <td>${escapeHtml(v.platform)}</td>
          <td>${v.followers != null ? v.followers.toLocaleString() : "—"}</td>
          <td>${v.engagementRate != null ? `${(v.engagementRate * 100).toFixed(1)}%` : "—"}</td>
          <td class="muted">${escapeHtml(v.reason ?? "")}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="6" class="muted">No recommended creators yet — run discovery first.</td></tr>`;

  const budgetBlock = budget
    ? `<p><strong>Total budget:</strong> ${escapeHtml(budget.currency ?? "USD")} ${budget.total?.toLocaleString() ?? "—"}</p>
       <p class="muted">${escapeHtml(budget.notes ?? "")}</p>`
    : `<p class="muted">Budget to be confirmed with client.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(campaignName)} — Thinkway</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, sans-serif; color: ${P.ink}; background: #fff; font-size: 12px; line-height: 1.5; }
    .cover { background: ${P.primary}; color: #fff; min-height: 100vh; padding: 48px; display: flex; flex-direction: column; justify-content: space-between; }
    .cover h1 { font-size: 32px; font-weight: 700; margin-top: 12px; }
    .cover .brand { color: ${P.accent}; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
    .cover .meta { opacity: 0.85; font-size: 11px; margin-top: 24px; }
    .page { max-width: 210mm; margin: 0 auto; padding: 32px 40px; }
    h2 { font-size: 16px; color: ${P.accent}; margin: 28px 0 12px; border-bottom: 2px solid ${P.accentLight}; padding-bottom: 6px; }
    p { margin-bottom: 10px; }
    .muted { color: ${P.muted}; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { text-align: left; background: ${P.card}; padding: 8px; border-bottom: 1px solid ${P.rule}; }
    td { padding: 8px; border-bottom: 1px solid ${P.rule}; vertical-align: top; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid ${P.rule}; font-size: 10px; color: ${P.muted}; }
    @media print { .cover { page-break-after: always; } }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="brand">Thinkway · Campaign Intelligence</div>
      <h1>${escapeHtml(campaignName)}</h1>
      <p class="meta">Prepared for ${escapeHtml(brand)} · ${escapeHtml(generated)}</p>
    </div>
    <p class="meta">Confidential — for client review only</p>
  </section>
  <div class="page">
    <h2>Executive Summary</h2>
    <p>${escapeHtml(executive?.summary ?? summary?.objective ?? "Campaign proposal prepared by Thinkway AI.")}</p>
    ${executive?.recommendedActions?.length ? `<p><strong>Recommended actions:</strong> ${escapeHtml(executive.recommendedActions.join("; "))}</p>` : ""}

    <h2>Strategy</h2>
    <p>${escapeHtml(strategy?.creatorStrategy ?? strategy?.objective ?? strategy?.keyMessage ?? "Strategy aligned to brief objectives and audience.")}</p>

    <h2>Budget Overview</h2>
    ${budgetBlock}

    <h2>Recommended Creators</h2>
    <table>
      <thead>
        <tr>
          <th>Creator</th>
          <th>Handle</th>
          <th>Platform</th>
          <th>Followers</th>
          <th>ER</th>
          <th>Why selected</th>
        </tr>
      </thead>
      <tbody>${vendorRows}</tbody>
    </table>

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
  hydratedVendors: Parameters<typeof buildCampaignProposalDocumentHtml>[1] = []
): void {
  const html = buildCampaignProposalDocumentHtml(campaignObject, hydratedVendors);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Re-export for components that hydrate vendors client-side
export { resolveCreatorIds } from "../services/section-data-resolver";
