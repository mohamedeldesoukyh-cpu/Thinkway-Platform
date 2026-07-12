import { THINKWAY_REPORT_LOGO_STYLES } from "@/lib/reports/document/thinkway-report-logo";

/**
 * Print/PDF styles for client quotation exports.
 * IO-aligned palette — matches Performance report / Client IO documents.
 */
export const QUOTATION_PALETTE = {
  primary: "#020B26",
  secondary: "#0B1E59",
  accent: "#1E5EFF",
  text: "#FFFFFF",
  card: "#F8FAFC",
  ink: "#1A1F36",
  muted: "#6B7280",
  rule: "#E2E8F0",
} as const;

export function buildQuotationDocumentStyles(generatedLabel: string): string {
  const footerText = `Confidential · Thinkway Platform · ${generatedLabel}`;
  const P = QUOTATION_PALETTE;

  return `
  :root {
    --success: #059669;
    --warning: #D97706;
    --destructive: #DC2626;
  }

  @page {
    size: A4 portrait;
    margin: 14mm 12mm 18mm 12mm;
    @bottom-left {
      content: "${footerText}";
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      color: ${P.muted};
      vertical-align: top;
    }
    @bottom-right {
      content: "Page " counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      font-weight: 600;
      color: ${P.ink};
      vertical-align: top;
    }
  }
  @page :first { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }

  body.quotation-report { font-size: 12px; background: #fff; }
  body.quotation-report .page { max-width: 210mm; margin: 0 auto; box-shadow: none; border-radius: 0; }

  .page-break { page-break-before: always; break-before: page; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }

  .cover-page {
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0;
    background: ${P.primary};
    color: ${P.text};
    page-break-after: always;
    break-after: page;
    position: relative;
    overflow: hidden;
  }
  .cover-overlay {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 36px 40px 32px;
    background: linear-gradient(180deg, rgba(2,11,38,.72) 0%, rgba(2,11,38,.92) 55%, ${P.primary} 100%);
  }
  ${THINKWAY_REPORT_LOGO_STYLES}
  .cover-kicker { font-size: 10px; letter-spacing: 2.2px; text-transform: uppercase; color: #8899BB; margin-top: 6px; }
  .cover-title { font-size: 26px; font-weight: 700; line-height: 1.15; margin: 24px 0 10px; max-width: 88%; }
  .cover-subtitle { font-size: 12px; color: #C8D6F5; margin-bottom: 8px; }
  .cover-meta { font-size: 12px; color: #C8D6F5; line-height: 1.65; display: grid; gap: 2px; }
  .cover-meta strong { color: #fff; font-weight: 600; }
  .cover-accent { width: 48px; height: 3px; background: ${P.accent}; border-radius: 2px; margin: 18px 0 14px; }
  .cover-footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid rgba(255,255,255,.12); padding-top: 16px; font-size: 10px; color: #8899BB; }
  .cover-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 24px; }
  .cover-kpi {
    background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 6px;
    padding: 12px 10px;
    text-align: center;
  }
  .cover-kpi .label { display: block; font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; color: #8899BB; margin-bottom: 4px; }
  .cover-kpi .value { font-size: 15px; font-weight: 700; color: #fff; }

  .status-badge {
    display: inline-block;
    margin-top: 10px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .status-badge--active { background: rgba(30,94,255,.2); color: #C8D6F5; border: 1px solid rgba(30,94,255,.35); }
  .status-badge--expired { background: rgba(220,38,38,.15); color: #FCA5A5; border: 1px solid rgba(220,38,38,.35); }

  .report-body { padding: 24px 32px 16px; }
  .report-body .section { margin-bottom: 22px; }
  .report-body .section-label { break-after: avoid; margin-bottom: 10px; }
  .report-body .section-label .num { background: ${P.secondary}; }
  .report-body .section-label .title { font-size: 11px; color: var(--ink); letter-spacing: 1px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi-card { border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px; background: ${P.card}; min-height: 58px; display: flex; flex-direction: column; justify-content: center; }
  .kpi-card label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--muted); margin-bottom: 4px; }
  .kpi-card strong { font-size: 16px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

  .money {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: nowrap;
    gap: 0.2em;
    white-space: nowrap;
  }
  .money-amount, .money-primary { font-variant-numeric: tabular-nums; }
  .money-currency { font-size: 0.85em; color: var(--muted); font-weight: 500; }
  .money-sep { color: var(--muted); margin: 0 0.15em; }

  .data-table tbody td.num,
  .summary-box td.num { white-space: nowrap; }

  .summary-box { margin-top: 14px; display: flex; justify-content: flex-end; }
  .summary-box table { width: 300px; border-collapse: collapse; font-size: 11px; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; }
  .summary-box td { padding: 8px 12px; border-bottom: 1px solid var(--rule); }
  .summary-box tr.total td { font-weight: 700; background: ${P.secondary}; color: #fff; border-bottom: none; }
  .summary-box tr.sub td:first-child { padding-left: 20px; font-size: 10px; color: var(--muted); }
  .summary-box tr.gp td.num { font-weight: 700; }
  .summary-box td.num { text-align: right; font-variant-numeric: tabular-nums; }

  .summary-insight {
    margin: 4px 0 14px;
    padding: 12px 14px;
    border: 1px solid rgba(29,158,117,.28);
    border-left: 4px solid #1D9E75;
    border-radius: 6px;
    background: #F2FBF7;
  }
  .summary-insight-title {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: #0F766E;
    margin-bottom: 6px;
  }
  .summary-insight ul { margin: 0; padding-left: 16px; }
  .summary-insight li { margin: 3px 0; font-size: 11px; line-height: 1.45; color: var(--ink); }

  .summary-overview-page,
  .category-summary-page {
    page-break-before: always;
    break-before: page;
    page-break-inside: avoid;
    break-inside: avoid;
    min-height: 0;
  }
  .category-summary-table { max-width: 520px; }
  .category-summary-table td:last-child,
  .category-summary-table th:last-child { text-align: right; }
  .category-summary-note { margin-top: 8px; font-size: 10px; color: var(--muted); }

  .tier-breakdown-divider {
    margin: 18px 0 14px;
    border-top: 1px solid var(--rule);
  }
  .tier-breakdown-section { margin-top: 4px; }
  .tier-breakdown-title {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--ink);
    margin-bottom: 12px;
    line-height: 1.4;
  }
  .tier-breakdown-block {
    margin-bottom: 14px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .tier-breakdown-header {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    align-items: center;
    padding: 8px 12px;
    background: #F1F5F9;
    border-bottom: 1px solid var(--rule);
    font-size: 10px;
    color: var(--ink);
    line-height: 1.4;
  }
  .tier-breakdown-header strong {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.6px;
    color: ${P.secondary};
  }
  .tier-breakdown-header span { color: var(--muted); }
  .tier-breakdown-table {
    border: none;
    border-radius: 0;
    font-size: 10px;
  }
  .tier-breakdown-table thead th {
    background: #fff;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--muted);
    border-bottom: 1px solid var(--rule);
  }
  .tier-breakdown-table tbody td {
    padding: 6px 10px;
    vertical-align: top;
  }
  .tier-breakdown-table tbody tr:nth-child(even):not(.tier-subtotal-row) td {
    background: #FAFBFC;
  }
  .tier-breakdown-table .tier-subtotal-row td {
    font-weight: 700;
    background: #EEF2FF;
    border-top: 1px solid var(--rule);
    color: var(--ink);
  }
  .tier-breakdown-grand-total {
    margin-top: 6px;
    padding: 10px 12px;
    border: 1px solid ${P.secondary};
    border-radius: 6px;
    background: ${P.secondary};
    color: #fff;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: 10px;
    line-height: 1.4;
  }
  .tier-breakdown-grand-total strong {
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .tier-breakdown-empty {
    font-size: 11px;
    padding: 12px 0;
  }

  .terms-list { list-style: none; margin: 0; padding: 0; }
  .terms-list li { margin-bottom: 12px; break-inside: avoid; }
  .terms-list h4 { font-size: 11px; font-weight: 700; margin-bottom: 4px; color: var(--ink); }
  .terms-list p { font-size: 11px; color: var(--ink); line-height: 1.6; }

  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 24px; }
  .sign-slot { border-top: 2px solid ${P.secondary}; padding-top: 10px; min-height: 72px; }
  .sign-slot .role { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink); }
  .sign-slot .hint { margin-top: 28px; font-size: 10px; color: var(--muted); line-height: 1.6; }

  .revision-foot {
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px dashed var(--rule);
    font-size: 9px;
    color: var(--muted);
  }

  .report-note { font-size: 11px; color: var(--muted); line-height: 1.6; white-space: pre-wrap; }

  .screen-footer { display: none; }
  @media screen {
    body.quotation-report { background: var(--bg); }
    body.quotation-report .page { margin: 24px auto; box-shadow: 0 1px 3px rgba(0,0,0,.07), 0 8px 32px rgba(0,0,0,.05); border-radius: 8px; overflow: hidden; }
    .screen-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: var(--bg); border-top: 1px solid var(--rule); padding: 12px 32px; font-size: 10px; color: var(--muted); }
    .screen-footer .badge { color: ${P.accent}; font-weight: 600; }
  }
  @media print {
    body.quotation-report { background: white; }
    body.quotation-report .page { margin: 0; max-width: none; }
    .cover-page { min-height: 100vh; }
    .report-body { padding: 20px 0 8px; }
    .kpi-grid { grid-template-columns: repeat(3, 1fr); }
    .cover-kpi-row { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 600px) {
    .kpi-grid, .cover-kpi-row { grid-template-columns: repeat(2, 1fr); }
    .sign-grid { grid-template-columns: 1fr; gap: 24px; }
  }
`;
}
