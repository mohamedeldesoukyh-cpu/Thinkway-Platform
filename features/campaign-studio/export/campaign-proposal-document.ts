import type { CampaignObject } from "@/features/campaign-intelligence";
import { SHORTLIST_PALETTE } from "@/features/discovery/shortlists/export/shortlist-document-styles";
import type { SlateCreatorInput } from "../services/campaign-render-model";
import {
  buildCampaignProposalModel,
  type CampaignProposalModel,
  type ProposalSection,
} from "./campaign-proposal-model";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSectionHtml(section: ProposalSection): string {
  switch (section.kind) {
    case "keyValue":
      return `
    <h2>${escapeHtml(section.title)}</h2>
    <table>
      <tbody>${section.items
        .map(
          (item) => `
        <tr><th style="width:30%">${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`
        )
        .join("")}
      </tbody>
    </table>`;
    case "text":
      return `
    <h2>${escapeHtml(section.title)}</h2>
    ${section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n    ")}
    ${
      section.bullets?.length
        ? `<ul>${section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : ""
    }`;
    case "table":
      return `
    <h2>${escapeHtml(section.title)}</h2>
    <table>
      <thead>
        <tr>${section.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
      </thead>
      <tbody>${
        section.rows.length > 0
          ? section.rows
              .map(
                (row) => `
        <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
              )
              .join("")
          : `<tr><td colspan="${section.headers.length}" class="muted">${escapeHtml(section.note ?? "—")}</td></tr>`
      }
      </tbody>
    </table>
    ${section.rows.length > 0 && section.note ? `<p class="muted">${escapeHtml(section.note)}</p>` : ""}`;
    case "cards":
      return `
    <h2>${escapeHtml(section.title)}</h2>
    <div class="cards">${section.cards
      .map(
        (card) => `
      <div class="card">
        <p class="card-title">${escapeHtml(card.title)}</p>
        ${card.lines.map((line) => `<p class="card-line">${escapeHtml(line)}</p>`).join("")}
      </div>`
      )
      .join("")}
    </div>`;
  }
}

/**
 * Client-facing campaign proposal HTML — rendered from the same
 * CampaignProposalModel as the PowerPoint export so both deliverables and the
 * Studio surfaces stay consistent by construction.
 */
export function buildCampaignProposalDocumentHtmlFromModel(
  model: CampaignProposalModel
): string {
  const P = SHORTLIST_PALETTE;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(model.campaignName)} — Thinkway</title>
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
    ul { margin: 0 0 10px 18px; }
    li { margin-bottom: 4px; }
    .muted { color: ${P.muted}; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 11px; }
    th { text-align: left; background: ${P.card}; padding: 8px; border-bottom: 1px solid ${P.rule}; }
    td { padding: 8px; border-bottom: 1px solid ${P.rule}; vertical-align: top; }
    .cards { display: flex; gap: 12px; flex-wrap: wrap; }
    .card { flex: 1 1 30%; min-width: 180px; border: 1px solid ${P.rule}; border-radius: 8px; padding: 12px; background: ${P.card}; }
    .card-title { font-weight: 700; margin-bottom: 6px; }
    .card-line { font-size: 11px; margin-bottom: 4px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid ${P.rule}; font-size: 10px; color: ${P.muted}; }
    @media print { .cover { page-break-after: always; } h2 { page-break-after: avoid; } table { page-break-inside: auto; } }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="brand">Thinkway · Campaign Intelligence</div>
      <h1>${escapeHtml(model.campaignName)}</h1>
      <p class="meta">${escapeHtml(model.preparedForLine)} · ${escapeHtml(model.dateLabel)}</p>
    </div>
    <p class="meta">${escapeHtml(model.confidentialityNote)}</p>
  </section>
  <div class="page">
    ${model.sections.map(renderSectionHtml).join("\n")}
    <div class="footer">
      Generated by Thinkway Platform · ${escapeHtml(model.dateLabel)} · Document ref ${escapeHtml(model.version)}
    </div>
  </div>
</body>
</html>`;
}

/** Client-facing campaign proposal HTML built from the Campaign Object. */
export function buildCampaignProposalDocumentHtml(
  campaignObject: CampaignObject,
  hydratedVendors: SlateCreatorInput[] = []
): string {
  const model = buildCampaignProposalModel(campaignObject, hydratedVendors);
  return buildCampaignProposalDocumentHtmlFromModel(model);
}

/** Open proposal preview in a new browser tab (print / Save as PDF). */
export function openCampaignProposalPreview(
  campaignObject: CampaignObject,
  hydratedVendors: SlateCreatorInput[] = []
): void {
  const html = buildCampaignProposalDocumentHtml(campaignObject, hydratedVendors);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Re-export for components that hydrate vendors client-side
export { resolveCreatorIds } from "../services/section-data-resolver";
