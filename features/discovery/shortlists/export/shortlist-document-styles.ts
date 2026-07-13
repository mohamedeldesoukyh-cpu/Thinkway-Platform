import { THINKWAY_REPORT_LOGO_STYLES } from "@/lib/reports/document/thinkway-report-logo";

/**
 * Print/PDF styles for Discovery shortlist exports.
 * Thinkway brand kit — electric blue #0057FF, navy #060810, lavender #E8EFFE.
 */
export const SHORTLIST_PALETTE = {
  primary: "#060810",
  secondary: "#0B1224",
  accent: "#0057FF",
  accentLight: "#E8EFFE",
  text: "#FFFFFF",
  card: "#F5F8FF",
  ink: "#0B0F1A",
  muted: "#6B7280",
  rule: "#E2E7F5",
} as const;

export function buildShortlistDocumentStyles(generatedLabel: string): string {
  const footerText = `Confidential · Thinkway Platform · ${generatedLabel}`;
  const P = SHORTLIST_PALETTE;

  return `
  :root {
    --success: ${P.accent};
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
  @page :last { margin: 0; @bottom-left { content: none; } @bottom-right { content: none; } }

  body.shortlist-report { font-size: 12px; background: #fff; }
  body.shortlist-report .page { max-width: 210mm; margin: 0 auto; box-shadow: none; border-radius: 0; }

  .page-break { page-break-before: always; break-before: page; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }

  .cover-page,
  .closing-page {
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0;
    background: ${P.primary};
    color: ${P.text};
    position: relative;
    overflow: hidden;
  }
  .cover-page { page-break-after: always; break-after: page; }
  .closing-page { page-break-before: always; break-before: page; }

  .cover-overlay,
  .closing-overlay {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 36px 40px 32px;
    background: linear-gradient(180deg, rgba(10,15,30,.72) 0%, rgba(10,15,30,.92) 55%, ${P.primary} 100%);
  }
  ${THINKWAY_REPORT_LOGO_STYLES}
  .cover-kicker { font-size: 10px; letter-spacing: 2.2px; text-transform: uppercase; color: #8899BB; margin-top: 6px; }
  .cover-title { font-size: 26px; font-weight: 700; line-height: 1.15; margin: 24px 0 10px; max-width: 88%; }
  .cover-subtitle { font-size: 12px; color: #C8D6F5; margin-bottom: 8px; line-height: 1.55; }
  .cover-meta { font-size: 12px; color: #C8D6F5; line-height: 1.65; display: grid; gap: 2px; }
  .cover-meta strong { color: #fff; font-weight: 600; }
  .cover-accent { width: 48px; height: 3px; background: ${P.accent}; border-radius: 2px; margin: 18px 0 14px; }
  .cover-footer,
  .closing-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid rgba(255,255,255,.12);
    padding-top: 16px;
    font-size: 10px;
    color: #8899BB;
  }
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

  .closing-title { font-size: 22px; font-weight: 700; margin: 28px 0 12px; color: #fff; }
  .closing-copy { font-size: 12px; color: #C8D6F5; line-height: 1.7; max-width: 520px; }
  .closing-copy p { margin-bottom: 10px; }
  .closing-contact { margin-top: 24px; font-size: 11px; color: #8899BB; line-height: 1.65; }

  .report-body { padding: 24px 32px 16px; }
  .report-body .section { margin-bottom: 22px; }
  .report-body .section-label { break-after: avoid; margin-bottom: 10px; }
  .report-body .section-label .num { background: ${P.secondary}; }
  .report-body .section-label .title { font-size: 11px; color: var(--ink); letter-spacing: 1px; }

  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi-card {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 10px 12px;
    background: ${P.card};
    min-height: 58px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .kpi-card label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--muted); margin-bottom: 4px; }
  .kpi-card strong { font-size: 16px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

  .analysis-box {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 14px 16px;
    background: ${P.accentLight};
    margin-bottom: 14px;
  }
  .analysis-box h4 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: ${P.accent};
    margin-bottom: 8px;
  }
  .analysis-box p { font-size: 11px; color: var(--ink); line-height: 1.65; }

  .breakdown-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
  .breakdown-card {
    border: 1px solid var(--rule);
    border-radius: 6px;
    padding: 12px 14px;
    background: ${P.card};
  }
  .breakdown-card h4 {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .breakdown-list { list-style: none; margin: 0; padding: 0; }
  .breakdown-list li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    padding: 4px 0;
    border-bottom: 1px solid var(--rule);
  }
  .breakdown-list li:last-child { border-bottom: none; }
  .breakdown-list .count { font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }

  .summary-box { margin-top: 14px; display: flex; justify-content: flex-end; }
  .summary-box table {
    width: 320px;
    border-collapse: collapse;
    font-size: 11px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    overflow: hidden;
  }
  .summary-box td { padding: 8px 12px; border-bottom: 1px solid var(--rule); }
  .summary-box tr.total td { font-weight: 700; background: ${P.secondary}; color: #fff; border-bottom: none; }
  .summary-box td.num { text-align: right; font-variant-numeric: tabular-nums; }

  .report-note { font-size: 11px; color: var(--muted); line-height: 1.6; margin-bottom: 12px; }

  .screen-footer { display: none; }
  @media screen {
    body.shortlist-report { background: var(--bg); }
    body.shortlist-report .page {
      margin: 24px auto;
      box-shadow: 0 1px 3px rgba(0,0,0,.07), 0 8px 32px rgba(0,0,0,.05);
      border-radius: 8px;
      overflow: hidden;
    }
    .screen-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      background: var(--bg);
      border-top: 1px solid var(--rule);
      padding: 12px 32px;
      font-size: 10px;
      color: var(--muted);
    }
    .screen-footer .badge { color: ${P.accent}; font-weight: 600; }
  }
  @media print {
    body.shortlist-report { background: white; }
    body.shortlist-report .page { margin: 0; max-width: none; }
    .cover-page,
    .closing-page { min-height: 100vh; }
    .report-body { padding: 20px 0 8px; }
    .kpi-grid,
    .breakdown-grid { grid-template-columns: repeat(3, 1fr); }
    .cover-kpi-row { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 600px) {
    .kpi-grid,
    .breakdown-grid,
    .cover-kpi-row { grid-template-columns: repeat(2, 1fr); }
  }
`;
}
